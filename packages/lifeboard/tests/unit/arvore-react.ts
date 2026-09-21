import type { ReactElement, ReactNode } from "react";

/**
 * OS-LIFEBOARD · P6 — ANDAR NA ÁRVORE QUE O COMPONENTE DEVOLVE.
 *
 * [rodada 11] Por que este arquivo existe: 6 das 13 mutações que a suíte da
 * rodada 10 não pegou moram no CORPO de um handler
 * (`mudou: valor !== confirmado` → `mudou: true`, o `aoFalha` que reverte o
 * `<select>`, o `limparRascunhoNota` do sucesso, o `valido: todosEscolhidos`,
 * o `peso` mandado sempre). Um `renderToStaticMarkup` vê o HTML e nunca o
 * handler; jsdom e `@testing-library` não existem aqui e `npm install` está
 * proibido.
 *
 * O que dá para fazer sem DOM: um componente React é uma FUNÇÃO. Com os
 * hooks trocados por um mock controlável (o mesmo truque de
 * `tarefa-porta-de-escrita.test.ts`), chamá-la devolve a árvore de elementos —
 * e a árvore carrega os handlers em `props`. Daí `onSubmit`, `onChange` e
 * `onClick` são invocáveis de verdade, e a escrita sai pela porta de verdade,
 * até a Server Action espiã.
 *
 * O que ele NÃO é: um navegador. Nada aqui mede foco, pintura ou o que o
 * leitor de tela anuncia — isso continua sendo medido no Chromium.
 */

interface ElementoComFilhos {
  type: unknown;
  props: Record<string, unknown> & { children?: ReactNode };
}

function ehElemento(v: unknown): v is ElementoComFilhos {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    "props" in v &&
    typeof (v as { props: unknown }).props === "object"
  );
}

/** Todos os nós da árvore, em pré-ordem (o próprio nó primeiro). */
export function nos(raiz: ReactNode): ElementoComFilhos[] {
  const achados: ElementoComFilhos[] = [];
  const visitar = (n: ReactNode): void => {
    if (Array.isArray(n)) {
      for (const filho of n) visitar(filho as ReactNode);
      return;
    }
    if (!ehElemento(n)) return;
    achados.push(n);
    visitar(n.props.children);
  };
  visitar(raiz);
  return achados;
}

/** O 1º nó que satisfaz o predicado — lança com contexto quando não há. */
export function acharNo(
  raiz: ReactNode,
  predicado: (n: ElementoComFilhos) => boolean,
  oQueEra: string,
): ElementoComFilhos {
  const achado = nos(raiz).find(predicado);
  if (achado === undefined) {
    throw new Error(`não achei ${oQueEra} na árvore`);
  }
  return achado;
}

/** O nó cuja tag HTML é `tag` (o 1º), opcionalmente filtrado por props. */
export function porTag(
  raiz: ReactNode,
  tag: string,
  filtro: (props: Record<string, unknown>) => boolean = () => true,
): ElementoComFilhos {
  return acharNo(raiz, (n) => n.type === tag && filtro(n.props), `<${tag}>`);
}

/** Todos os nós de uma tag. */
export function todasAsTags(raiz: ReactNode, tag: string): ElementoComFilhos[] {
  return nos(raiz).filter((n) => n.type === tag);
}

/** O texto corrido da árvore (strings e números concatenados, na ordem). */
export function texto(raiz: ReactNode): string {
  const partes: string[] = [];
  const visitar = (n: unknown): void => {
    if (typeof n === "string") {
      partes.push(n);
      return;
    }
    if (typeof n === "number") {
      partes.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const filho of n) visitar(filho);
      return;
    }
    if (ehElemento(n)) visitar(n.props.children);
  };
  visitar(raiz);
  return partes.join("");
}

/** Chama um handler de prop (`onClick`, `onSubmit`, …) com o evento dado. */
export function disparar(
  no: ElementoComFilhos,
  prop: string,
  evento: unknown = { preventDefault: () => undefined },
): void {
  const handler = no.props[prop];
  if (typeof handler !== "function") {
    throw new Error(`o nó não tem ${prop}`);
  }
  (handler as (e: unknown) => void)(evento);
}

/** O componente-filho de um elemento (a FUNÇÃO), para ser montado à parte. */
export function componenteFilho(
  raiz: ReactNode,
  nome: string,
): { fn: (props: Record<string, unknown>) => ReactElement; props: Record<string, unknown> } {
  const no = acharNo(
    raiz,
    (n) => typeof n.type === "function" && (n.type as { name?: string }).name === nome,
    `o componente ${nome}`,
  );
  return {
    fn: no.type as (props: Record<string, unknown>) => ReactElement,
    props: no.props,
  };
}

/** Todos os elementos cujo componente se chama `nome` (função, não tag). */
export function componentes(raiz: ReactNode, nome: string): ElementoComFilhos[] {
  return nos(raiz).filter(
    (n) => typeof n.type === "function" && (n.type as { name?: string }).name === nome,
  );
}

/** As props do 1º elemento daquele componente. */
export function propsDe(raiz: ReactNode, nome: string): Record<string, unknown> {
  const achado = componentes(raiz, nome)[0];
  if (achado === undefined) throw new Error(`não achei <${nome}> na árvore`);
  return achado.props;
}

/**
 * Tudo que a tela DIZ: o texto corrido + o que está nas regiões vivas e nos
 * campos de erro, que são componentes (`<CampoErro mensagem=…>`), e por isso
 * não aparecem no `children` de ninguém.
 */
export function oQueATelaDiz(raiz: ReactNode): string {
  const ditos = [texto(raiz)];
  for (const nome of ["CampoErro", "MensagemSucesso"]) {
    for (const c of componentes(raiz, nome)) {
      const m = c.props.mensagem;
      if (typeof m === "string") ditos.push(m);
    }
  }
  return ditos.join(" | ");
}

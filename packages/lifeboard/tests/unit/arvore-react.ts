import type { ReactElement, ReactNode } from "react";

import { montar, novaInstancia } from "./hooks-falsos";

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


/**
 * ═══════════════════════════════════════════════════════ ALTO #2, rodada 12 ═
 * A ÁRVORE ATÉ O FIM — onde as `props` já estão FUNDIDAS.
 *
 * A trava da rodada 10 era uma expressão regular sobre o TEXTO do arquivo
 * (`tarefa-varredura-derivada.ts` → `tiposDeInput`). O crítico da rodada 11
 * passou por ela com três linhas de um padrão banal:
 *
 *     const AJUSTES_DO_TECLADO: Record<string, string> = { type: "number", … };
 *     <input type="text" inputMode="decimal" {...AJUSTES_DO_TECLADO} … />
 *
 * O texto do arquivo continha `type="text"`; o navegador recebia
 * `type="number"` (o espalhamento vem depois e vence), e o CRÍTICO da rodada
 * 10 voltava inteiro — dado do operador apagado em silêncio — com `tsc`,
 * `eslint` e 1412 testes verdes.
 *
 * `nos()` sozinho não basta: ele para na FRONTEIRA do componente — um
 * `<CampoNumerico …/>` é um nó de função, e o `<input>` de verdade só existe
 * depois de chamá-la. `expandir` chama: para todo nó cujo `type` é uma
 * função, monta o componente com as props DAQUELE nó (hooks falsos, uma
 * instância por montagem) e põe o resultado no lugar dele. O que sobra é a
 * árvore de elementos de HTML — a mesma que o React entregaria ao DOM, com o
 * espalhamento já resolvido.
 *
 * O que isto pega e a regex não pegava: tipo vindo de variável, de objeto
 * importado de outro arquivo, de espalhamento, de um componente que envolve
 * o campo — e a variante que ninguém imaginou ainda, porque a pergunta
 * deixou de ser "que texto está escrito" e passou a ser "o que o elemento
 * renderizado diz".
 *
 * O que ele continua NÃO sendo: um navegador. Um `type` posto à mão num nó
 * do DOM por uma `ref` não aparece aqui — essa forma é vigiada pela segunda
 * rede, léxica (`escritasNoDom`), e medida no Chromium.
 */
export function expandir(raiz: ReactNode, limite = 40): ReactNode {
  const passo = (n: ReactNode, profundidade: number): ReactNode => {
    if (profundidade > limite) {
      throw new Error(`componentes aninhados além de ${String(limite)} níveis`);
    }
    if (Array.isArray(n)) return n.map((f) => passo(f as ReactNode, profundidade));
    if (!ehElemento(n)) return n;
    if (typeof n.type === "function") {
      const fn = n.type as (props: Record<string, unknown>) => ReactNode;
      return passo(montar(novaInstancia(), fn, n.props), profundidade + 1);
    }
    // `n` está estreitado para `ReactNode & ElementoComFilhos`, e o TS recusa
    // espalhar essa interseção (TS2698). O elemento em si é um objeto — o
    // cast diz só isso, e nada além disso.
    const el = n as unknown as Record<string, unknown> & ElementoComFilhos;
    return {
      ...el,
      props: { ...el.props, children: passo(el.props.children, profundidade) },
    } as unknown as ReactNode;
  };
  return passo(raiz, 0);
}

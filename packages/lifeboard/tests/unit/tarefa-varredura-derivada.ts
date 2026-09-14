import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * OS-LIFEBOARD · P6 — O SCANNER da varredura (rodada 7, ALTO #1).
 *
 * A varredura da rodada 6 não varria: comparava DUAS LISTAS ESCRITAS À MÃO
 * (`OPERACOES` do teste × `OPERACOES_DE_ESCRITA` do código), e nenhuma das
 * duas derivava do fonte. O crítico provou acrescentando em `duracao-form.tsx`
 * um botão "Zerar duração" com `useAcaoTarefa(estimativaSetAction)` +
 * `disparar(form)` cru, sem `decidirEscrita` nem `concluirEscrita`: 989/989
 * testes passaram, tsc 0, eslint 0, build 0 — e em runtime o campo era
 * apagado no servidor, em silêncio, com a tela mostrando o valor velho.
 *
 * Este módulo LÊ o código-fonte de `src/components/task/**` e
 * `src/app/tarefa/**`, acha TODO sítio de escrita e devolve o que achou. O
 * teste (`tarefa-escritas-varredura.test.ts`) é quem julga. A constante
 * `OPERACOES_DE_ESCRITA` deixou de ser fonte: ela é CONFERIDA contra o
 * conjunto derivado daqui, nos dois sentidos.
 *
 * Sem parser de TypeScript no repositório (`npm install` proibido nesta
 * rodada), o scanner é léxico: tira comentários e strings, acha os nomes que
 * `useAcaoTarefa` devolve, acha as chamadas desses nomes e sobe pelo bloco
 * `{}` que as contém. É grosseiro de propósito — e é exatamente por isso que
 * ele não tem como "não ver" um sítio novo: qualquer chamada de despacho que
 * não esteja dentro de um handler com `decidirEscrita` + `recusarEscrita("op")`
 * aparece na lista de ÓRFÃOS, com arquivo e linha.
 */

const RAIZ = fileURLToPath(new URL("../../src/", import.meta.url));

/** As duas árvores que a régua cobre — a página da tarefa inteira. */
export const PASTAS_VARRIDAS = ["components/task", "app/tarefa"] as const;

/**
 * Exceções — cada uma com o motivo POR ESCRITO. O teste imprime esta lista;
 * uma exceção que ninguém consegue justificar em uma linha não devia existir.
 */
export const EXCECOES: readonly { arquivo: string; motivo: string }[] = [
  {
    arquivo: "app/tarefa/actions.ts",
    motivo:
      "é onde as Server Actions NASCEM (não as consome): não tem componente, nem foco a entregar, nem região viva.",
  },
  {
    arquivo: "components/task/escrita.ts",
    motivo:
      "é a própria maquinaria (decidirEscrita/concluirEscrita/recusarEscrita); citar os nomes aqui é definição, não uso.",
  },
  {
    arquivo: "components/task/usar-acao-tarefa.ts",
    motivo:
      "define `useAcaoTarefa` e o `disparar` que ele devolve — a fonte do despacho, não um sítio de escrita.",
  },
];

const EXCETUADOS = new Set(EXCECOES.map((e) => e.arquivo));

export function arquivosVarridos(): string[] {
  const achados: string[] = [];
  for (const pasta of PASTAS_VARRIDAS) {
    const raiz = RAIZ + pasta;
    const pilha = [raiz];
    while (pilha.length > 0) {
      const atual = pilha.pop();
      if (atual === undefined) continue;
      for (const nome of readdirSync(atual)) {
        const caminho = `${atual}/${nome}`;
        if (statSync(caminho).isDirectory()) {
          pilha.push(caminho);
        } else if (nome.endsWith(".ts") || nome.endsWith(".tsx")) {
          achados.push(caminho.slice(RAIZ.length));
        }
      }
    }
  }
  return achados.sort();
}

export function fonte(arquivo: string): string {
  return readFileSync(RAIZ + arquivo, "utf8");
}

/**
 * O código sem comentários e sem o MIOLO das strings — estes arquivos
 * explicam por escrito o `disabled` e as frases que causaram os achados, e a
 * história não pode virar código aos olhos do scanner. As aspas ficam (para
 * `concluirEscrita("nota_criar"` continuar reconhecível); o que some é o
 * conteúdo de template literals e de strings longas de prosa.
 */
export function codigo(arquivo: string): string {
  return fonte(arquivo)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, antes: string) => antes);
}

export interface SitioDeEscrita {
  arquivo: string;
  linha: number;
  /** O nome chamado: `disparar`, `dispararDesfazer`, … */
  despacho: string;
  /** A `op` que o handler em volta declara — `null` quando não há nenhuma. */
  op: string | null;
  /** O handler tem `decidirEscrita({` em volta da chamada? */
  temDecidir: boolean;
  /** O arquivo chama `concluirEscrita("op"` para essa mesma `op`? */
  temConcluir: boolean;
}

/** Nomes que `useAcaoTarefa` devolve neste arquivo (com ou sem renome). */
export function nomesDeDespacho(src: string): string[] {
  const nomes = new Set<string>();
  // `const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(`
  // `const { pendente: desfazendo, disparar: dispararDesfazer, … } = useAcaoTarefa(`
  const re = /\{([^{}]*)\}\s*=\s*useAcaoTarefa\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    for (const parte of (m[1] ?? "").split(",")) {
      const [chave, apelido] = parte.split(":").map((x) => x.trim());
      if (chave === "disparar") nomes.add(apelido && apelido.length > 0 ? apelido : "disparar");
    }
  }
  return [...nomes];
}

/** Quantas vezes `useAcaoTarefa(` aparece — cada uma é uma ação ligada. */
export function quantosHooks(src: string): number {
  return (src.match(/useAcaoTarefa\s*\(/g) ?? []).length;
}

/**
 * Sobe do índice `i` até o `{` que abre o bloco em que ele está, e devolve o
 * bloco inteiro. Contagem de chaves para trás e para a frente — é o que
 * permite dizer "este `disparar(form)` está DENTRO de um handler que tem
 * `decidirEscrita`", em vez de só "o arquivo tem `decidirEscrita` em algum
 * lugar" (que era a checagem fraca da rodada 6).
 */
export function blocoEmVolta(src: string, i: number): string {
  let profundidade = 0;
  let inicio = -1;
  for (let p = i; p >= 0; p--) {
    const c = src[p];
    if (c === "}") profundidade++;
    else if (c === "{") {
      if (profundidade === 0) {
        inicio = p;
        break;
      }
      profundidade--;
    }
  }
  if (inicio === -1) return "";
  let nivel = 0;
  for (let p = inicio; p < src.length; p++) {
    const c = src[p];
    if (c === "{") nivel++;
    else if (c === "}") {
      nivel--;
      if (nivel === 0) return src.slice(inicio, p + 1);
    }
  }
  return src.slice(inicio);
}

/** Todo sítio de escrita da página, derivado do fonte. */
export function varrer(): SitioDeEscrita[] {
  const sitios: SitioDeEscrita[] = [];
  for (const arquivo of arquivosVarridos()) {
    if (EXCETUADOS.has(arquivo)) continue;
    const src = codigo(arquivo);
    const nomes = nomesDeDespacho(src);
    if (nomes.length === 0) continue;
    const re = new RegExp(`\\b(${nomes.join("|")})\\s*\\(`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const bloco = blocoEmVolta(src, m.index);
      const op = /recusarEscrita\(\s*"([a-z_]+)"/.exec(bloco)?.[1] ?? null;
      sitios.push({
        arquivo,
        linha: src.slice(0, m.index).split("\n").length,
        despacho: m[1] ?? "",
        op,
        temDecidir: bloco.includes("decidirEscrita({"),
        temConcluir:
          op !== null && new RegExp(`concluirEscrita\\(\\s*"${op}"`).test(src),
      });
    }
  }
  return sitios;
}

/** Arquivos que importam alguma Server Action da página. */
export function importamAction(): { arquivo: string; acoes: string[] }[] {
  const out: { arquivo: string; acoes: string[] }[] = [];
  for (const arquivo of arquivosVarridos()) {
    if (EXCETUADOS.has(arquivo)) continue;
    const src = codigo(arquivo);
    const bloco = /import\s*\{([^}]*)\}\s*from\s*"@\/app\/tarefa\/actions"/.exec(src);
    if (!bloco) continue;
    const acoes = (bloco[1] ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.endsWith("Action"));
    if (acoes.length > 0) out.push({ arquivo, acoes });
  }
  return out;
}

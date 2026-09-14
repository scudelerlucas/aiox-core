/**
 * OS-LIFEBOARD · P5 — rodada 9. A GUARDA do componente da linha do tempo,
 * agora por ANÁLISE SINTÁTICA do arquivo, não por varredura de string.
 *
 * Por que existe (achado MÉDIO A3 da rodada 9): a guarda de duas camadas da
 * rodada 7 foi furada pelo crítico com nove mutantes. Quatro deles derrubaram
 * ZERO testes dos 1027:
 *
 * | mutante | testes que caíam |
 * |---|---|
 * | `rolarESincronizar` devolve o destino já clampado, sem reler | 0 |
 * | `el.scrollTo({ left: 0 })` num `useEffect` | 0 |
 * | `el[chave] = 0` (colchete) num `useEffect` | 0 |
 * | chama o módulo e DESCARTA o retorno | 0 |
 *
 * A camada 1 era burlada porque o componente pode CHAMAR o módulo e jogar o
 * retorno fora (nada é aplicado ao DOM, e nenhum teste de unidade do módulo
 * percebe). A camada 2 era burlada porque ela procurava a string `.scrollLeft =`
 * — e `el[chave] = 0`, `el.scrollTo(...)` e a chamada-com-retorno-descartado
 * não têm essa string. Materialidade medida em build de produção: o cabeçalho
 * ficava −493,2px, −665,2px e −186,0px adiantado das barras; no build limpo,
 * 0,00px em 72 de 72 combos.
 *
 * Esta análise lê a ÁRVORE do arquivo (TypeScript compiler API, já instalado)
 * e responde três perguntas que string nenhuma responde:
 *
 * 1. Alguém ESCREVE em scroll? — qualquer atribuição a `x.scrollLeft` /
 *    `x.scrollTop` **e** qualquer atribuição por COLCHETE (`x[k] = v`), que é
 *    a forma de dizer a mesma coisa sem escrever o nome.
 * 2. Alguém ROLA por fora do módulo? — `.scrollTo(` / `.scrollBy(` /
 *    `.scrollIntoView(` em qualquer receptor que não seja `window`
 *    (`window.scrollBy` é o caminho legítimo da folha inferior).
 * 3. Alguém CHAMA o módulo e joga o retorno fora? — chamada às portas puras
 *    cujo resultado não é usado por ninguém (`ExpressionStatement` solto).
 * 4. Alguém ESCREVE geometria no DOM? — qualquer `x.style.<algo> = …` dentro
 *    do componente (a forma em que o mutante do achado ALTO A1 se escondia).
 *
 * PURA: recebe o TEXTO do arquivo, devolve achados. Sem `fs`, sem `window`.
 * Vive em `tests/` (é infraestrutura de guarda, não código de produto) —
 * mesma casa de `cenarios-do-grafo.ts` e `tarefa-varredura-derivada.ts`.
 * O teste é quem lê o arquivo e quem alimenta os mutantes por extenso.
 */
import ts from "typescript";

/** As portas puras cujo retorno o componente é OBRIGADO a usar. */
export const PORTAS_PURAS: readonly string[] = [
  "rolarESincronizar",
  "aoRedimensionar",
  "lerSincronizacao",
  "scrollParaRevelar",
  "planoDaFolhaInferior",
  "posicaoDoChipGrudado",
];

/** Métodos de rolagem do DOM que o componente não pode chamar num elemento. */
const METODOS_DE_ROLAGEM: readonly string[] = ["scrollTo", "scrollBy", "scrollIntoView"];

/** Propriedades de scroll que o componente não pode escrever. */
const PROPRIEDADES_DE_SCROLL: readonly string[] = ["scrollLeft", "scrollTop"];

export type TipoDeAchado =
  | "escrita-em-scroll"
  | "escrita-por-colchete"
  | "escrita-de-estilo"
  | "rolagem-fora-do-modulo"
  | "retorno-descartado";

export interface AchadoDeFonte {
  tipo: TipoDeAchado;
  /** O trecho exato do código, para o teste dizer ONDE, não só QUE. */
  trecho: string;
  linha: number;
}

function ehOperadorDeAtribuicao(k: ts.SyntaxKind): boolean {
  return (
    k === ts.SyntaxKind.EqualsToken ||
    k === ts.SyntaxKind.PlusEqualsToken ||
    k === ts.SyntaxKind.MinusEqualsToken ||
    k === ts.SyntaxKind.AsteriskEqualsToken ||
    k === ts.SyntaxKind.SlashEqualsToken
  );
}

/**
 * Analisa o TEXTO de um `.tsx`/`.ts` e devolve todos os achados. Nunca lança:
 * o parser do TypeScript é tolerante a erro por construção, e um arquivo que
 * não parseia devolve lista vazia (quem reprova aí é o `tsc`, não esta guarda).
 */
export function analisarFonteDoPainel(codigo: string, nomeDoArquivo = "alvo.tsx"): AchadoDeFonte[] {
  const achados: AchadoDeFonte[] = [];
  const fonte = ts.createSourceFile(
    nomeDoArquivo,
    codigo,
    ts.ScriptTarget.Latest,
    true,
    nomeDoArquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const registrar = (tipo: TipoDeAchado, no: ts.Node): void => {
    achados.push({
      tipo,
      trecho: no.getText(fonte).replace(/\s+/g, " ").slice(0, 120),
      linha: fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1,
    });
  };
  const nomeDoReceptor = (no: ts.Expression): string =>
    ts.isIdentifier(no) ? no.text : no.getText(fonte);

  const visitar = (no: ts.Node): void => {
    // (1) e (1b): atribuições.
    if (ts.isBinaryExpression(no) && ehOperadorDeAtribuicao(no.operatorToken.kind)) {
      const alvo = no.left;
      if (ts.isPropertyAccessExpression(alvo) && PROPRIEDADES_DE_SCROLL.includes(alvo.name.text)) {
        registrar("escrita-em-scroll", no);
      }
      // `el[chave] = 0` — a mesma escrita, escrita de outro jeito. O
      // componente não tem nenhuma atribuição por colchete legítima; qualquer
      // uma é, por definição, uma porta lateral para o DOM.
      if (ts.isElementAccessExpression(alvo)) {
        registrar("escrita-por-colchete", no);
      }
      // `el.style.height = "0px"` / `ticks.style.transform = ...` — geometria
      // escrita DENTRO do componente. Foi assim que o mutante "não reserva
      // espaço abaixo da última linha" (achado ALTO A1) derrubou 0 testes: a
      // escrita vivia num `useEffect`, onde teste de unidade sem DOM não
      // alcança. Agora quem escreve são `aplicarPlanoDaFolha` e
      // `aplicarTransformDoCabecalho` (puros, com o elemento injetado, e
      // testados) — no componente, nenhuma.
      if (
        ts.isPropertyAccessExpression(alvo) &&
        ts.isPropertyAccessExpression(alvo.expression) &&
        alvo.expression.name.text === "style"
      ) {
        registrar("escrita-de-estilo", no);
      }
    }
    // (2): chamadas de rolagem no elemento (nunca em `window`).
    if (
      ts.isCallExpression(no) &&
      ts.isPropertyAccessExpression(no.expression) &&
      METODOS_DE_ROLAGEM.includes(no.expression.name.text) &&
      nomeDoReceptor(no.expression.expression) !== "window"
    ) {
      registrar("rolagem-fora-do-modulo", no);
    }
    // (3): chamada a uma porta pura com o retorno jogado fora.
    if (
      ts.isCallExpression(no) &&
      ts.isIdentifier(no.expression) &&
      PORTAS_PURAS.includes(no.expression.text) &&
      no.parent !== undefined &&
      ts.isExpressionStatement(no.parent)
    ) {
      registrar("retorno-descartado", no);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

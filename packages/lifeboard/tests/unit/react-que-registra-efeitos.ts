/**
 * OS-LIFEBOARD · P4i — o React de mentira que registra `useEffect` de verdade.
 *
 * Não é arquivo de teste (nenhum `describe`) e **não é um simulador do
 * produto** — é o achado ALTO #1 da rodada 8 levado a sério. O que ele finge é
 * o REACT (que este ambiente não tem: sem jsdom, sem testing-library); o que
 * ele mede é o código de produção chamado como função, com a lista de
 * dependências que o próprio código entrega ao `useEffect`.
 *
 * É essa diferença que fecha o buraco: a rodada 8 protegia uma função PURA
 * (`dependenciasDoReenquadramento`), e uma mutação que somasse `enquadrar`
 * direto no `useEffect` do hook passava invisível pelos 1354 testes. Aqui o
 * que o teste lê é o array que chegou ao `useEffect`, venha de onde vier.
 *
 * O `vi.mock("react", …)` mora no arquivo de teste, que é onde o vitest
 * consegue içá-lo antes do import do módulo sob teste.
 */

export interface EfeitoVisto {
  fn: () => void | (() => void);
  deps: readonly unknown[] | undefined;
}

export interface Montagem {
  refs: { current: unknown }[];
  /** Todo `useEffect` do último render, na ordem em que o código os chamou. */
  efeitos: EfeitoVisto[];
  /** Deps do render anterior, por posição — para decidir se o efeito roda. */
  anteriores: (readonly unknown[] | undefined)[];
  limpezas: ((() => void) | null)[];
  /** Quantas vezes CADA efeito rodou de fato desde a montagem. */
  execucoes: number[];
}

let viva: Montagem | null = null;
let iRef = 0;
let iEfeito = 0;

export function novaMontagem(): Montagem {
  return { refs: [], efeitos: [], anteriores: [], limpezas: [], execucoes: [] };
}

function atual(): Montagem {
  if (viva === null) throw new Error("nenhum hook montado (use `renderizar`)");
  return viva;
}

/** O objeto que substitui `react` — passar para `vi.mock("react", …)`. */
export const reactQueRegistra = {
  useRef: (inicial: unknown): { current: unknown } => {
    const m = atual();
    const k = iRef++;
    m.refs[k] ??= { current: inicial };
    return m.refs[k] as { current: unknown };
  },
  useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]): void => {
    const m = atual();
    const k = iEfeito++;
    m.efeitos[k] = { fn, deps };
    const antes = m.anteriores[k];
    const mudou =
      deps === undefined ||
      antes === undefined ||
      antes.length !== deps.length ||
      deps.some((d, i) => !Object.is(d, antes[i]));
    m.anteriores[k] = deps;
    m.execucoes[k] ??= 0;
    if (!mudou) return;
    const limpar = m.limpezas[k];
    if (typeof limpar === "function") limpar();
    const devolvido = fn();
    m.limpezas[k] = typeof devolvido === "function" ? devolvido : null;
    m.execucoes[k] += 1;
  },
  useState: (inicial: unknown): [unknown, (v: unknown) => void] => [inicial, () => undefined],
  useCallback: (fn: unknown): unknown => fn,
  useMemo: (fn: () => unknown): unknown => fn(),
};

/** Um render: chama o hook com a MESMA montagem, como o React re-renderizando. */
export function renderizar<P, R>(montagem: Montagem, hook: (props: P) => R, props: P): R {
  viva = montagem;
  iRef = 0;
  iEfeito = 0;
  montagem.efeitos = [];
  try {
    return hook(props);
  } finally {
    viva = null;
  }
}

/** A lista de dependências do k-ésimo `useEffect` do último render. */
export function depsDoEfeito(
  montagem: Montagem,
  k: number,
): readonly unknown[] | undefined {
  const visto = montagem.efeitos[k];
  if (visto === undefined) throw new Error(`nenhum useEffect nº ${String(k)} neste render`);
  return visto.deps;
}

/** Quantas vezes o k-ésimo efeito rodou desde a montagem. */
export function execucoesDoEfeito(montagem: Montagem, k: number): number {
  return montagem.execucoes[k] ?? 0;
}

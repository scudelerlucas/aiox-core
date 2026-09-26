import { vi } from "vitest";

/**
 * OS-LIFEBOARD · P6 — OS HOOKS FALSOS, COM UMA INSTÂNCIA POR COMPONENTE.
 *
 * [rodada 11] `tarefa-porta-de-escrita.test.ts` já trocava o React por um
 * mock, mas com UM conjunto global de estados: dá para uma porta, não dá para
 * uma tela com três componentes e cinco portas. Aqui cada montagem tem a sua
 * `Instancia` (estados, refs, timers), e re-renderizar é chamar a função de
 * novo com a MESMA instância — que é o que faz `setState` ter efeito
 * observável, como no React de verdade.
 */

export interface Instancia {
  estados: unknown[];
  refs: { current: unknown }[];
  efeitos: (() => void)[];
}

let atual: Instancia | null = null;
let iEstado = 0;
let iRef = 0;

export function novaInstancia(): Instancia {
  return { estados: [], refs: [], efeitos: [] };
}

function viva(): Instancia {
  if (atual === null) throw new Error("nenhum componente montado (use `montar`)");
  return atual;
}

/** O objeto que substitui `react` — passar para `vi.mock("react", …)`. */
export const reactFalso = {
  useState: (inicial: unknown): [unknown, (v: unknown) => void] => {
    const inst = viva();
    const k = iEstado++;
    if (!(k in inst.estados)) {
      inst.estados[k] = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
    }
    return [
      inst.estados[k],
      (v: unknown): void => {
        inst.estados[k] =
          typeof v === "function" ? (v as (p: unknown) => unknown)(inst.estados[k]) : v;
      },
    ];
  },
  useRef: (inicial: unknown): { current: unknown } => {
    const inst = viva();
    const k = iRef++;
    inst.refs[k] ??= { current: inicial };
    return inst.refs[k] as { current: unknown };
  },
  useTransition: (): [boolean, (fn: () => void) => void] => [
    false,
    (fn: () => void): void => {
      fn();
    },
  ],
  /** Roda o efeito na hora (nada aqui depende de ordem de commit). */
  useEffect: (fn: () => void | (() => void)): void => {
    const inst = viva();
    inst.efeitos.push(() => {
      fn();
    });
  },
  useCallback: (fn: unknown): unknown => fn,
  useMemo: (fn: () => unknown): unknown => fn(),
};

/**
 * Monta (ou re-monta) um componente com a instância dada e devolve a árvore.
 * Os efeitos registrados no render rodam ao final, como no React.
 */
export function montar<P, R>(
  instancia: Instancia,
  componente: (props: P) => R,
  props: P,
): R {
  atual = instancia;
  iEstado = 0;
  iRef = 0;
  instancia.efeitos = [];
  const arvore = componente(props);
  const efeitos = [...instancia.efeitos];
  atual = null;
  for (const e of efeitos) e();
  return arvore;
}

export interface TimerFalso {
  id: number;
  ms: number;
  fn: () => void;
  cancelado: boolean;
}

/**
 * `window` mínimo: timers observáveis + `sessionStorage` de mentira +
 * `addEventListener`/`removeEventListener`.
 *
 * [rodada 13] Os dois últimos entraram quando os testes passaram a deixar uma
 * gravação EM VOO entre dois renders (é assim que se mede "o que o operador
 * digita durante a gravação"): com `pendente` verdadeiro, `useAvisoDeSaida`
 * registra o `beforeunload` de verdade, e a janela falsa não tinha onde.
 */
export function janelaFalsa(): {
  timers: TimerFalso[];
  deposito: Map<string, string>;
  ouvintes: Map<string, Set<(e: unknown) => void>>;
  rodarTimer: (ms: number) => void;
} {
  const timers: TimerFalso[] = [];
  const deposito = new Map<string, string>();
  const ouvintes = new Map<string, Set<(e: unknown) => void>>();
  let proximo = 1;
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (fn: () => void, ms: number): number => {
      const id = proximo++;
      timers.push({ id, ms, fn, cancelado: false });
      return id;
    },
    clearTimeout: (id: number): void => {
      const t = timers.find((x) => x.id === id);
      if (t) t.cancelado = true;
    },
    addEventListener: (nome: string, fn: (e: unknown) => void): void => {
      const atuais = ouvintes.get(nome) ?? new Set<(e: unknown) => void>();
      atuais.add(fn);
      ouvintes.set(nome, atuais);
    },
    removeEventListener: (nome: string, fn: (e: unknown) => void): void => {
      ouvintes.get(nome)?.delete(fn);
    },
    sessionStorage: {
      getItem: (k: string): string | null => deposito.get(k) ?? null,
      setItem: (k: string, v: string): void => {
        deposito.set(k, v);
      },
      removeItem: (k: string): void => {
        deposito.delete(k);
      },
    },
  };
  return {
    timers,
    deposito,
    ouvintes,
    rodarTimer: (ms: number): void => {
      const t = timers.filter((x) => x.ms === ms && !x.cancelado).pop();
      if (t === undefined) throw new Error(`nenhum timer de ${String(ms)}ms armado`);
      t.cancelado = true;
      t.fn();
    },
  };
}

/** Esvazia os mocks entre testes (vitest não limpa o `atual` sozinho). */
export function soltarInstancia(): void {
  atual = null;
  vi.clearAllMocks();
}

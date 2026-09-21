import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  depsDoEfeito,
  execucoesDoEfeito,
  novaMontagem,
  reactQueRegistra,
  renderizar,
  type Montagem,
} from "./react-que-registra-efeitos";

vi.mock("react", () => reactQueRegistra);

const {
  ATRASO_DO_REENQUADRAMENTO_MS,
  LIMIAR_DE_REENQUADRAMENTO_PX,
  mudancaMaterialDeTamanho,
  tamanhoQueDisparou,
  useReenquadramentoAutomatico,
} = await import("@/components/graph/reenquadramento-automatico");

/**
 * OS-LIFEBOARD · P4i — **o gesto do operador é soberano**, e a guarda mede o
 * código que roda no produto.
 *
 * Achado ALTO #1 da rodada 8: a suíte que protegia isto rodava contra um
 * simulador de canvas escrito pela própria correção anterior, e a única coisa
 * que ela protegia era uma função PURA (`dependenciasDoReenquadramento`).
 * Somar `enquadrar` direto no `useEffect` do hook — a mutação que devolve o
 * defeito crítico inteiro — passava invisível por 1354 testes.
 *
 * Aqui o hook de produção é chamado como função, com o React trocado por um
 * registrador (`react-que-registra-efeitos.ts`), e o que se lê é **a lista que
 * chegou ao `useEffect`**, venha da função pura ou de um array escrito à mão.
 *
 * Achado ALTO #2 da rodada 8: com o zoom no teto (1,8), **2 px** de
 * redimensionamento devolviam o canvas ao enquadramento (0,849) nas quatro
 * larguras de desktop — e a suíte anterior afirmava isso como desejado. A
 * régua agora é materialidade.
 *
 * O que só o navegador prova (trilha de zoom de 6 cliques, modo CARTÃO, os
 * px de "Hoje"): `scripts/guarda-no-navegador.mjs`.
 */

interface TimerFalso {
  id: number;
  ms: number;
  fn: () => void;
  vivo: boolean;
}

let timers: TimerFalso[] = [];

function armarJanela(): void {
  timers = [];
  let proximo = 1;
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (fn: () => void, ms: number): number => {
      const id = proximo++;
      timers.push({ id, ms, fn, vivo: true });
      return id;
    },
    clearTimeout: (id: number): void => {
      const t = timers.find((x) => x.id === id);
      if (t) t.vivo = false;
    },
  };
}

/** Roda os timers pendentes do atraso do reenquadramento. */
function correrOTempo(): void {
  for (const t of timers.filter((x) => x.vivo && x.ms === ATRASO_DO_REENQUADRAMENTO_MS)) {
    t.vivo = false;
    t.fn();
  }
}

interface Pane {
  largura: number;
  altura: number;
  colunas: number;
}

/** Uma montagem viva do hook de produção, com contagem de enquadramentos. */
function montarHook(
  inicial: Pane,
  opcoes: { medido?: boolean } = {},
): {
  montagem: Montagem;
  enquadramentos: () => number;
  render: (pane?: Partial<Pane> & { filtro?: string; novaFuncao?: boolean; medido?: boolean }) => void;
} {
  armarJanela();
  const montagem = novaMontagem();
  let aplicados = 0;
  let pane = inicial;
  let filtro = "";
  let medido = opcoes.medido !== false;
  let enquadrar = (): void => {
    aplicados += 1;
  };

  const render = (
    mudanca:
      | (Partial<Pane> & { filtro?: string; novaFuncao?: boolean; medido?: boolean })
      | undefined = undefined,
  ): void => {
    if (mudanca?.medido !== undefined) medido = mudanca.medido;
    if (mudanca?.largura !== undefined) pane = { ...pane, largura: mudanca.largura };
    if (mudanca?.altura !== undefined) pane = { ...pane, altura: mudanca.altura };
    if (mudanca?.colunas !== undefined) pane = { ...pane, colunas: mudanca.colunas };
    if (mudanca?.filtro !== undefined) filtro = mudanca.filtro;
    if (mudanca?.novaFuncao === true) {
      // É isto que o MODO do cartão fazia a cada cruzamento de 0,85: uma
      // identidade nova de `enquadrar`, sem nada do mundo ter mudado.
      enquadrar = (): void => {
        aplicados += 1;
      };
    }
    renderizar(montagem, useReenquadramentoAutomatico, {
      nodesInitialized: medido,
      assinaturaDoFiltro: filtro,
      larguraDoPane: pane.largura,
      alturaDoPane: pane.altura,
      colunasDoLayout: pane.colunas,
      enquadrar,
      alvo: "tudo" as const,
    });
    correrOTempo();
  };

  render();
  return { montagem, enquadramentos: () => aplicados, render };
}

/** As quatro larguras de desktop que o crítico mediu, com o pane real. */
const DESKTOP: { nome: string; pane: Pane }[] = [
  { nome: "1024×800", pane: { largura: 1024, altura: 607, colunas: 6 } },
  { nome: "1280×800", pane: { largura: 1280, altura: 607, colunas: 6 } },
  { nome: "1440×900", pane: { largura: 1440, altura: 707, colunas: 6 } },
  { nome: "1920×1080", pane: { largura: 1920, altura: 887, colunas: 6 } },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a lista que chega ao useEffect DE VERDADE (achado ALTO #1)", () => {
  it("nenhuma dependência é função — nem pela função pura, nem escrita à mão", () => {
    const { montagem } = montarHook(DESKTOP[1]!.pane);
    const deps = depsDoEfeito(montagem, 0);
    expect(deps).toBeDefined();
    for (const d of deps ?? []) expect(typeof d).not.toBe("function");
  });

  it("a lista tem exatamente os 5 gatilhos do MUNDO, e nenhum a mais", () => {
    const { montagem } = montarHook(DESKTOP[1]!.pane);
    expect(depsDoEfeito(montagem, 0)).toEqual([true, "", 1280, 607, 6]);
  });

  it("nada é enquadrado antes de o ReactFlow ter medido os nós", () => {
    const { enquadramentos, render } = montarHook(DESKTOP[1]!.pane, { medido: false });
    // Enquadrar aqui era enquadrar o vazio: os nós ainda têm 0×0 e a caixa
    // resultante não é a do grafo.
    expect(enquadramentos()).toBe(0);
    render({ largura: 390, colunas: 3 });
    expect(enquadramentos()).toBe(0);
    render({ medido: true, filtro: "gmail" });
    expect(enquadramentos()).toBe(1);
  });

  it("trocar só a identidade de `enquadrar` não roda o efeito (o defeito da rodada 8)", () => {
    const { montagem, enquadramentos, render } = montarHook(DESKTOP[2]!.pane);
    const antes = enquadramentos();
    for (let i = 0; i < 6; i++) render({ novaFuncao: true });
    expect(enquadramentos()).toBe(antes);
    expect(execucoesDoEfeito(montagem, 0)).toBe(1);
  });
});

describe("2 px de resize não apagam o gesto do operador (achado ALTO #2)", () => {
  for (const { nome, pane } of DESKTOP) {
    it(`${nome}: −2 px de largura não reenquadra`, () => {
      const { enquadramentos, render } = montarHook(pane);
      const antes = enquadramentos();
      render({ largura: pane.largura - 2 });
      expect(enquadramentos()).toBe(antes);
    });

    it(`${nome}: a barra de rolagem (−15 px) e o acerto de dvh (−4 px) também não`, () => {
      const { enquadramentos, render } = montarHook(pane);
      const antes = enquadramentos();
      render({ largura: pane.largura - 15 });
      render({ altura: pane.altura - 4 });
      expect(enquadramentos()).toBe(antes);
    });
  }

  it("mas um resize DE VERDADE ainda reenquadra", () => {
    const { enquadramentos, render } = montarHook(DESKTOP[1]!.pane);
    const antes = enquadramentos();
    render({ largura: 390, colunas: 3 });
    expect(enquadramentos()).toBe(antes + 1);
  });

  it("mudar o número de COLUNAS reenquadra, mesmo com 1 px de largura", () => {
    const { enquadramentos, render } = montarHook({ largura: 1024, altura: 607, colunas: 6 });
    const antes = enquadramentos();
    render({ largura: 1023, colunas: 4 });
    expect(enquadramentos()).toBe(antes + 1);
  });

  it("trocar o filtro de fontes continua reenquadrando", () => {
    const { enquadramentos, render } = montarHook(DESKTOP[1]!.pane);
    const antes = enquadramentos();
    render({ filtro: "calendar,gmail" });
    expect(enquadramentos()).toBe(antes + 1);
  });
});

describe("a régua de materialidade, medida direto", () => {
  const base = { largura: 1280, altura: 607, colunas: 6 };

  it("ruído abaixo do limiar não é material; o limiar exato é", () => {
    expect(mudancaMaterialDeTamanho(base, { ...base, largura: 1282 })).toBe(false);
    expect(
      mudancaMaterialDeTamanho(base, {
        ...base,
        largura: base.largura + LIMIAR_DE_REENQUADRAMENTO_PX,
      }),
    ).toBe(true);
  });

  it("a deriva de 2 px acumula contra o último tamanho que DISPAROU", () => {
    let latch = tamanhoQueDisparou(null, base);
    for (let i = 1; i <= 23; i++) {
      latch = tamanhoQueDisparou(latch, { ...base, largura: base.largura + i * 2 });
    }
    // 46 px acumulados: ainda o tamanho original.
    expect(latch.largura).toBe(base.largura);
    latch = tamanhoQueDisparou(latch, { ...base, largura: base.largura + 48 });
    expect(latch.largura).toBe(base.largura + 48);
  });

  it("o limiar é maior que a barra de rolagem e que o teaser da faixa de baixo", () => {
    expect(LIMIAR_DE_REENQUADRAMENTO_PX).toBeGreaterThan(15);
    expect(LIMIAR_DE_REENQUADRAMENTO_PX).toBeGreaterThanOrEqual(44);
  });
});

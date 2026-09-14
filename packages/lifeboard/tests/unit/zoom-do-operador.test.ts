import { describe, expect, it } from "vitest";

import { ZOOM_DO_MODO_MAPA } from "@/components/graph/tipografia-do-cartao";
import {
  dependenciasDoReenquadramento,
  type GatilhoDoReenquadramento,
} from "@/components/graph/reenquadramento-automatico";
import { ZOOM_MAXIMO_DO_CANVAS } from "@/components/graph/dependency-graph";
import { alturaDoCanvasDoGrafo } from "@/lib/altura-do-canvas";
import { CanvasSimulado } from "./simulador-do-canvas";
import { grafo40 } from "./cenarios-do-grafo";

/**
 * OS-LIFEBOARD · P4h — achado CRÍTICO #1 do crítico hostil ROUND 8: **o grafo
 * não pode ser aproximado, e o modo CARTÃO nunca existe no produto.**
 *
 * Medido por ele na rota real: a 1440×900 o zoom subia de 0,7997 para 0,9597 e
 * voltava para 0,7997 em menos de 400ms — seis cliques, seis vezes; a roda do
 * mouse idem. Em 7 de 7 sondagens (390/768/1024/1280/1440 × 11/40/200) o modo
 * era SEMPRE mapa. Os 180px do cartão, o S, o A, a folga, o chip de estado e
 * toda a decisão D4 da rodada 6 não existiam para o operador.
 *
 * E 1098 de 1098 testes passavam com e sem a correção: NENHUM teste via isto.
 * Este arquivo é o que faltava — ele mede o zoom que o operador ALCANÇA.
 */

const PANE_1280 = {
  largura: 1280,
  altura: alturaDoCanvasDoGrafo({ larguraDaJanela: 1280, alturaDaJanela: 800 }),
};
const PANE_1440 = {
  largura: 1440,
  altura: alturaDoCanvasDoGrafo({ larguraDaJanela: 1440, alturaDaJanela: 900 }),
};

function seisCliques(pane: { largura: number; altura: number }): number[] {
  const canvas = new CanvasSimulado({ cenario: grafo40(), pane, alvo: "tudo" }).montar();
  canvas.clicarEnquadrar("tudo");
  const trilha = [canvas.zoom];
  for (let i = 0; i < 6; i++) trilha.push(canvas.aumentarZoom());
  return trilha;
}

describe("o gesto do operador é soberano (achado CRÍTICO #1)", () => {
  it("1280: seis cliques em 'Aumentar zoom' SOBEM o zoom, e nenhum deles é desfeito", () => {
    const trilha = seisCliques(PANE_1280);
    for (let i = 1; i < trilha.length; i++) {
      // O falsificador: com `enquadrar` nas dependências, cada cruzamento de
      // 0,85 devolvia o zoom ao enquadramento — e esta desigualdade quebra.
      expect(trilha[i]!).toBeGreaterThan(trilha[i - 1]! - 1e-9);
    }
    expect(trilha[6]!).toBeGreaterThan(trilha[0]!);
    expect(trilha[6]!).toBeCloseTo(ZOOM_MAXIMO_DO_CANVAS, 6);
  });

  it("1440: idem — e o zoom chega ao TETO do canvas, não ao enquadramento", () => {
    const trilha = seisCliques(PANE_1440);
    for (let i = 1; i < trilha.length; i++) {
      expect(trilha[i]!).toBeGreaterThan(trilha[i - 1]! - 1e-9);
    }
    expect(trilha[6]!).toBeCloseTo(ZOOM_MAXIMO_DO_CANVAS, 6);
  });

  it("o modo CARTÃO existe e tem caminho até ele: 2 cliques bastam, em 1280 e em 1440", () => {
    for (const pane of [PANE_1280, PANE_1440]) {
      const canvas = new CanvasSimulado({ cenario: grafo40(), pane, alvo: "tudo" }).montar();
      canvas.clicarEnquadrar("tudo");
      expect(canvas.modo).toBe("mapa"); // é assim que ele nasce, com 40 tarefas
      let cliques = 0;
      while (canvas.modo !== "cartao" && cliques < 10) {
        canvas.aumentarZoom();
        cliques += 1;
      }
      // Chegou — e FICOU. O bug deixava chegar por ~400ms e desfazia.
      expect(canvas.modo).toBe("cartao");
      expect(canvas.zoom).toBeGreaterThanOrEqual(ZOOM_DO_MODO_MAPA);
      expect(cliques).toBeLessThanOrEqual(3);
      canvas.render();
      canvas.render();
      expect(canvas.modo).toBe("cartao");
      expect(canvas.zoom).toBeGreaterThanOrEqual(ZOOM_DO_MODO_MAPA);
    }
  });

  it("nenhum reenquadramento automático acontece por conta do zoom (nem 1)", () => {
    const canvas = new CanvasSimulado({
      cenario: grafo40(),
      pane: PANE_1280,
      alvo: "tudo",
    }).montar();
    const depoisDeMontar = canvas.reenquadramentos;
    for (let i = 0; i < 6; i++) canvas.aumentarZoom();
    expect(canvas.reenquadramentos).toBe(depoisDeMontar);
  });
});

describe("o que AINDA dispara o reenquadramento (a função não foi apagada)", () => {
  it("trocar o filtro de fontes reenquadra", () => {
    const canvas = new CanvasSimulado({
      cenario: grafo40(),
      pane: PANE_1280,
      alvo: "tudo",
    }).montar();
    canvas.aumentarZoom();
    canvas.aumentarZoom();
    const antes = canvas.reenquadramentos;
    canvas.trocarFiltro("calendar,gmail");
    expect(canvas.reenquadramentos).toBe(antes + 1);
  });

  it("redimensionar o painel reenquadra, e mantém o ALVO que o operador escolheu", () => {
    const canvas = new CanvasSimulado({
      cenario: grafo40(),
      pane: PANE_1280,
      alvo: "critico",
    }).montar();
    canvas.clicarEnquadrar("tudo");
    const antes = canvas.reenquadramentos;
    canvas.redimensionar({ largura: 390, altura: 480 });
    expect(canvas.reenquadramentos).toBe(antes + 1);
    expect(canvas.alvo).toBe("tudo");
  });
});

describe("a lista de dependências, medida diretamente", () => {
  const gatilho: GatilhoDoReenquadramento<"tudo"> = {
    nodesInitialized: true,
    assinaturaDoFiltro: "",
    larguraDoPane: 1280,
    alturaDoPane: 600,
    enquadrar: () => undefined,
    alvo: "tudo",
  };

  it("nenhuma dependência é função — função nasce nova a cada render", () => {
    for (const d of dependenciasDoReenquadramento(gatilho)) {
      expect(typeof d).not.toBe("function");
    }
  });

  it("duas chamadas com o MESMO mundo e `enquadrar` diferente dão deps iguais", () => {
    const a = dependenciasDoReenquadramento(gatilho);
    const b = dependenciasDoReenquadramento({ ...gatilho, enquadrar: () => undefined });
    expect(a.length).toBe(b.length);
    expect(a.every((v, i) => Object.is(v, b[i]))).toBe(true);
  });
});

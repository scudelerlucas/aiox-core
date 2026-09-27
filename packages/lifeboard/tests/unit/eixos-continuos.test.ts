/**
 * OS-LIFEBOARD · P4 rodada 17 — os eixos contínuos do produto dos gestos.
 *
 * O ALTO da rodada 17: o eixo do zoom de §22 tinha três valores escritos pela
 * guarda (enquadramento, piso, teto) e o operador para nos valores do MEIO —
 * dois cliques em "Aumentar zoom". A guarda passou a derivar os valores dos
 * GESTOS, com os fatores lidos da lib instalada. Este teste prova, sem
 * navegador: (1) os fatores saem do código da lib que o produto carrega, e
 * mudar a lib muda o eixo; (2) a sequência dos cliques contém os valores em
 * que o coordenador achou o defeito (1,223 e 1,467 a partir de 0,849); (3) o
 * plano do passeio visita toda sequência de cada partida, inclusive as que
 * voltam das pontas; (4) a trilha da largura tem os dois lados de cada corte;
 * (5) o veredito de um travamento de página nos quatro desfechos.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  cortesDeLarguraDoCodigo,
  gestosDoZoom,
  julgarTravamento,
  lerFatoresDoZoomDaLib,
  maiorVao,
  planoDoPasseioDoZoom,
  sequenciaDoGesto,
  trilhaDaLargura,
} from "../../scripts/eixos-continuos.mjs";

const requerer = createRequire(join(process.cwd(), "package.json"));
const principal = createRequire(requerer.resolve("reactflow")).resolve("@reactflow/core");
const raizDaLib = principal.slice(0, principal.lastIndexOf("@reactflow/core") + "@reactflow/core".length);
const fonteDoCore = readFileSync(join(raizDaLib, "dist", "esm", "index.mjs"), "utf8");
const fonteDoD3Zoom = readFileSync(join(dirname(createRequire(join(raizDaLib, "package.json")).resolve("d3-zoom")), "zoom.js"), "utf8");

const perto = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;

describe("os fatores de zoom saem da lib instalada", () => {
  it("lê o botão, a roda e o duplo clique do código que a página carrega", () => {
    const f = lerFatoresDoZoomDaLib({ fonteDoCore, fonteDoD3Zoom });
    expect(f.botao).toBe(1.2);
    expect(f.rodaPorPixel).toBe(0.002);
    expect(f.baseDaRoda).toBe(2);
    expect(f.duploCliqueDentro).toBe(2);
    expect(f.duploCliqueFora).toBe(0.5);
  });

  it("uma lib com outro fator dá outro eixo — o número não mora na guarda", () => {
    const outra = fonteDoCore.replace("d3Zoom.scaleBy(getD3Transition(d3Selection, options?.duration), 1.2)", "d3Zoom.scaleBy(getD3Transition(d3Selection, options?.duration), 1.5)").replace("1 / 1.2)", "1 / 1.5)");
    expect(lerFatoresDoZoomDaLib({ fonteDoCore: outra, fonteDoD3Zoom }).botao).toBe(1.5);
  });

  it("lib ilegível derruba com nome — nunca um fator inventado", () => {
    expect(() => lerFatoresDoZoomDaLib({ fonteDoCore: "nada", fonteDoD3Zoom })).toThrow(/zoomIn/);
    expect(() => lerFatoresDoZoomDaLib({ fonteDoCore, fonteDoD3Zoom: "nada" })).toThrow(/d3-zoom/);
  });
});

describe("a sequência dos cliques contém os valores do meio", () => {
  it("dois e três cliques a partir de 0,849 são 1,223 e 1,467 (onde a sabotagem do coordenador apagava o destaque)", () => {
    const seq = sequenciaDoGesto(0.849, 1.2, 0.5, 1.8);
    expect(seq.length).toBe(5);
    expect(perto(seq[1] ?? 0, 1.2226)).toBe(true);
    expect(perto(seq[2] ?? 0, 1.4671)).toBe(true);
    expect(seq.at(-1)).toBe(1.8);
  });

  it("o plano visita a partida, as duas pontas e as sequências que voltam delas, para cada gesto", () => {
    const gestos = gestosDoZoom(lerFatoresDoZoomDaLib({ fonteDoCore, fonteDoD3Zoom }), { botoes: true, roda: true, duploClique: true });
    const plano = planoDoPasseioDoZoom({
      partidas: [
        { acao: "caminho-critico", z: 0.849 },
        { acao: "ver-tudo", z: 0.659459 },
      ],
      piso: 0.5,
      teto: 1.8,
      gestos,
    });
    const tem = (z: number): boolean => plano.valores.some((v: number) => perto(v, z));
    for (const z of [0.849, 1.0188, 1.2226, 1.4671, 1.7605, 0.7075, 0.5896, 0.5, 1.8, 0.6, 0.72, 1.5, 1.25, 0.7391, 1.1487, 0.9, 1.698, 0.659459]) {
      expect(tem(z), `falta ${String(z)}`).toBe(true);
    }
    expect(plano.valores.length).toBeGreaterThanOrEqual(40);
    expect(maiorVao(plano.valores).vao).toBeLessThan(0.15);
  });

  it("partidas iguais não duplicam trechos, e a partida no piso também anda", () => {
    const gestos = [{ nome: "botão", dentro: 1.2, fora: 1 / 1.2 }];
    const plano = planoDoPasseioDoZoom({ partidas: [{ acao: "a", z: 0.5 }, { acao: "b", z: 0.5 }], piso: 0.5, teto: 1.8, gestos });
    expect(plano.partidas.length).toBe(1);
    expect(plano.valores.some((v: number) => perto(v, 0.6))).toBe(true);
    expect(plano.valores.some((v: number) => perto(v, 1.5))).toBe(true);
  });
});

describe("a trilha da largura", () => {
  const casos = [
    { largura: 1024, altura: 800 },
    { largura: 1280, altura: 800 },
    { largura: 1440, altura: 900 },
    { largura: 1920, altura: 1080 },
    { largura: 390, altura: 800 },
  ];
  it("tem os dois lados de cada corte do código e passos que não deixam faixa larga sem leitura", () => {
    const cortes = cortesDeLarguraDoCodigo(
      {
        "a.tsx": "function useEhMobile(larguraCorte = 1024)",
        "b.tsx": 'matchMedia("(min-width: 768px)")',
        "c.ts": "export const LARGURA_DO_DESKTOP_PX = 1100; if (window.innerWidth < LARGURA_DO_DESKTOP_PX) {}",
        "d.ts": "export const LARGURA_UTIL_DO_TITULO_PX = 174;",
      },
      { md: "48rem", xl: "1280px" },
    );
    expect(cortes.map((c: { px: number }) => c.px)).toEqual([768, 1024, 1100, 1280]);
    const trilha = trilhaDaLargura(casos, cortes, 32);
    const larguras = trilha.map((t: { largura: number }) => t.largura);
    for (const w of [767, 768, 1023, 1024, 1099, 1100, 1279, 1280, 390, 1920]) expect(larguras).toContain(w);
    for (let i = 1; i < larguras.length; i += 1) expect((larguras[i] ?? 0) - (larguras[i - 1] ?? 0)).toBeLessThanOrEqual(32);
    expect(trilha.find((t: { largura: number }) => t.largura === 1670)?.altura).toBe(986);
  });
});

describe("o veredito de um travamento de página", () => {
  const eh = (m: string): boolean => /crashed/i.test(m);
  it("a prova não travou → navegador", () => {
    expect(julgarTravamento({ primeiro: { memoriaMinimaMb: 100 }, prova: { erro: null, memoriaMinimaMb: 100 }, pisoMb: 512, ehTravamento: eh })).toBe("navegador");
  });
  it("travou de novo com a máquina sobrando memória → produto", () => {
    expect(julgarTravamento({ primeiro: { memoriaMinimaMb: 6000 }, prova: { erro: "Target crashed", memoriaMinimaMb: 5000 }, pisoMb: 512, ehTravamento: eh })).toBe("produto");
  });
  it("travou de novo com a máquina sem memória, ou sem como ler → máquina", () => {
    expect(julgarTravamento({ primeiro: { memoriaMinimaMb: 6000 }, prova: { erro: "Page crashed", memoriaMinimaMb: 300 }, pisoMb: 512, ehTravamento: eh })).toBe("maquina");
    expect(julgarTravamento({ primeiro: { memoriaMinimaMb: null }, prova: { erro: "Page crashed", memoriaMinimaMb: 6000 }, pisoMb: 512, ehTravamento: eh })).toBe("maquina");
  });
  it("a prova morreu de outro jeito → outro", () => {
    expect(julgarTravamento({ primeiro: { memoriaMinimaMb: 6000 }, prova: { erro: "Timeout 15000ms", memoriaMinimaMb: 6000 }, pisoMb: 512, ehTravamento: eh })).toBe("outro");
  });
});

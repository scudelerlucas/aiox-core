import { describe, expect, it } from "vitest";

import { MINIMO_DIST_ROTULO_PX, gerarEscalaEixo } from "@/core/timeline/eixo-rotulos";

/**
 * OS-LIFEBOARD · P5 — rodada 4 de correção do crítico hostil.
 *
 * Testa a ÚNICA função de posicionamento dos rótulos do eixo
 * (`core/timeline/eixo-rotulos.ts`, causa raiz "o eixo tem dono demais"):
 * gera horizontes variados (30/90/200/400 dias), "hoje" em várias posições
 * (início, meio, fim da janela, e sobre uma virada de ano) e as densidades
 * das 4 opções de zoom (`Auto` varia entre 6 e 64px/dia; `Semana` = 46 →
 * faixa "dia"; `Mês` = 16 → faixa "semana"; `Trimestre` = 6 → faixa "mes").
 * Afirma: nenhum par de rótulos a menos de `MINIMO_DIST_ROTULO_PX`, rótulo em
 * `x=0` sempre presente, rótulo de "hoje" sempre presente, ano presente ao
 * menos uma vez (garantido pelo chip de "hoje") e a cada virada de ano.
 */

const MS_POR_DIA = 86_400_000;

function somaDiasIso(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** As 4 densidades que o app de fato usa: Semana(46)→dia · Mês(16)→semana · Trimestre(6)→mes · uma amostra de "auto" no meio da faixa (24, o alvo) e nas pontas (6 piso, 64 teto). */
const PX_POR_DIA_DAS_4_OPCOES = [46, 16, 6, 24, 64] as const;
const HORIZONTES_DIAS = [30, 90, 200, 400] as const;
/** Posições de "hoje" dentro da janela, em fração do horizonte total. */
const FRACOES_HOJE = [0, 0.1, 0.4, 0.9, 1] as const;

const MIN_BASE = "2026-09-01";

describe("gerarEscalaEixo — nenhuma colisão entre rótulos (achado ALTO, rodada 4)", () => {
  for (const totalDias of HORIZONTES_DIAS) {
    for (const pxPorDia of PX_POR_DIA_DAS_4_OPCOES) {
      for (const fracaoHoje of FRACOES_HOJE) {
        const maxIso = somaDiasIso(MIN_BASE, totalDias);
        const hojeIso = somaDiasIso(MIN_BASE, Math.round(totalDias * fracaoHoje));

        it(`horizonte ${totalDias}d, ${pxPorDia}px/dia, hoje a ${Math.round(fracaoHoje * 100)}% — sem colisão, x=0 e "hoje" presentes`, () => {
          const escala = gerarEscalaEixo({ minIso: MIN_BASE, maxIso, pxPorDia, hojeIso });

          // Nenhum par de rótulos da faixa PRINCIPAL a menos da distância mínima.
          const ordenados = [...escala.rotulos].sort((a, b) => a.x - b.x);
          for (let i = 1; i < ordenados.length; i += 1) {
            const dist = ordenados[i]!.x - ordenados[i - 1]!.x;
            expect(dist).toBeGreaterThanOrEqual(MINIMO_DIST_ROTULO_PX);
          }

          // Nenhum par na faixa de MESES (2ª linha do cabeçalho) também.
          const ordenadosMes = [...escala.ticksMes].sort((a, b) => a.x - b.x);
          for (let i = 1; i < ordenadosMes.length; i += 1) {
            const dist = ordenadosMes[i]!.x - ordenadosMes[i - 1]!.x;
            expect(dist).toBeGreaterThanOrEqual(MINIMO_DIST_ROTULO_PX);
          }

          // A borda esquerda (x=0) SEMPRE tem rótulo (achado MÉDIO #3).
          expect(escala.rotulos.some((r) => r.x === 0)).toBe(true);

          // "hoje" SEMPRE está presente (achado ALTO — a causa raiz desta rodada).
          const rotuloHoje = escala.rotulos.find((r) => r.tipo === "hoje");
          expect(rotuloHoje).toBeDefined();

          // Achado BAIXO #7: o chip de "hoje" sempre carrega o ANO — garante
          // "ano presente ao menos uma vez" em QUALQUER combinação de zoom/horizonte.
          expect(rotuloHoje?.label).toMatch(/\d{4}/);
        });
      }
    }
  }
});

describe("gerarEscalaEixo — 'hoje' vence tick vizinho em colisão (achado ALTO, rodada 4)", () => {
  it("hoje colado num tick natural: o tick vizinho cede, 'hoje' nunca desaparece", () => {
    // pxPorDia alto o bastante para os ticks ficarem bem próximos (faixa "dia").
    const escala = gerarEscalaEixo({
      minIso: "2026-09-01",
      maxIso: "2026-09-30",
      pxPorDia: 30,
      hojeIso: "2026-09-13", // um dia comum, cercado de ticks diários vizinhos
    });
    const rotuloHoje = escala.rotulos.find((r) => r.tipo === "hoje");
    expect(rotuloHoje).toBeDefined();
    expect(rotuloHoje?.x).toBe(12 * 30); // diffDias(01/09, 13/09) = 12
    // Nenhum outro rótulo sobrevive dentro da distância mínima do chip "hoje".
    const vizinhos = escala.rotulos.filter(
      (r) => r.tipo !== "hoje" && Math.abs(r.x - rotuloHoje!.x) < MINIMO_DIST_ROTULO_PX,
    );
    expect(vizinhos).toEqual([]);
  });
});

describe("gerarEscalaEixo — o ano aparece na virada (achado BAIXO #7, rodada 4)", () => {
  it("faixa 'dia' (pxPorDia alto): a 2ª linha do cabeçalho (ticksMes) ganha o ano no 1º mês de cada ano", () => {
    // Horizonte que cruza 31/12 → 01/01, faixa "dia" (pxPorDia=30 ≥ 24).
    const escala = gerarEscalaEixo({
      minIso: "2026-11-01",
      maxIso: "2027-02-01",
      pxPorDia: 30,
      hojeIso: "2026-11-01",
    });
    expect(escala.faixa).toBe("dia");
    const comAno2026 = escala.ticksMes.filter((t) => t.label.includes("/2026"));
    const comAno2027 = escala.ticksMes.filter((t) => t.label.includes("/2027"));
    expect(comAno2026.length).toBeGreaterThanOrEqual(1);
    expect(comAno2027.length).toBeGreaterThanOrEqual(1);
  });

  it("faixa 'mes' (pxPorDia baixo, sem 2ª linha): o ano entra na FAIXA PRINCIPAL no 1º mês de cada ano", () => {
    // "hoje" longe das duas pontas — não deve competir/fundir com o rótulo de
    // mês da borda nem com o da virada; o que se testa aqui é o rótulo de MÊS.
    const escala = gerarEscalaEixo({
      minIso: "2026-08-01",
      maxIso: "2027-04-01",
      pxPorDia: 6,
      hojeIso: "2026-12-01",
    });
    expect(escala.faixa).toBe("mes");
    // "borda" é o mesmo rótulo natural de mês na posição x=0, só reclassificado
    // pela função (a VIEW estiliza por `forte`, não por `tipo`) — por isso o
    // filtro aceita "mes" OU "borda", nunca só "mes".
    const rotulosDeMes = escala.rotulos.filter((r) => r.tipo === "mes" || r.tipo === "borda");
    const comAno2026 = rotulosDeMes.filter((r) => r.label.includes("/2026"));
    const comAno2027 = rotulosDeMes.filter((r) => r.label.includes("/2027"));
    expect(comAno2026.length).toBeGreaterThanOrEqual(1);
    expect(comAno2027.length).toBeGreaterThanOrEqual(1);
  });

  it("mesmo ano inteiro, sem virada: só uma ocorrência do ano (nunca repete em todo mês)", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-01-05",
      maxIso: "2026-11-01",
      pxPorDia: 6,
      hojeIso: "2026-06-15",
    });
    const rotulosDeMes = escala.rotulos.filter((r) => r.tipo === "mes" || r.tipo === "borda");
    const comAno = rotulosDeMes.filter((r) => r.label.includes("/2026"));
    expect(comAno.length).toBe(1);
  });
});

describe("gerarEscalaEixo — nunca lança", () => {
  it("horizonte de 1 dia, pxPorDia mínimo, hoje fora de qualquer faixa razoável: não lança", () => {
    expect(() =>
      gerarEscalaEixo({ minIso: "2026-09-13", maxIso: "2026-09-13", pxPorDia: 1, hojeIso: "2026-09-13" }),
    ).not.toThrow();
  });

  it("minIso/maxIso invertidos (dado podre): não lança, ainda devolve x=0 e hoje", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-09-20",
      maxIso: "2026-09-10",
      pxPorDia: 16,
      hojeIso: "2026-09-20",
    });
    expect(escala.rotulos.some((r) => r.x === 0)).toBe(true);
    expect(escala.rotulos.some((r) => r.tipo === "hoje")).toBe(true);
  });
});

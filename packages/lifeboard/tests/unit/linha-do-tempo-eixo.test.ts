import { describe, expect, it } from "vitest";

import {
  LIMIAR_TICK_PX,
  MINIMO_DIST_ROTULO_PX,
  distanciaMinima,
  gerarEscalaEixo,
  type FaixaEixo,
  type RotuloEixo,
} from "@/core/timeline/eixo-rotulos";

/**
 * OS-LIFEBOARD · P5 — rodada 5 de correção do crítico hostil.
 *
 * A rodada 4 testava a CONSTANTE de piso (`MINIMO_DIST_ROTULO_PX`, 40px) —
 * e por isso passava verde enquanto a tela mostrava `"19/09/2026"` seguido
 * de `"03/10"` a 81px, onde a régua real exige 97 (achado BAIXO #10: "o teste
 * garante a constante, não a função"). Aqui o vão de CADA par adjacente é
 * conferido contra `distanciaMinima(anterior, atual)` — a mesma função que a
 * colocação usa —, em 200 combinações de horizonte × densidade × posição de
 * "hoje". Se a régua mudar, o teste muda junto sem ninguém editar um número.
 */

const MS_POR_DIA = 86_400_000;

function somaDiasIso(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}
function diaMes(iso: string): string {
  const d = new Date(Date.parse(`${iso}T00:00:00.000Z`));
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * O rótulo que a BORDA `x=0` teria — replicado aqui de propósito: é contra a
 * largura DELE que se prova que a borda só cede quando não cabe ao lado do
 * chip de "hoje" (achado ALTO A2, rodada 5), nunca por capricho.
 */
function labelDaBorda(minIso: string, faixa: FaixaEixo): string {
  const d = new Date(Date.parse(`${minIso}T00:00:00.000Z`));
  if (faixa === "dia") return String(d.getUTCDate());
  if (faixa === "semana") return diaMes(minIso);
  return `${MESES[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

/** As densidades reais do app: Trimestre 6 · Mês 16 · o alvo do auto 24 · Semana 46 · teto do auto 64. */
const PX_POR_DIA = [6, 16, 24, 46, 64] as const;
/** 8 horizontes entre 30 e 400 dias × 5 densidades × 5 posições de "hoje" = 200 combinações. */
const HORIZONTES_DIAS = [30, 45, 60, 90, 120, 200, 300, 400] as const;
const FRACOES_HOJE = [0, 0.1, 0.4, 0.9, 1] as const;

const MIN_BASE = "2026-09-01";

describe("gerarEscalaEixo — o invariante é a FUNÇÃO, não a constante (achados ALTO A1 / BAIXO A10)", () => {
  for (const totalDias of HORIZONTES_DIAS) {
    for (const pxPorDia of PX_POR_DIA) {
      for (const fracaoHoje of FRACOES_HOJE) {
        const maxIso = somaDiasIso(MIN_BASE, totalDias);
        const diasAteHoje = Math.round(totalDias * fracaoHoje);
        const hojeIso = somaDiasIso(MIN_BASE, diasAteHoje);

        it(`${totalDias}d × ${pxPorDia}px/dia × hoje a ${Math.round(fracaoHoje * 100)}%`, () => {
          const escala = gerarEscalaEixo({ minIso: MIN_BASE, maxIso, pxPorDia, hojeIso });
          const ordenados = [...escala.rotulos].sort((a, b) => a.x - b.x);

          // 1. O invariante: cada par adjacente respeita a régua que a
          //    própria função aplica — largura do rótulo da ESQUERDA + margem
          //    (+ respiro do chip), nunca os 40px de piso sozinhos.
          for (let i = 1; i < ordenados.length; i += 1) {
            const anterior = ordenados[i - 1]!;
            const atual = ordenados[i]!;
            expect(atual.x - anterior.x).toBeGreaterThanOrEqual(distanciaMinima(anterior, atual));
          }

          // 2. Mesma régua na 2ª faixa do cabeçalho (os meses).
          const meses = [...escala.ticksMes].sort((a, b) => a.x - b.x);
          for (let i = 1; i < meses.length; i += 1) {
            expect(meses[i]!.x - meses[i - 1]!.x).toBeGreaterThanOrEqual(
              distanciaMinima(meses[i - 1]!, meses[i]!),
            );
          }

          // 3. "hoje" SEMPRE existe e NUNCA muda de x (achado ALTO A2): é a
          //    mesma posição da linha dourada vertical da tela.
          const hoje = escala.rotulos.find((r) => r.tipo === "hoje");
          expect(hoje).toBeDefined();
          expect(hoje?.x).toBe(Math.min(diasAteHoje, totalDias) * pxPorDia);
          expect(hoje?.label).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

          // 4. A borda `x=0` está lá — ou cedeu para "hoje", e nesse caso ela
          //    PROVADAMENTE não cabia (a régua contra o rótulo que sobreviveu).
          const primeiro = ordenados[0]!;
          if (primeiro.x !== 0) {
            expect(primeiro.tipo).toBe("hoje");
            const borda: RotuloEixo = {
              x: 0,
              label: labelDaBorda(MIN_BASE, escala.faixa),
              forte: true,
              tipo: "borda",
            };
            expect(primeiro.x).toBeLessThan(distanciaMinima(borda, primeiro));
          }

          // 5. Nenhum vão maior que o limiar — a não ser quando a largura dos
          //    dois vizinhos (± a granularidade de 1 dia) não deixa caber mais
          //    um `dd/MM` no meio. Vão grande por FÍSICA, nunca por descuido.
          for (let i = 1; i < ordenados.length; i += 1) {
            const esq = ordenados[i - 1]!;
            const dir = ordenados[i]!;
            const vao = dir.x - esq.x;
            if (vao <= LIMIAR_TICK_PX) continue;
            // O preenchimento tem a largura que ESTA escala usaria: num
            // horizonte que pode repetir `dd/MM`, o rótulo leva o ano (e é
            // mais largo — por isso às vezes ele mesmo não cabe).
            const meio: RotuloEixo = {
              x: 0,
              label: totalDias >= 364 ? "00/00/0000" : "00/00",
              forte: false,
              tipo: "preenchimento",
            };
            expect(distanciaMinima(esq, meio) + distanciaMinima(meio, dir)).toBeGreaterThan(
              vao - pxPorDia,
            );
          }

          // 6. Nenhum `dd/MM` repetido na mesma faixa (o segundo leva o ano).
          const repetidos = escala.rotulos
            .map((r) => r.label)
            .filter((l) => /^\d{2}\/\d{2}$/.test(l));
          expect(new Set(repetidos).size).toBe(repetidos.length);
        });
      }
    }
  }
});

describe("gerarEscalaEixo — o chip de 'hoje' nunca é movido para a borda (achado ALTO A2)", () => {
  it("hoje a 18px da borda: fica em 18px (e a borda some), nunca 'vira' a data da borda em x=0", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-09-01",
      maxIso: "2026-10-16",
      pxPorDia: 6,
      hojeIso: "2026-09-04", // 3 dias × 6px = 18px — colado na borda
    });
    const hoje = escala.rotulos.find((r) => r.tipo === "hoje");
    expect(hoje?.x).toBe(18);
    expect(hoje?.label).toBe("04/09/2026");
    // A borda cedeu: ninguém em x=0 dizendo uma data que não é a de lá.
    expect(escala.rotulos.some((r) => r.x === 0)).toBe(false);
  });

  it("o repro exato do crítico (px=6, +45d, hoje +18d): o par 19/09 → seguinte respeita a régua", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-09-01",
      maxIso: "2026-10-16",
      pxPorDia: 6,
      hojeIso: "2026-09-19",
    });
    const ordenados = [...escala.rotulos].sort((a, b) => a.x - b.x);
    const i = ordenados.findIndex((r) => r.tipo === "hoje");
    expect(i).toBeGreaterThanOrEqual(0);
    const hoje = ordenados[i]!;
    expect(hoje.x).toBe(108);
    const seguinte = ordenados[i + 1];
    if (seguinte) {
      // Antes: 189 − 108 = 81px, com a régua exigindo 97 (bug medido).
      expect(seguinte.x - hoje.x).toBeGreaterThanOrEqual(distanciaMinima(hoje, seguinte));
    }
  });

  it("Trimestre, faixa de mês: jul/2026 → o vizinho seguinte nunca a 21px (bug da rodada 4)", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-07-01",
      maxIso: "2026-10-01",
      pxPorDia: 6,
      hojeIso: "2026-08-15",
    });
    const ordenados = [...escala.rotulos].sort((a, b) => a.x - b.x);
    for (let i = 1; i < ordenados.length; i += 1) {
      expect(ordenados[i]!.x - ordenados[i - 1]!.x).toBeGreaterThanOrEqual(
        distanciaMinima(ordenados[i - 1]!, ordenados[i]!),
      );
    }
  });
});

describe("gerarEscalaEixo — o ano aparece na virada (achado BAIXO #7, rodada 4)", () => {
  it("faixa 'dia': a 2ª linha do cabeçalho ganha o ano no 1º mês de cada ano", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-11-01",
      maxIso: "2027-02-01",
      pxPorDia: 30,
      hojeIso: "2026-11-01",
    });
    expect(escala.faixa).toBe("dia");
    expect(escala.ticksMes.filter((t) => t.label.includes("/2026")).length).toBeGreaterThanOrEqual(1);
    expect(escala.ticksMes.filter((t) => t.label.includes("/2027")).length).toBeGreaterThanOrEqual(1);
  });

  it("faixa 'mes' (sem 2ª linha): o ano entra na FAIXA PRINCIPAL no 1º mês de cada ano", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-08-01",
      maxIso: "2027-04-01",
      pxPorDia: 6,
      hojeIso: "2026-12-01",
    });
    expect(escala.faixa).toBe("mes");
    const deMes = escala.rotulos.filter((r) => r.tipo === "mes" || r.tipo === "borda");
    expect(deMes.filter((r) => r.label.includes("/2026")).length).toBeGreaterThanOrEqual(1);
    expect(deMes.filter((r) => r.label.includes("/2027")).length).toBeGreaterThanOrEqual(1);
  });

  it("mesmo ano inteiro, sem virada: uma única ocorrência do ano nos rótulos de mês", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-01-05",
      maxIso: "2026-11-01",
      pxPorDia: 6,
      hojeIso: "2026-06-15",
    });
    const deMes = escala.rotulos.filter((r) => r.tipo === "mes" || r.tipo === "borda");
    expect(deMes.filter((r) => r.label.includes("/2026")).length).toBe(1);
  });
});

describe("gerarEscalaEixo — piso e robustez", () => {
  it("o piso de 40px continua valendo para os dois rótulos mais curtos possíveis", () => {
    expect(
      distanciaMinima({ label: "1", tipo: "dia" }, { label: "2", tipo: "dia" }),
    ).toBe(MINIMO_DIST_ROTULO_PX);
  });

  it("horizonte de 1 dia, pxPorDia mínimo: não lança", () => {
    expect(() =>
      gerarEscalaEixo({ minIso: "2026-09-13", maxIso: "2026-09-13", pxPorDia: 1, hojeIso: "2026-09-13" }),
    ).not.toThrow();
  });

  it("minIso/maxIso invertidos (dado podre): não lança e 'hoje' continua na lista", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-09-20",
      maxIso: "2026-09-10",
      pxPorDia: 16,
      hojeIso: "2026-09-20",
    });
    expect(escala.rotulos.some((r) => r.tipo === "hoje")).toBe(true);
  });
});

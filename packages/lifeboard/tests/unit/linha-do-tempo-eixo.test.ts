import { describe, expect, it } from "vitest";

import {
  LIMIAR_TICK_PX,
  MINIMO_DIST_ROTULO_PX,
  distanciaMinima,
  faixaDoEixo,
  gerarEscalaEixo,
  labelDaBordaDoEixo,
  rotuloDeData,
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

/**
 * Rodada 6 (achado BAIXO A7): a cópia manual `labelDaBorda` foi APAGADA. Ela
 * já tinha divergido da produção — na faixa "semana" devolvia `dd/MM` sempre,
 * enquanto `rotuloDeData` acrescenta o ano a partir de 364 dias de horizonte
 * —, e a asserção que a usava comparava a escala contra uma régua que a
 * escala não usa. Agora o teste importa a função de PRODUÇÃO
 * (`labelDaBordaDoEixo`): não existe segunda implementação para divergir.
 */

/** Quantos combos exercitaram DE FATO o ramo "a borda cedeu" (asserção 4). */
let combosComBordaCedida = 0;

/** As densidades reais do app: Trimestre 6 · Mês 16 · o alvo do auto 24 · Semana 46 · teto do auto 64. */
const PX_POR_DIA = [6, 16, 24, 46, 64] as const;
/** 8 horizontes entre 30 e 400 dias × 5 densidades × 7 posições de "hoje" = 280 combinações. */
const HORIZONTES_DIAS = [30, 45, 60, 90, 120, 200, 300, 400] as const;
/**
 * Rodada 6: `0.02` e `0.06` entraram de propósito — com `fracaoHoje > 0` e
 * "hoje" a poucos pixels da borda é que o ramo "a borda cede" acontece. Sem
 * pelo menos um combo nesse ramo, a asserção 4 nunca era exercitada e passava
 * verde por vacuidade (o teste final deste arquivo cobra a contagem > 0).
 */
const FRACOES_HOJE = [0, 0.02, 0.06, 0.1, 0.4, 0.9, 1] as const;

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
          const meses = [...escala.rotulosSuperiores].sort((a, b) => a.x - b.x);
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
          // Rodada 7 (D4): o chip de "hoje" usa a MESMA régua de rótulo do
          // resto do eixo — `dd/MM` até 363 dias, `dd/MM/aaaa` a partir de 364
          // (quando a data pode repetir). Antes ele carregava o ano sempre e,
          // sendo o rótulo mais largo E o de prioridade máxima, apagava o
          // vizinho seguinte num painel estreito (390px → 1 rótulo na tela).
          expect(hoje?.label).toBe(rotuloDeData(hojeIso, totalDias));
          expect(hoje?.label).toMatch(/^\d{2}\/\d{2}$/);

          // 4. (i) OU existe um rótulo colocado em `x=0`, OU o 1º sobrevivente
          //    está perto demais para a borda caber — medido contra o rótulo
          //    REAL que a produção colocaria ali (`labelDaBordaDoEixo`), nunca
          //    contra uma cópia do teste. (ii) num horizonte que repete datas
          //    (≥ 364 d), o 1º rótulo visível carrega o ano; na faixa "dia" o
          //    ano vive na 2ª linha do cabeçalho (os rótulos são "13", "14").
          const primeiro = ordenados[0]!;
          const bordaDeProducao: RotuloEixo = {
            x: 0,
            label: labelDaBordaDoEixo(MIN_BASE, maxIso, pxPorDia),
            forte: true,
            tipo: "borda",
          };
          const temBorda = ordenados.some((r) => r.x === 0);
          expect(temBorda || primeiro.x < distanciaMinima(bordaDeProducao, primeiro)).toBe(true);
          if (!temBorda) {
            combosComBordaCedida += 1;
            expect(primeiro.tipo).toBe("hoje");
          }
          // Rodada 7 (D4): o ANO subiu de andar. A faixa de BAIXO carrega
          // `dd/MM` em toda densidade; num horizonte que repete datas, quem
          // desambigua é a faixa de CIMA, que existe sempre e leva mês+ano.
          if (totalDias >= 364) {
            const primeiroMes = [...escala.rotulosSuperiores].sort((a, b) => a.x - b.x)[0];
            expect(primeiroMes?.label ?? "").toMatch(/\/\d{4}$/);
            expect(escala.rotulosSuperiores.every((m) => /\/\d{4}$/.test(m.label))).toBe(true);
            expect(faixaDoEixo(pxPorDia)).toBeTruthy();
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
              label: "00/00", // rodada 7 (D4): o rótulo de data é `dd/MM` em toda escala
              forte: false,
              tipo: "preenchimento",
            };
            expect(distanciaMinima(esq, meio) + distanciaMinima(meio, dir)).toBeGreaterThan(
              vao - pxPorDia,
            );
          }

          /*
            6. `dd/MM` repetido na faixa de baixo só é admissível quando a faixa
            de CIMA desambigua — e ela sempre desambigua, porque num horizonte
            ≥ 366 dias todo rótulo dela leva o ano. Até a rodada 6 a regra era
            "o segundo leva o ano", o que era a única saída quando não existia
            faixa de cima em toda densidade; a conta que obrigou a troca está
            em `rotuloDeData` (com o ano no rótulo de data, ≥ 2 rótulos a 390px
            num horizonte de 400 dias é fisicamente impossível: 300px de
            necessidade para 218px de painel).
          */
          const datas = escala.rotulos.map((r) => r.label).filter((l) => /^\d{2}\/\d{2}$/.test(l));
          if (new Set(datas).size !== datas.length) {
            expect(totalDias).toBeGreaterThanOrEqual(364);
            expect(escala.rotulosSuperiores.length).toBeGreaterThanOrEqual(1);
            expect(escala.rotulosSuperiores.every((m) => /\/\d{4}$/.test(m.label))).toBe(true);
          }
        });
      }
    }
  }
});

describe("as combinações acima exercitaram o ramo da asserção 4 (achado BAIXO A7, rodada 6)", () => {
  it("pelo menos um combo teve a borda cedendo — a asserção 4 não passa por vacuidade", () => {
    // Nunca interpolar valor no 1º argumento de `console.*` (CodeQL).
    console.log("combos em que a borda x=0 cedeu:", combosComBordaCedida);
    expect(combosComBordaCedida).toBeGreaterThan(0);
  });
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
    expect(hoje?.label).toBe("04/09");
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
  it("faixa 'dia': a faixa de cima ganha o ano no 1º mês de cada ano", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-11-01",
      maxIso: "2027-02-01",
      pxPorDia: 30,
      hojeIso: "2026-11-01",
    });
    expect(escala.faixa).toBe("dia");
    expect(escala.rotulosSuperiores.filter((t) => t.label.includes("/2026")).length).toBeGreaterThanOrEqual(1);
    expect(escala.rotulosSuperiores.filter((t) => t.label.includes("/2027")).length).toBeGreaterThanOrEqual(1);
  });

  /**
   * Rodada 7 (decisão D4): na faixa "mes" os NOMES DE MÊS saíram da faixa
   * principal — lá embaixo agora vivem DATAS (o período menor), e o mês é o
   * período MAIOR, que vive na faixa de cima. Antes desta rodada a faixa de
   * cima simplesmente não existia abaixo de 24px/dia: a 390px, com "auto" em
   * 6px/dia, o crítico mediu faixa ÚNICA, 2 rótulos visíveis e nenhum mês.
   */
  it("faixa 'mes': o ano entra na FAIXA DE CIMA no 1º mês de cada ano", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-08-01",
      maxIso: "2027-04-01",
      pxPorDia: 6,
      hojeIso: "2026-12-01",
    });
    expect(escala.faixa).toBe("mes");
    expect(escala.periodoSuperior).toBe("mes");
    const deMes = escala.rotulosSuperiores;
    expect(deMes.filter((r) => r.label.includes("/2026")).length).toBeGreaterThanOrEqual(1);
    expect(deMes.filter((r) => r.label.includes("/2027")).length).toBeGreaterThanOrEqual(1);
    // E a faixa de BAIXO passou a carregar datas, não nomes de mês.
    expect(escala.rotulos.every((r) => r.tipo !== "mes")).toBe(true);
    expect(escala.rotulos.filter((r) => /\d{2}\/\d{2}/.test(r.label)).length).toBeGreaterThan(1);
  });

  it("mesmo ano inteiro, sem virada: uma única ocorrência do ano na faixa de cima", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-01-05",
      maxIso: "2026-11-01",
      pxPorDia: 6,
      hojeIso: "2026-06-15",
    });
    expect(escala.rotulosSuperiores.filter((r) => r.label.includes("/2026")).length).toBe(1);
  });
});

describe("gerarEscalaEixo — dois 'ago' na mesma régua nunca mais (achado BAIXO A8, rodada 6)", () => {
  it("faixa 'mes', horizonte de 400 dias: nenhum rótulo de mês repetido (faixa de cima)", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-08-01",
      maxIso: "2027-09-05", // 400 dias — "ago" cai duas vezes
      pxPorDia: 6,
      hojeIso: "2026-09-13",
    });
    expect(escala.faixa).toBe("mes");
    const deMes = escala.rotulosSuperiores.map((r) => r.label);
    expect(deMes.length).toBeGreaterThan(2);
    expect(new Set(deMes).size).toBe(deMes.length);
    // E o ano está lá nos DOIS agostos (a régua é "sempre com ano", não "só em janeiro").
    expect(deMes.filter((l) => l.startsWith("ago/")).length).toBeGreaterThanOrEqual(1);
    expect(deMes.every((l) => /\/\d{4}$/.test(l))).toBe(true);
  });

  it("faixa 'dia', horizonte > 366 dias: a faixa de cima também não repete mês", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-08-01",
      maxIso: "2027-09-05",
      pxPorDia: 24,
      hojeIso: "2026-09-13",
    });
    expect(escala.faixa).toBe("dia");
    const meses = escala.rotulosSuperiores.map((t) => t.label);
    expect(meses.length).toBeGreaterThan(2);
    expect(new Set(meses).size).toBe(meses.length);
  });

  it("horizonte de 365 dias ou menos mantém a régua antiga (ano só na virada)", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-01-05",
      maxIso: "2026-11-01",
      pxPorDia: 6,
      hojeIso: "2026-06-15",
    });
    const deMes = escala.rotulosSuperiores.map((r) => r.label);
    expect(deMes.filter((l) => l.includes("/2026")).length).toBe(1);
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

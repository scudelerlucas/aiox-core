import { describe, expect, it } from "vitest";

import {
  aplicarPlanoDaFolha,
  ehFolhaInferior,
  espacoAbaixoDaUltimaLinha,
  excessoSobreAFolha,
  MARGEM_ANEL_PX,
  planoDaFolhaInferior,
} from "@/core/timeline/folha-inferior";

/**
 * OS-LIFEBOARD · P5 — rodada 9, achado ALTO A1: "a folha do celular tapa 100%
 * da barra da linha tocada".
 *
 * O que a rodada 8 provava: que a rolagem era PEDIDA. O que o crítico mediu:
 * que ela não ACONTECIA. `window.scrollBy` é um no-op silencioso quando a
 * página já está no fim (`scrollY === scrollHeight − innerHeight`) — e é ali
 * que mora a última linha, que é onde mora o goal. 9 de 9 casos tapados
 * (larguras 360/390/767 × as 3 últimas linhas), resíduo de 9 a 133px; a 390px,
 * 2.880 de 2.880 px² da barra cobertos (100%).
 *
 * Por isso a asserção aqui é o RESULTADO GEOMÉTRICO, nunca a chamada: uma
 * PÁGINA de mentira, com a única regra que causa o bug — `scrollBy` satura no
 * máximo rolável, exatamente como o navegador —, e a pergunta é quantos pixels
 * da barra da linha tocada sobraram debaixo da folha. Zero, ou o teste é
 * vermelho.
 *
 * (Não existe `jsdom` no `node_modules` deste repo e não se pode instalar —
 * ver o cabeçalho de `linha-do-tempo-render.test.tsx`. O modelo abaixo carrega
 * SÓ a mecânica que produz o defeito; toda a decisão vem das funções de
 * produção, que são as mesmas que o componente chama.)
 */

const ROW_H = 42;
/** A 390×844 a 1ª linha nasce em 393px (achado BAIXO A5 — o número certo). */
const TOPO_DA_PRIMEIRA_LINHA = 393;
/** `pb-16` do `<main>`. */
const RODAPE_PX = 64;
const LINHAS = 25;
/** A barra dentro da faixa da linha (o que o operador precisa ver). */
const BARRA_TOPO_NA_LINHA = 11;
const BARRA_ALTURA = 20;

interface Pagina {
  innerWidth: number;
  innerHeight: number;
  /** Altura do documento SEM o espaçador da folha. */
  alturaBase: number;
  /** O espaçador que a correção reserva abaixo da última linha. */
  espacador: number;
  scrollY: number;
}

function criarPagina(innerWidth: number, innerHeight: number): Pagina {
  return {
    innerWidth,
    innerHeight,
    alturaBase: TOPO_DA_PRIMEIRA_LINHA + LINHAS * ROW_H + RODAPE_PX,
    espacador: 0,
    scrollY: 0,
  };
}

function maxScroll(p: Pagina): number {
  return Math.max(0, p.alturaBase + p.espacador - p.innerHeight);
}

/**
 * A ÚNICA regra do navegador que este modelo precisa — e a que a rodada 8 não
 * tinha em conta: rolar além do fim não rola nada, e não avisa.
 */
function scrollBy(p: Pagina, top: number): void {
  p.scrollY = Math.min(Math.max(0, p.scrollY + top), maxScroll(p));
}

function retanguloDaLinha(p: Pagina, indice: number): { top: number; bottom: number } {
  const topoNoDocumento = TOPO_DA_PRIMEIRA_LINHA + indice * ROW_H;
  return { top: topoNoDocumento - p.scrollY, bottom: topoNoDocumento + ROW_H - p.scrollY };
}

function retanguloDaFolha(p: Pagina, altura: number): {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
} {
  return {
    top: p.innerHeight - altura,
    left: 0,
    width: p.innerWidth,
    height: altura,
    bottom: p.innerHeight,
  };
}

/**
 * Abre a folha na linha `indice` com a página ROLADA ATÉ O FIM (o pior caso,
 * e o único em que o bug aparece). `reservar = false` é a MUTAÇÃO: a rodada 8
 * literal, que só pede a rolagem.
 */
function abrirFolha(params: {
  largura: number;
  altura: number;
  indice: number;
  alturaDaFolha: number;
  reservar?: boolean;
}): { residuoPx: number; rolouPx: number; espacoReservado: number } {
  const { largura, altura, indice, alturaDaFolha } = params;
  const reservar = params.reservar ?? true;
  const p = criarPagina(largura, altura);
  p.scrollY = maxScroll(p); // a página já está no fim: é aqui que `scrollBy` morre
  const antes = p.scrollY;
  const linha = retanguloDaLinha(p, indice);
  const folha = retanguloDaFolha(p, alturaDaFolha);
  const plano = planoDaFolhaInferior({
    folha,
    bottomDoBotao: linha.bottom,
    topoDoBotao: linha.top,
    larguraJanela: p.innerWidth,
    alturaJanela: p.innerHeight,
    scrollY: p.scrollY,
    alturaDoDocumento: p.alturaBase + p.espacador,
    espacoAtual: p.espacador,
  });
  /*
    A CADEIA INTEIRA sob teste — medir, decidir e APLICAR. A aplicação é a
    função de produção (`aplicarPlanoDaFolha`), com o espaçador e o
    `window.scrollBy` injetados: assim o mutante que zera a reserva fica
    vermelho esteja ele na decisão ou na escrita. `reservar: false` é a rodada
    8 literal — um espaçador que ignora o que lhe mandam escrever.
  */
  const espacador = {
    style: {
      set height(v: string) {
        p.espacador = reservar ? Number.parseFloat(v) || 0 : 0;
      },
      get height(): string {
        return `${p.espacador}px`;
      },
    },
  };
  aplicarPlanoDaFolha(plano, { espacador, folha: null, rolarPagina: (px) => scrollBy(p, px) });
  const depois = retanguloDaLinha(p, indice);
  const barraTopo = depois.top + BARRA_TOPO_NA_LINHA;
  const barraBaixo = barraTopo + BARRA_ALTURA;
  // Quantos px da barra sobraram DEBAIXO da folha (a folha ocupa a largura toda).
  const residuoPx = Math.max(0, Math.min(BARRA_ALTURA, barraBaixo - folha.top));
  return { residuoPx, rolouPx: p.scrollY - antes, espacoReservado: plano.espacoReservado };
}

const LARGURAS = [360, 390, 767] as const;
/** As 3 ÚLTIMAS linhas — onde o goal mora e onde a página não tem mais para onde rolar. */
const ULTIMAS = [LINHAS - 1, LINHAS - 2, LINHAS - 3] as const;
/** A folha vai de um painel curto (assunto) ao teto `max-h-[60vh]` de 844px. */
const ALTURAS_DE_FOLHA = [120, 150, 174, 200, 214, 260, 320, 400, 506] as const;

describe("A1 · a barra da linha tocada NUNCA fica debaixo da folha (resultado, não a chamada)", () => {
  it("3 larguras × as 3 últimas linhas × 9 alturas de folha: resíduo 0px em todos", () => {
    const piores: { largura: number; linha: number; residuo: number }[] = [];
    for (const largura of LARGURAS) {
      for (const indice of ULTIMAS) {
        for (const alturaDaFolha of ALTURAS_DE_FOLHA) {
          const r = abrirFolha({ largura, altura: 844, indice, alturaDaFolha });
          if (r.residuoPx > 0) piores.push({ largura, linha: indice, residuo: r.residuoPx });
        }
      }
    }
    expect(piores).toEqual([]);
  });

  it("MUTAÇÃO (a rodada 8 literal: pede a rolagem e não reserva espaço) — volta a tapar", () => {
    const tapados: { largura: number; linha: number; residuo: number }[] = [];
    for (const largura of LARGURAS) {
      for (const indice of ULTIMAS) {
        const r = abrirFolha({
          largura,
          altura: 844,
          indice,
          alturaDaFolha: 214,
          reservar: false,
        });
        if (r.residuoPx > 0) tapados.push({ largura, linha: indice, residuo: r.residuoPx });
      }
    }
    // 9 de 9, exatamente como o crítico mediu na rota real.
    expect(tapados).toHaveLength(9);
    // E na ÚLTIMA linha a barra fica INTEIRA debaixo da folha (100%).
    const ultima = abrirFolha({
      largura: 390,
      altura: 844,
      indice: LINHAS - 1,
      alturaDaFolha: 214,
      reservar: false,
    });
    expect(ultima.residuoPx).toBe(BARRA_ALTURA);
    expect(ultima.rolouPx).toBe(0); // o no-op silencioso, medido
  });

  it("com a reserva, a página SEMPRE tem para onde rolar (o no-op desaparece)", () => {
    const r = abrirFolha({ largura: 390, altura: 844, indice: LINHAS - 1, alturaDaFolha: 214 });
    expect(r.espacoReservado).toBe(214 + MARGEM_ANEL_PX);
    expect(r.rolouPx).toBeGreaterThan(0);
    expect(r.residuoPx).toBe(0);
  });

  it("linha do MEIO (a página ainda tem fundo): continua funcionando como na rodada 8", () => {
    for (const largura of LARGURAS) {
      const r = abrirFolha({ largura, altura: 844, indice: 12, alturaDaFolha: 214 });
      expect(r.residuoPx).toBe(0);
    }
  });
});

describe("A1 · as peças puras, uma a uma", () => {
  it("folha COLUNA (≥768px) não reserva nada e não rola nada — ΔscrollY = 0 no desktop", () => {
    const plano = planoDaFolhaInferior({
      folha: { top: 120, left: 1040, width: 240, height: 400, bottom: 520 },
      bottomDoBotao: 900,
      larguraJanela: 1280,
      alturaJanela: 800,
      scrollY: 0,
      alturaDoDocumento: 2000,
      espacoAtual: 0,
    });
    expect(plano).toEqual({
      ehInferior: false,
      espacoReservado: 0,
      rolar: 0,
      alturaMaxima: null,
    });
  });

  it("folha fechada: plano vazio (o espaçador volta a 0)", () => {
    expect(
      planoDaFolhaInferior({
        folha: null,
        bottomDoBotao: 800,
        larguraJanela: 390,
        alturaJanela: 844,
        scrollY: 0,
        alturaDoDocumento: 2000,
        espacoAtual: 0,
      }),
    ).toEqual({ ehInferior: false, espacoReservado: 0, rolar: 0, alturaMaxima: null });
  });

  it("a régua de 'é a folha inferior': largura toda e encostada na esquerda", () => {
    expect(ehFolhaInferior({ top: 630, left: 0, width: 390, height: 214, bottom: 844 }, 390)).toBe(
      true,
    );
    expect(ehFolhaInferior({ top: 120, left: 1040, width: 240, height: 400, bottom: 520 }, 1280)).toBe(
      false,
    );
  });

  it("o espaço reservado é a altura da folha + a margem do anel, arredondada para cima", () => {
    expect(espacoAbaixoDaUltimaLinha(213.4)).toBe(220);
    expect(espacoAbaixoDaUltimaLinha(0)).toBe(MARGEM_ANEL_PX);
    expect(espacoAbaixoDaUltimaLinha(Number.NaN)).toBe(MARGEM_ANEL_PX);
  });

  it("o pior excesso possível é exatamente o que se reserva (a prova de suficiência)", () => {
    const innerHeight = 844;
    const alturaDaFolha = 214;
    // Pior caso: a linha tocada encostada no fim da viewport.
    const excesso = excessoSobreAFolha({
      bottomDoBotao: innerHeight,
      topDaFolha: innerHeight - alturaDaFolha,
    });
    expect(excesso).toBe(alturaDaFolha + MARGEM_ANEL_PX);
    expect(espacoAbaixoDaUltimaLinha(alturaDaFolha)).toBeGreaterThanOrEqual(excesso);
  });

  it("linha já acima da folha: nada a rolar (nunca um pulo à toa)", () => {
    const plano = planoDaFolhaInferior({
      folha: { top: 630, left: 0, width: 390, height: 214, bottom: 844 },
      bottomDoBotao: 400,
      topoDoBotao: 358,
      larguraJanela: 390,
      alturaJanela: 844,
      scrollY: 0,
      alturaDoDocumento: 2000,
      espacoAtual: 0,
    });
    expect(plano.rolar).toBe(0);
    expect(plano.espacoReservado).toBe(220);
  });

  it("valores podres nunca lançam nem viram NaN", () => {
    const plano = planoDaFolhaInferior({
      folha: { top: Number.NaN, left: 0, width: 390, height: Number.NaN, bottom: 0 },
      bottomDoBotao: Number.NaN,
      larguraJanela: 390,
      alturaJanela: Number.NaN,
      scrollY: Number.NaN,
      alturaDoDocumento: Number.NaN,
      espacoAtual: Number.NaN,
    });
    expect(Number.isFinite(plano.espacoReservado)).toBe(true);
    expect(Number.isFinite(plano.rolar)).toBe(true);
  });
});

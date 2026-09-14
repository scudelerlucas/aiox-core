import { describe, expect, it } from "vitest";

import {
  ALTURA_DA_BARRA_DO_GRAFO_PX,
  ALTURA_DAS_ABAS_PX,
  ALTURA_DO_CABECALHO_PX,
  ALTURA_DA_FAIXA_DE_BAIXO_PX,
  alturaDoCanvasDoGrafo,
  CLASSES_DA_BARRA_DO_GRAFO,
  CLASSES_DA_FAIXA_DE_BAIXO,
  CLASSES_DA_SECAO_DO_GRAFO,
  CLASSES_DO_CHIP_FORA_DA_TELA,
  estiloDasAlturasDoCorpo,
  RESERVA_DO_GRAFO_PX,
} from "@/lib/altura-do-canvas";

/**
 * OS-LIFEBOARD · P4h — achados MÉDIO #4 e BAIXO #7 do crítico hostil ROUND 8.
 *
 * #4: `1280×800 → canvas 1280×354` (44% da janela) contra `768×800 → canvas
 * 768×534` (67%). Com 200 nós o TABLET mostrava 32 cartões e o desktop 20 —
 * doze a mais numa tela menor. Decisão fixa: **o canvas do desktop nunca é
 * proporcionalmente menor que o do tablet.**
 *
 * #7: o chip de fora-da-tela descia de linha a 390px e engordava a barra —
 * `pane=541` com chip, `591` sem. O chip encolhia o canvas que ele mede.
 */

const JANELA = 800;

describe("o canvas do desktop nunca é menor que o do tablet (achado MÉDIO #4)", () => {
  const tablet = alturaDoCanvasDoGrafo({ larguraDaJanela: 768, alturaDaJanela: JANELA });

  for (const largura of [1024, 1280, 1440, 1920]) {
    it(`${largura}px ≥ 768px, em altura absoluta e em fração da janela`, () => {
      const desktop = alturaDoCanvasDoGrafo({ larguraDaJanela: largura, alturaDaJanela: JANELA });
      expect(desktop).toBeGreaterThanOrEqual(tablet);
      expect(desktop / JANELA).toBeGreaterThanOrEqual(tablet / JANELA);
    });
  }

  it("a régua que sustenta a desigualdade: a reserva do desktop cabe no que o tablet já gasta", () => {
    // O tablet gasta cabeçalho + abas antes do grafo; o desktop gasta a
    // reserva. Enquanto a reserva for MENOR, o desktop ganha — e é isso, e não
    // um número mágico, que faz a desigualdade valer em qualquer janela.
    expect(RESERVA_DO_GRAFO_PX).toBeLessThan(ALTURA_DO_CABECALHO_PX + ALTURA_DAS_ABAS_PX);
  });

  it("a faixa 'Fontes + Hoje' do desktop tem altura própria — nunca uma fração da janela", () => {
    // `lg:h-[38%]` era a causa: numa janela de 800 ela comia 284px do corpo.
    expect(CLASSES_DA_FAIXA_DE_BAIXO).not.toMatch(/h-\[\d+%\]/);
    expect(CLASSES_DA_FAIXA_DE_BAIXO).toContain("lg:h-[var(--lb-altura-da-faixa)]");
    expect(String(estiloDasAlturasDoCorpo()["--lb-altura-da-faixa" as never])).toBe(
      `${ALTURA_DA_FAIXA_DE_BAIXO_PX}px`,
    );
  });

  it("a seção do grafo lê a altura da variável que este módulo publica", () => {
    expect(CLASSES_DA_SECAO_DO_GRAFO).toContain("lg:h-[var(--lb-altura-do-grafo)]");
    expect(String(estiloDasAlturasDoCorpo()["--lb-altura-do-grafo" as never])).toBe(
      `calc(100dvh - ${RESERVA_DO_GRAFO_PX}px)`,
    );
  });
});

describe("a barra não muda de altura por causa do que tem dentro (achado BAIXO #7)", () => {
  it("a barra tem altura FIXA, e é a mesma que a conta do canvas usa", () => {
    expect(CLASSES_DA_BARRA_DO_GRAFO).toContain(`h-[${ALTURA_DA_BARRA_DO_GRAFO_PX}px]`);
    // Sem `flex-wrap` não há segunda linha para o chip criar.
    expect(CLASSES_DA_BARRA_DO_GRAFO).not.toContain("flex-wrap");
  });

  it("o chip tem base 0 — ele encolhe e trunca, nunca empurra linha", () => {
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("basis-0");
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("min-w-0");
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("overflow-hidden");
    // E continua acima do alvo de toque de 44px da régua da casa.
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("min-h-[44px]");
  });

  it("a vantagem do desktop é exatamente o que o tablet gasta com as abas", () => {
    const tablet = alturaDoCanvasDoGrafo({ larguraDaJanela: 768, alturaDaJanela: JANELA });
    const desktop = alturaDoCanvasDoGrafo({ larguraDaJanela: 1280, alturaDaJanela: JANELA });
    expect(desktop - tablet).toBe(
      ALTURA_DO_CABECALHO_PX + ALTURA_DAS_ABAS_PX - RESERVA_DO_GRAFO_PX,
    );
  });
});

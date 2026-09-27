import { describe, expect, it } from "vitest";

import {
  ALTURA_DA_BARRA_DO_GRAFO_PX,
  ALTURA_MINIMA_DA_SECAO_DO_GRAFO_PX,
  alturaDaSecaoDoGrafo,
  alturaDoCanvasDoGrafo,
  BORDA_DA_FAIXA_DE_BAIXO_PX,
  CLASSES_DA_BARRA_DO_GRAFO,
  CLASSES_DA_FAIXA_DE_BAIXO,
  CLASSES_DA_SECAO_DO_GRAFO,
  CLASSES_DO_CHIP_FORA_DA_TELA,
  CROMO_DENTRO_DA_SECAO_PX,
  estiloDasAlturasDoCorpo,
  TEASER_DA_FAIXA_DE_BAIXO_PX,
} from "@/lib/altura-do-canvas";
import { PANES_MEDIDOS } from "./panes-medidos";

/**
 * OS-LIFEBOARD · P4i — achado ALTO #3 do crítico hostil ROUND 8: **a faixa
 * "Hoje" tem 0 px visíveis**, e não os 43 que a rodada 8 alegou, em 1024,
 * 1280, 1440 e 1920.
 *
 * A rodada 8 escreveu a promessa como `100dvh − 96px`, com 96 saindo de dois
 * números fixos no código. Medido no Chromium em 21/09: acima da seção do
 * grafo havia **151 px** — cabeçalho de 65 (não 53), o `<nav>` global do
 * `layout.tsx` com 45 (que a conta não sabia existir) e a linha de fontes
 * desatualizadas com 41 (que aparece conforme o DADO do dia). Nenhuma
 * constante acertaria: um dos três é dinâmico.
 *
 * Por isso este arquivo mudou de assunto. Ele prova a **aritmética** de
 * `alturaDaSecaoDoGrafo` — dado um topo medido, sobra o teaser. Quem prova o
 * **pixel** é `scripts/guarda-no-navegador.mjs`, que abre a página e mede o
 * retângulo de "Hoje" (medição de 21/09 depois da correção: 44 px nas quatro
 * larguras, contra 0 antes).
 */

/** Os três casos MEDIDOS no Chromium: janela, topo real da seção. */
const MEDIDOS = [
  { nome: "1024×800", janela: 800, topo: 151 },
  { nome: "1280×800", janela: 800, topo: 151 },
  { nome: "1440×900", janela: 900, topo: 151 },
  { nome: "1920×1080", janela: 1080, topo: 151 },
];

describe("a seção do grafo deixa o teaser de 'Hoje' acima da dobra (achado ALTO #3)", () => {
  for (const caso of MEDIDOS) {
    it(`${caso.nome}: sobra exatamente o teaser + a borda da faixa`, () => {
      const altura = alturaDaSecaoDoGrafo({
        alturaDaJanela: caso.janela,
        topoDaSecao: caso.topo,
      });
      const sobra = caso.janela - (caso.topo + altura);
      expect(sobra).toBeGreaterThanOrEqual(
        TEASER_DA_FAIXA_DE_BAIXO_PX + BORDA_DA_FAIXA_DE_BAIXO_PX,
      );
      // E não é uma folga qualquer: é o teaser, não meia tela desperdiçada.
      expect(sobra).toBeLessThan(TEASER_DA_FAIXA_DE_BAIXO_PX + BORDA_DA_FAIXA_DE_BAIXO_PX + 2);
    });
  }

  it("topo fracionário (o caso real: 151,5) ainda deixa o teaser inteiro", () => {
    const altura = alturaDaSecaoDoGrafo({ alturaDaJanela: 800, topoDaSecao: 151.5 });
    // O falsificador é `Math.round` no lugar de `Math.floor`: arredondar para
    // cima devolve 43px de teaser onde o contrato pede 44.
    expect(800 - (151.5 + altura)).toBeGreaterThanOrEqual(
      TEASER_DA_FAIXA_DE_BAIXO_PX + BORDA_DA_FAIXA_DE_BAIXO_PX,
    );
  });

  it("o que muda ACIMA da seção entra na conta sozinho — nenhuma constante o vê", () => {
    // A linha de "fontes desatualizadas" (41px) aparece conforme o dado do
    // dia. Com ela e sem ela, o teaser continua inteiro.
    const semAviso = alturaDaSecaoDoGrafo({ alturaDaJanela: 800, topoDaSecao: 110 });
    const comAviso = alturaDaSecaoDoGrafo({ alturaDaJanela: 800, topoDaSecao: 151 });
    expect(semAviso - comAviso).toBe(41);
    for (const [topo, altura] of [
      [110, semAviso],
      [151, comAviso],
    ] as const) {
      expect(800 - (topo + altura)).toBeGreaterThanOrEqual(
        TEASER_DA_FAIXA_DE_BAIXO_PX + BORDA_DA_FAIXA_DE_BAIXO_PX,
      );
    }
  });

  it("numa janela baixa o piso vence — o canvas nunca vira uma tira", () => {
    expect(alturaDaSecaoDoGrafo({ alturaDaJanela: 400, topoDaSecao: 151 })).toBe(
      ALTURA_MINIMA_DA_SECAO_DO_GRAFO_PX,
    );
  });

  it("a altura da seção NÃO é mais uma classe com constante adivinhada", () => {
    // `lg:h-[var(--lb-altura-do-grafo)]` + `calc(100dvh - 96px)` era a forma
    // de escrever a promessa errada. A altura agora vem de medição.
    expect(CLASSES_DA_SECAO_DO_GRAFO).not.toContain("--lb-altura-do-grafo");
    expect(CLASSES_DA_SECAO_DO_GRAFO).not.toMatch(/lg:h-\[/);
    expect(Object.keys(estiloDasAlturasDoCorpo())).not.toContain("--lb-altura-do-grafo");
  });

  it("a faixa 'Fontes + Hoje' tem altura própria — nunca uma fração da janela", () => {
    expect(CLASSES_DA_FAIXA_DE_BAIXO).not.toMatch(/h-\[\d+%\]/);
    expect(CLASSES_DA_FAIXA_DE_BAIXO).toContain("lg:h-[var(--lb-altura-da-faixa)]");
    expect(String(estiloDasAlturasDoCorpo()["--lb-altura-da-faixa"])).toMatch(/^\d+px$/);
  });
});

describe("o canvas dentro da seção", () => {
  it("o canvas é a seção menos o cromo, e bate com o pane MEDIDO no navegador", () => {
    for (const caso of MEDIDOS) {
      const secao = alturaDaSecaoDoGrafo({
        alturaDaJanela: caso.janela,
        topoDaSecao: caso.topo,
      });
      const calculado = alturaDoCanvasDoGrafo({ alturaDaSecao: secao });
      const medido = PANES_MEDIDOS[caso.nome.replace("×", "x")];
      expect(medido).toBeDefined();
      expect(Math.abs(calculado - (medido?.altura ?? 0))).toBeLessThanOrEqual(2);
    }
  });

  it("o desktop de 1024 não sai menor que o celular de 390 — a promessa da rodada 8", () => {
    const celular = PANES_MEDIDOS["390x800"];
    const desktop = PANES_MEDIDOS["1024x800"];
    expect(celular).toBeDefined();
    expect(desktop).toBeDefined();
    // Números medidos, não deduzidos: 390→552 e 1024→507. O desktop é MENOR
    // em altura, e é maior em área — que é o que decide quantos cartões cabem.
    expect((desktop?.largura ?? 0) * (desktop?.altura ?? 0)).toBeGreaterThan(
      (celular?.largura ?? 0) * (celular?.altura ?? 0),
    );
  });
});

describe("a barra não muda de altura por causa do que tem dentro (achado BAIXO #7)", () => {
  it("a barra tem altura FIXA, e é a mesma que a conta do canvas usa", () => {
    expect(CLASSES_DA_BARRA_DO_GRAFO).toContain(`h-[${ALTURA_DA_BARRA_DO_GRAFO_PX}px]`);
    expect(CLASSES_DA_BARRA_DO_GRAFO).not.toContain("flex-wrap");
    expect(CROMO_DENTRO_DA_SECAO_PX).toBeGreaterThan(ALTURA_DA_BARRA_DO_GRAFO_PX);
  });

  it("o chip tem base 0 — ele encolhe e trunca, nunca empurra linha", () => {
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("basis-0");
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("min-w-0");
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("overflow-hidden");
    expect(CLASSES_DO_CHIP_FORA_DA_TELA).toContain("min-h-[44px]");
  });
});

/**
 * OS-LIFEBOARD · P5 — A PROMESSA DO LOSANGO DE MARCO, CONFERIDA POR MECANISMO.
 *
 * [rodada 15] Este teste nasceu ao PROVAR as sabotagens do piso da rodada 14.
 * Uma delas — `criado_em: d(5)` no PR de demonstração que vira losango de marco
 * — passou VERDE nos cinco portões. Medido nas DUAS árvores (a guarda desta
 * rodada e a da rodada 14, sem nenhuma mudança minha): verde nas duas. Ou seja,
 * não é regressão desta rodada; é um buraco que já existia e que ninguém tinha
 * medido.
 *
 * Por que a guarda de navegador não pega: o produto desenha `.lb-tl-marco` em
 * DOIS lugares independentes — o losango do ASSUNTO de um dia só
 * (`linha-do-tempo.tsx`, o ramo `row.marco` da linha de assunto) e o losango da
 * TAREFA de duração zero (o ramo `row.marco` da linha de tarefa). A medida O
 * pergunta "esta classe soma ZERO nos 4 estados?", e apagar o marco do assunto
 * deixa o da tarefa de pé: 2 → 1, nunca 0. A pergunta certa para ESTA promessa
 * não é sobre a classe na tela; é sobre a FIXTURE.
 *
 * A promessa está escrita em `src/lib/frentes/fixture.ts`, em português, desde
 * a rodada 14: *"este PR nasce e morre no MESMO INSTANTE de propósito … a
 * cobertura para de depender do relógio"*. Promessa escrita e não conferida é
 * "aprovar por ausência" — e é isto que este arquivo fecha: **a demonstração
 * tem de conter, em qualquer hora do dia, ao menos um assunto que começa e
 * acaba no mesmo instante.**
 */
import { describe, expect, it } from "vitest";

import { fixtureFrentes } from "@/lib/frentes/fixture";

/** Horas de corrida que já mudaram a contagem de losangos no passado (3 às 01h, 0 às 03h). */
const INSTANTES = [
  Date.UTC(2026, 8, 22, 1, 30),
  Date.UTC(2026, 8, 22, 3, 30),
  Date.UTC(2026, 8, 22, 13, 42),
  Date.UTC(2026, 8, 23, 23, 59),
];

describe("a demonstração sempre tem um assunto de um instante só (o losango de marco)", () => {
  for (const agora of INSTANTES) {
    it(`em ${new Date(agora).toISOString()} existe PR com criado_em === mergeado_em`, () => {
      const { prs } = fixtureFrentes(agora);
      const mesmoInstante = prs.filter(
        (p) => p.mergeado_em !== null && p.mergeado_em === p.criado_em,
      );
      expect(
        mesmoInstante.length,
        "nenhum PR da fixture nasce e morre no mesmo instante — o losango `.lb-tl-marco` do ASSUNTO volta a depender da hora da corrida, que foi exatamente o defeito que a rodada 14 consertou na causa",
      ).toBeGreaterThanOrEqual(1);
    });
  }

  it("o mesmo instante vale nas QUATRO datas do PR — meio-fechado não é marco", () => {
    const { prs } = fixtureFrentes(INSTANTES[0]);
    const marco = prs.find((p) => p.mergeado_em !== null && p.mergeado_em === p.criado_em);
    expect(marco, "sem PR de mesmo instante não há o que conferir").toBeDefined();
    expect(marco?.fechado_em).toBe(marco?.criado_em);
    expect(marco?.atualizado_em).toBe(marco?.criado_em);
  });
});

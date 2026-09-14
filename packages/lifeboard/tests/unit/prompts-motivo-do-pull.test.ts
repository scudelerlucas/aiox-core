import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { montarMotivoDoPull, type NumerosDoPull } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — D27 (rodada 6): PARIDADE TEXTO A TEXTO entre a frase que
 * o banco escreve e a que o TypeScript escreve.
 *
 * O crítico da rodada 5 mediu duas mentiras do `motivo` (que vai LITERAL para
 * o relatório diário da Routine ao operador):
 *   · com 3 itens de US$ 5,00 em backoff e 5 de US$ 120,00 disponíveis, ele
 *     dizia "o mais barato da fila custa US$ 120.00";
 *   · com 1 item morto e 1 item caro na fila, ele CALAVA a morte.
 * A causa era a mesma: um `case` de ramo único, onde a primeira frase
 * verdadeira silencia todas as outras.
 *
 * Agora a frase é ADITIVA e mora em DOIS lugares que precisam dizer a MESMA
 * coisa: `public.painel_fila_motivo_do_pull` (migration 0015) e
 * `montarMotivoDoPull` (core/prompts/tipos.ts). Este arquivo amarra os dois
 * sem precisar de banco:
 *   1. roda a função TS contra quatro cenários e compara com o texto LITERAL;
 *   2. exige que esse MESMO literal esteja escrito, palavra por palavra, em
 *      `supabase/tests/fila_prompts.test.sql` — o arquivo que afirma o texto
 *      contra o Postgres de verdade.
 * Se um lado mudar sozinho, o vínculo quebra aqui.
 */

const TESTE_SQL = readFileSync(
  join(__dirname, "..", "..", "supabase", "tests", "fila_prompts.test.sql"),
  "utf8",
);

function numeros(patch: Partial<NumerosDoPull>): NumerosDoPull {
  return {
    mortos: 0,
    mortosUsd: 0,
    custoEscolhidoUsd: null,
    headroomUsd: 0,
    menorDisponivelUsd: null,
    elegiveis: 0,
    emEspera: 0,
    menorEmEsperaUsd: null,
    voltaEmMin: null,
    devolvidos: 0,
    travados: 0,
    estimativaUsd: 0,
    estimativaItens: 0,
    ...patch,
  };
}

/** Os quatro cenários do crítico, com o texto que os DOIS lados devem produzir. */
const CENARIOS: ReadonlyArray<{
  rotulo: string;
  /** Bloco correspondente em supabase/tests/fila_prompts.test.sql. */
  blocoSql: string;
  entrada: NumerosDoPull;
  texto: string;
}> = [
  {
    rotulo: "1 morto + 1 que não cabe: as DUAS verdades, não só a primeira",
    blocoSql: "T11",
    entrada: numeros({
      mortos: 1,
      mortosUsd: 120,
      menorDisponivelUsd: 120,
      headroomUsd: -110,
      estimativaUsd: 120,
      estimativaItens: 1,
    }),
    texto:
      "1 item morreu sem fechar neste disparo e lançou US$ 120,00 no dia; " +
      "nada cabe agora: o mais barato disponível custa US$ 120,00 e não há espaço livre agora; " +
      "US$ 120,00 do consumo de hoje são estimativa de 1 item que morreu sem fechar",
  },
  {
    rotulo: "3 baratas em backoff: a fila em espera tem frase própria",
    blocoSql: "T12",
    entrada: numeros({
      menorDisponivelUsd: 120,
      headroomUsd: 10,
      emEspera: 3,
      menorEmEsperaUsd: 5,
      voltaEmMin: 12,
    }),
    texto:
      "nada cabe agora: o mais barato disponível custa US$ 120,00 e há US$ 10,00 livres; " +
      "3 itens de US$ 5,00 voltam em 12 min",
  },
  {
    rotulo: "B5 — item elegível travado por outra transação não é 'fila vazia'",
    blocoSql: "T13",
    entrada: numeros({ menorDisponivelUsd: 5, headroomUsd: 50, elegiveis: 1, travados: 1 }),
    texto: "1 item elegível está em uso por outra operação; tente no próximo disparo",
  },
  {
    rotulo: "o disparo que PEGA algo também fala (era `motivo: null`)",
    blocoSql: "T15",
    entrada: numeros({ custoEscolhidoUsd: 5, headroomUsd: 10 }),
    texto: "peguei o item mais antigo que cabe: US$ 5,00 de US$ 10,00 livres",
  },
];

describe("D27 — o motivo do pull é ADITIVO, e o TS diz o mesmo que o SQL", () => {
  it.each(CENARIOS)("$rotulo", ({ entrada, texto }) => {
    expect(montarMotivoDoPull(entrada)).toBe(texto);
  });

  it.each(CENARIOS)(
    "o MESMO literal está afirmado contra o banco em fila_prompts.test.sql ($blocoSql)",
    ({ texto, blocoSql }) => {
      // O texto pode estar quebrado em concatenação no SQL (`'…' || '…'`), então
      // a comparação é por PEDAÇO de oração — cada uma tem que estar lá inteira.
      for (const oracao of texto.split("; ")) {
        expect(TESTE_SQL, `${blocoSql}: "${oracao}"`).toContain(oracao);
      }
    },
  );

  it("fila realmente vazia continua tendo o nome dela", () => {
    expect(montarMotivoDoPull(numeros({}))).toBe("fila vazia para esta conta");
    expect(TESTE_SQL).toContain("fila vazia para esta conta");
  });

  it("BAIXO 1 — headroom negativo nunca vira número, nem no relatório da Routine", () => {
    const texto = montarMotivoDoPull(
      numeros({ menorDisponivelUsd: 120, headroomUsd: -3, elegiveis: 0 }),
    );
    expect(texto).toBe(
      "nada cabe agora: o mais barato disponível custa US$ 120,00 e não há espaço livre agora",
    );
    expect(texto).not.toContain("-");
    // e a vírgula decimal do português, nunca o ponto do Postgres:
    expect(texto).not.toMatch(/US\$ \d+\.\d\d/);
  });

  it("plural e singular de cada oração", () => {
    expect(montarMotivoDoPull(numeros({ mortos: 2, mortosUsd: 240 }))).toBe(
      "2 itens morreram sem fechar neste disparo e lançaram US$ 240,00 no dia",
    );
    expect(
      montarMotivoDoPull(numeros({ emEspera: 1, menorEmEsperaUsd: 5, voltaEmMin: 15 })),
    ).toBe("1 item de US$ 5,00 volta em 15 min");
    expect(montarMotivoDoPull(numeros({ devolvidos: 1 }))).toBe(
      "1 item voltou para a fila e aguarda nova tentativa",
    );
    expect(montarMotivoDoPull(numeros({ devolvidos: 3 }))).toBe(
      "3 itens voltaram para a fila e aguardam nova tentativa",
    );
    expect(montarMotivoDoPull(numeros({ travados: 2, elegiveis: 2 }))).toBe(
      "2 itens elegíveis estão em uso por outra operação; tente no próximo disparo",
    );
  });

  it("nenhuma oração cala outra: seis fatos, seis orações", () => {
    const texto = montarMotivoDoPull(
      numeros({
        mortos: 1,
        mortosUsd: 120,
        menorDisponivelUsd: 50,
        headroomUsd: 10,
        elegiveis: 0,
        emEspera: 2,
        menorEmEsperaUsd: 5,
        voltaEmMin: 7,
        devolvidos: 2,
        estimativaUsd: 120,
        estimativaItens: 1,
      }),
    );
    expect(texto.split("; ")).toHaveLength(5);
    expect(texto).toContain("1 item morreu sem fechar");
    expect(texto).toContain("nada cabe agora");
    expect(texto).toContain("2 itens de US$ 5,00 voltam em 7 min");
    expect(texto).toContain("2 itens voltaram para a fila");
    expect(texto).toContain("do consumo de hoje são estimativa");
  });
});

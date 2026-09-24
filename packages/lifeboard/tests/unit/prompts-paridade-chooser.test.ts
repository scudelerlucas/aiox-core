import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, ConsumoConta } from "@/core/prompts/tipos";
import { CONTAS, custoEstimadoParaComplexidade, fraseDoEnfileiramento } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — MÉDIO 1 (rodada 9): A PARIDADE DO CHOOSER É PROVADA,
 * CASO A CASO, CONTRA A MESMA TABELA QUE O BANCO USA.
 *
 * O que o crítico mediu na rodada 8: `fila_prompts_enfileirar` se autodeclarava
 * "ESPELHO DECLARADO de escolherConta" e divergia em dois pontos —
 *   · não filtrava `exigir_medicao_recente`, e como o `<select name="conta">`
 *     manda `""` no modo automático, QUEM DECIDE É O SQL:
 *       SQL escolheu=lsgpandora@gmail.com (exige_medicao=t, sem medição nenhuma)
 *       pull dessa conta: recusado=true "não autorizo contra saldo nenhum…"
 *   · o teste de "nunca vai caber" era `max(tetos)` no TS e o teto da conta
 *     ESCOLHIDA no trigger (BAIXO 4).
 * E o teste que deveria ter pego isso conferia o número `12`, não a escolha.
 *
 * ESTE arquivo não é mais um teste de constante. Ele LÊ O LITERAL `$casos$…$casos$`
 * de `supabase/tests/fila_prompts.test.sql` (bloco T42) — o MESMO texto que o
 * Postgres executa contra `public.painel_fila_escolher_conta` — e roda
 * `escolherConta()` sobre cada caso. Três jeitos de ficar vermelho, e é de
 * propósito:
 *   1. mudou o TS e o SQL não  → aqui fica vermelho;
 *   2. mudou o SQL e o TS não  → o bloco T42 fica vermelho;
 *   3. mexeram na tabela de casos para "consertar" um dos lados → o outro lado
 *      fica vermelho, porque a tabela é a mesma para os dois.
 */

const TESTE_SQL = join(__dirname, "..", "..", "supabase", "tests", "fila_prompts.test.sql");

interface ContaDoCaso {
  conta: string;
  teto_usd: number;
  medido_usd: number;
  em_execucao_usd: number;
  na_fila_usd: number;
  defasagem_horas: number | null;
  exige_medicao_recente: boolean;
  em_voo?: number;
  limite_em_voo?: number | null;
}

interface CasoDeParidade {
  nome: string;
  complexidade: Complexidade;
  estimado_usd: number;
  contas: ContaDoCaso[];
  esperado: {
    conta: string | null;
    cabe_hoje: boolean;
    todas_recusadas: boolean;
    nunca_cabe: boolean;
    espaco_livre_usd: number;
    todas_sem_vaga?: boolean;
  };
}

function lerCasosDoSql(): CasoDeParidade[] {
  const sql = readFileSync(TESTE_SQL, "utf8");
  const bruto = /\$casos\$(\[[\s\S]*?\])\$casos\$/.exec(sql);
  expect(
    bruto,
    "o bloco T42 de supabase/tests/fila_prompts.test.sql precisa ter a tabela de casos entre $casos$ … $casos$",
  ).not.toBeNull();
  return JSON.parse((bruto as RegExpExecArray)[1] as string) as CasoDeParidade[];
}

/** O caso do .sql → o contrato que `escolherConta` recebe da RPC de listagem. */
function paraConsumo(c: ContaDoCaso): ConsumoConta {
  return {
    conta: c.conta as ConsumoConta["conta"],
    tetoUsd: c.teto_usd,
    consumoHojeUsd: c.medido_usd,
    reservadoUsd: c.em_execucao_usd,
    naFilaUsd: c.na_fila_usd,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    // `medidoAteEm` é o fallback de `horasDeDefasagem` quando o banco não manda
    // `defasagemHoras`. Aqui o número vem do caso, então o fallback não entra —
    // mas `null` continua sendo o que significa "nunca mediu".
    medidoAteEm: c.defasagem_horas === null ? null : new Date(2026, 0, 1).toISOString(),
    defasagemHoras: c.defasagem_horas,
    exigeMedicaoRecente: c.exige_medicao_recente,
    historico: null,
    ...(c.em_voo === undefined ? {} : { emVoo: c.em_voo }),
    ...(c.limite_em_voo === undefined ? {} : { limiteEmVoo: c.limite_em_voo }),
  };
}

describe("MÉDIO 1 — o chooser do TS e o do SQL escolhem a mesma conta", () => {
  const casos = lerCasosDoSql();

  it("a tabela de casos existe e cobre os dois defeitos medidos", () => {
    expect(casos.length).toBeGreaterThanOrEqual(10);
    const nomes = casos.map((c) => c.nome).join(" | ");
    expect(nomes).toContain("MEDIO 1");
    expect(nomes).toContain("BAIXO 4");
    // P2 do Codex (PR #42): o limite de sessões em voo entra na escolha.
    expect(nomes).toContain("LIMITE DE VOO");
    // Cada caso lista as TRÊS contas da casa, na ordem de `CONTAS` — é essa
    // ordem que desempata dos dois lados.
    for (const caso of casos) {
      expect(caso.contas.map((c) => c.conta)).toEqual([...CONTAS]);
    }
  });

  it("o custo estimado de cada caso bate com a tabela de complexidade do TS", () => {
    // Se um lado mudar o custo por complexidade, o caso deixa de medir o que diz.
    for (const caso of casos) {
      expect(
        custoEstimadoParaComplexidade(caso.complexidade),
        `caso "${caso.nome}": estimado_usd do .sql × CUSTO_ESTIMADO_POR_COMPLEXIDADE`,
      ).toBe(caso.estimado_usd);
    }
  });

  for (const caso of lerCasosDoSql()) {
    it(`paridade: ${caso.nome}`, () => {
      const escolha = escolherConta(
        caso.contas.map(paraConsumo),
        caso.complexidade,
        Date.now(),
      );
      expect(escolha.conta, "conta escolhida").toBe(caso.esperado.conta);
      expect(escolha.cabeHoje, "cabe hoje").toBe(caso.esperado.cabe_hoje);
      if (!caso.esperado.nunca_cabe) {
        expect(escolha.espacoLivreUsd, "espaço livre").toBe(caso.esperado.espaco_livre_usd);
      }
      if (caso.esperado.todas_sem_vaga !== undefined) {
        expect(escolha.todasSemVaga, "todas sem vaga").toBe(caso.esperado.todas_sem_vaga);
      }
    });
  }

  it("P2 do Codex (PR #42): com conta cheia pulada, a frase diz 'entre as contas com vaga'", () => {
    const caso = casos.find((c) => c.nome.startsWith("LIMITE DE VOO: a mais folgada"));
    expect(caso, "a tabela precisa ter o caso da conta cheia pulada").toBeDefined();
    const escolha = escolherConta(
      (caso as CasoDeParidade).contas.map(paraConsumo),
      (caso as CasoDeParidade).complexidade,
      Date.now(),
    );
    expect(escolha.puladasSemVaga).toBe(1);
    expect(escolha.motivo).toContain("entre as contas com vaga de sessão");
    expect(escolha.motivo).toContain("ficaram de fora");
    expect(
      fraseDoEnfileiramento("auto_maior_espaco_com_vaga", {
        conta: "lsgpandora@gmail.com", complexidade: "alta", headroomUsd: 200,
        espacoLivreUsd: 200, custoEstimadoUsd: 50, naFilaUsd: 0, itensNaFrente: 0,
      }),
    ).toContain("maior espaço livre hoje entre as que têm vaga de sessão");
  });

  it("o caso 'todas recusadas' produz a frase que diz por que ninguém foi convidado", () => {
    const caso = casos.find((c) => c.esperado.todas_recusadas);
    expect(caso, "a tabela precisa ter o caso de TODAS recusadas").toBeDefined();
    const escolha = escolherConta(
      (caso as CasoDeParidade).contas.map(paraConsumo),
      (caso as CasoDeParidade).complexidade,
      Date.now(),
    );
    expect(escolha.motivo).toContain("Nenhuma conta autoriza gasto agora");
    expect(escolha.cabeHoje).toBe(false);
  });

  it("o caso 'nunca cabe' recusa sem escolher conta nenhuma", () => {
    const caso = casos.find((c) => c.esperado.nunca_cabe);
    expect(caso, "a tabela precisa ter o caso de NUNCA CABE").toBeDefined();
    const escolha = escolherConta(
      (caso as CasoDeParidade).contas.map(paraConsumo),
      (caso as CasoDeParidade).complexidade,
      Date.now(),
    );
    expect(escolha.conta).toBeNull();
    expect(escolha.motivo).toContain("Nunca vai caber");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BACKOFF_POR_TENTATIVA_MIN,
  CONTAS,
  JANELA_HEARTBEAT_MIN,
  MAX_TENTATIVAS,
} from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — D17 (rodada 4): o "teste espelho" que OLHA O SQL.
 *
 * O crítico hostil mediu o buraco: o bloco de paridade em
 * `roteador-de-conta.test.ts` comparava o roteador de produção com um ESPELHO
 * escrito em TypeScript, no mesmo arquivo, pela mesma pessoa. Se alguém
 * mudasse a ordem das contas na migration, os dois lados de TS continuariam
 * concordando alegremente e o teste passaria — ele nunca tinha visto o SQL.
 *
 * Este arquivo lê as migrations DO DISCO e extrai três coisas que existem em
 * dois lugares e precisam ser iguais:
 *   1. a ordem das contas no desempate (`case t.conta when '…' then 1 …`)
 *      contra `CONTAS` em `core/prompts/tipos.ts`;
 *   2. a janela de expiração do heartbeat (`now() - interval 'N minutes'`)
 *      contra `JANELA_HEARTBEAT_MIN`;
 *   3. o default de `max_tentativas` contra `MAX_TENTATIVAS`.
 *
 * Falha aqui = TS e banco divergiram. O conserto é mudar os DOIS, no mesmo
 * commit — nunca afrouxar o teste.
 */

const DIR_MIGRATIONS = join(__dirname, "..", "..", "supabase", "migrations");
const ARQUIVOS = [
  "0012_lifeboard_v3_fila_posse_e_tentativas.sql",
  "0013_lifeboard_v3_fila_contabilidade.sql",
  "0014_lifeboard_v3_fila_pull_e_mensagens.sql",
] as const;

/** As 6 migrations da fila — a varredura do `raise` (#3) vale para todas. */
const MIGRATIONS_DA_FILA = [
  "0007_lifeboard_v3_fila_prompts.sql",
  "0009_lifeboard_v3_fila_ajustes.sql",
  "0011_lifeboard_v3_fila_ajustes_2.sql",
  "0012_lifeboard_v3_fila_posse_e_tentativas.sql",
  "0013_lifeboard_v3_fila_contabilidade.sql",
  "0014_lifeboard_v3_fila_pull_e_mensagens.sql",
] as const;

function ler(arquivo: string): string {
  return readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8");
}

/** Tira os comentários de linha: só o SQL que o Postgres executa vale como prova. */
function semComentarios(sql: string): string {
  return sql
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith("--"))
    .join("\n");
}

/** `case t.conta when 'a@b' then 1 when 'c@d' then 2 …` → ["a@b", "c@d", …]. */
function ordemDasContas(sql: string): string[] {
  const posicoes = new Map<number, string>();
  const regex = /when\s+'([^']+@[^']+)'\s*then\s+(\d+)/g;
  let achado: RegExpExecArray | null = regex.exec(sql);
  while (achado !== null) {
    const conta = achado[1] as string;
    const posicao = Number.parseInt(achado[2] as string, 10);
    posicoes.set(posicao, conta);
    achado = regex.exec(sql);
  }
  return [...posicoes.entries()].sort((a, b) => a[0] - b[0]).map(([, conta]) => conta);
}

/** Toda janela `now() - interval 'N minutes'` do arquivo (a expiração do heartbeat). */
function janelasEmMinutos(sql: string): number[] {
  const regex = /now\(\)\s*-\s*interval\s*'(\d+)\s*minutes'/g;
  const achados: number[] = [];
  let achado: RegExpExecArray | null = regex.exec(sql);
  while (achado !== null) {
    achados.push(Number.parseInt(achado[1] as string, 10));
    achado = regex.exec(sql);
  }
  return achados;
}

/**
 * #6 (rodada 5): o backoff. `disponivel_em = now() + (interval 'N minutes' *
 * greatest(tentativas, 1))` — o único lugar do SQL onde a constante de D19
 * aparece, e que o extrator de janelas acima NÃO vê (ele só olha `now() -
 * interval`). Ficava fora do espelho: mudar 15 para 99 no SQL não quebrava
 * nada em TS.
 */
function backoffEmMinutos(sql: string): number[] {
  const regex = /disponivel_em\s*=\s*now\(\)\s*\+\s*\(\s*interval\s*'(\d+)\s*minutes'/g;
  const achados: number[] = [];
  let achado: RegExpExecArray | null = regex.exec(sql);
  while (achado !== null) {
    achados.push(Number.parseInt(achado[1] as string, 10));
    achado = regex.exec(sql);
  }
  return achados;
}

/** `raise … '%s'` — o erro de #3: `raise` interpola com `%`; `%s` é do `format`. */
function raisesComPorcentoS(sql: string): string[] {
  return sql
    .split("\n")
    .filter((linha) => /raise\s+(exception|notice|warning)[^;]*%s/i.test(linha));
}

describe("D17 — o espelho olha o SQL (migrations lidas do disco)", () => {
  it("as migrations existem e têm conteúdo (se o caminho quebrar, o teste grita)", () => {
    for (const arquivo of ARQUIVOS) {
      expect(ler(arquivo).length).toBeGreaterThan(1000);
    }
  });

  it("a ordem de desempate das contas no SQL é a ordem de CONTAS no TS", () => {
    for (const arquivo of ARQUIVOS) {
      const ordem = ordemDasContas(semComentarios(ler(arquivo)));
      if (ordem.length === 0) continue; // migration que não repete o desempate
      expect(ordem, `${arquivo}: ordem das contas`).toEqual([...CONTAS]);
    }
  });

  it("0013 (a migration desta rodada) declara o desempate — não herda em silêncio", () => {
    const ordem = ordemDasContas(semComentarios(ler("0013_lifeboard_v3_fila_contabilidade.sql")));
    expect(ordem).toEqual([...CONTAS]);
  });

  it("a janela de expiração do heartbeat no SQL é JANELA_HEARTBEAT_MIN", () => {
    const janelas = ARQUIVOS.flatMap((a) => janelasEmMinutos(semComentarios(ler(a))));
    expect(janelas.length).toBeGreaterThan(0);
    for (const minutos of janelas) {
      expect(minutos).toBe(JANELA_HEARTBEAT_MIN);
    }
  });

  it("o default de max_tentativas no SQL é MAX_TENTATIVAS", () => {
    const sql = semComentarios(ler("0012_lifeboard_v3_fila_posse_e_tentativas.sql"));
    const achado = /alter column max_tentativas set default (\d+)/.exec(sql);
    expect(achado, "0012 precisa declarar o default de max_tentativas").not.toBeNull();
    expect(Number.parseInt((achado as RegExpExecArray)[1] as string, 10)).toBe(MAX_TENTATIVAS);
  });

  it("0013 é aditiva: não dropa tabela nem coluna", () => {
    const sql = semComentarios(ler("0013_lifeboard_v3_fila_contabilidade.sql")).toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    // As únicas remoções permitidas são assinaturas de função substituídas e um
    // índice não-único trocado por um único.
    expect(sql).toContain("drop function if exists");
  });

  it("#6 — o backoff do SQL (disponivel_em) é BACKOFF_POR_TENTATIVA_MIN", () => {
    const backoffs = ARQUIVOS.flatMap((a) => backoffEmMinutos(semComentarios(ler(a))));
    expect(backoffs.length, "0013/0014 precisam declarar o backoff").toBeGreaterThan(0);
    for (const minutos of backoffs) {
      expect(minutos).toBe(BACKOFF_POR_TENTATIVA_MIN);
    }
  });

  it("#3 — nenhuma migration da fila usa %s num `raise` (isso é `format`)", () => {
    for (const arquivo of MIGRATIONS_DA_FILA) {
      const linhas = raisesComPorcentoS(semComentarios(ler(arquivo)));
      expect(linhas, `${arquivo}: raise com %s`).toEqual([]);
    }
  });

  it("0014 é aditiva: não dropa tabela, coluna, função nem índice", () => {
    const sql = semComentarios(ler("0014_lifeboard_v3_fila_pull_e_mensagens.sql")).toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop function");
    expect(sql).not.toContain("drop index");
    // E re-aplicável: índice com `if not exists`, funções com `create or replace`.
    expect(sql).toContain("create index if not exists");
    expect(sql).toContain("create or replace function");
  });

  it("D21 — a elegibilidade do pull está no `where`, não num laço com janela", () => {
    const sql = semComentarios(ler("0014_lifeboard_v3_fila_pull_e_mensagens.sql"));
    // O filtro que decide: custo estimado <= headroom, um item só.
    expect(sql).toMatch(/custo_estimado_usd\s*<=\s*v_headroom/);
    expect(sql).toMatch(/order by f\.criado_em, f\.id\s*\n\s*limit 1/);
    // E nenhuma janela de 50 sobrou no caminho do pull.
    expect(sql).not.toContain("limit 50");
    expect(sql).not.toContain("for rec in");
  });
});

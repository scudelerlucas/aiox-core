import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BACKOFF_POR_TENTATIVA_MIN,
  CONTAS,
  JANELA_HEARTBEAT_MIN,
  LIMITE_DEFASAGEM_HORAS,
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
  "0015_lifeboard_v3_fila_dia_e_dono.sql",
  "0016_lifeboard_v3_consumo_por_entidade.sql",
] as const;

/** As 6 migrations da fila — a varredura do `raise` (#3) vale para todas. */
const MIGRATIONS_DA_FILA = [
  "0007_lifeboard_v3_fila_prompts.sql",
  "0009_lifeboard_v3_fila_ajustes.sql",
  "0011_lifeboard_v3_fila_ajustes_2.sql",
  "0012_lifeboard_v3_fila_posse_e_tentativas.sql",
  "0013_lifeboard_v3_fila_contabilidade.sql",
  "0014_lifeboard_v3_fila_pull_e_mensagens.sql",
  "0015_lifeboard_v3_fila_dia_e_dono.sql",
  "0016_lifeboard_v3_consumo_por_entidade.sql",
] as const;

/** O teste COMPORTAMENTAL da fila — o que este arquivo NÃO é (ver o bloco D28). */
const TESTE_SQL = join(__dirname, "..", "..", "supabase", "tests", "fila_prompts.test.sql");

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

/**
 * ═══ D28 (rodada 6) — O QUE ESTE ARQUIVO É, E O QUE ELE NÃO É ═══
 *
 * O crítico da rodada 5 mediu, e está certo: **os testes deste arquivo são de
 * ORTOGRAFIA.** Ele aplicou a mutação `and f.custo_estimado_usd <= v_headroom +
 * 100000` na migration — o pull passa a ignorar o teto diário inteiro — e
 * 775/775 testes do vitest passaram. Um `expect(sql).toMatch(/regex/)` não
 * distingue um pull que respeita o orçamento de um que o estoura.
 *
 * A guarda COMPORTAMENTAL é `supabase/tests/fila_prompts.test.sql`, rodado
 * contra um Postgres de verdade (ver DEPLOY.md § "Teste da fila de prompts").
 * Nesta rodada a mesma mutação foi reaplicada e o bloco T16 daquele arquivo
 * devolveu FALHA — é ele que a pega, não este.
 *
 * O que ESTE arquivo passa a guardar é o CONTRATO MÍNIMO entre os dois: toda
 * função que o teste SQL chama precisa existir numa migration versionada. Sem
 * isto, alguém pode renomear uma função na migration e o teste SQL vira um
 * arquivo que falha por "função não existe" sem ninguém notar em CI.
 */
describe("D28 — contrato mínimo: o teste SQL só chama função que existe nas migrations", () => {
  it("toda `public.<fn>(` citada em fila_prompts.test.sql é criada numa migration", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    const citadas = new Set<string>();
    // `\(` COLADO no nome: é assim que se chama função. `insert into
    // public.painel_frentes_sessoes (…)` tem espaço/quebra de linha antes do
    // parêntese — é tabela, e tabela não entra nesta conta.
    const regex = /public\.([a-z0-9_]+)\(/g;
    let achado: RegExpExecArray | null = regex.exec(teste);
    while (achado !== null) {
      citadas.add(achado[1] as string);
      achado = regex.exec(teste);
    }
    expect(citadas.size, "o teste SQL precisa chamar alguma função").toBeGreaterThan(5);

    const todasAsMigrations = MIGRATIONS_DA_FILA.map((a) => ler(a)).join("\n");
    const faltando = [...citadas].filter(
      (fn) =>
        !todasAsMigrations.includes(`create or replace function public.${fn}`) &&
        // tabelas e views citadas com o mesmo prefixo não são função
        !todasAsMigrations.includes(`create table if not exists public.${fn}`),
    );
    expect(faltando, "funções citadas no teste SQL sem definição nas migrations").toEqual([]);
  });

  it("os cinco casos que o crítico pediu estão NOMEADOS no teste SQL", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    for (const marca of [
      "T01 D25 virada do dia",
      "T04 D26 dono do morto",
      "T08 D30",
      "T11 D27",
      "T16 o teto do dia barra o pull",
    ]) {
      expect(teste, `caso ausente: ${marca}`).toContain(marca);
    }
    // e cada bloco termina em veredito explícito, nunca em silêncio:
    const oks = teste.match(/RESULTADO: ok —/g) ?? [];
    const falhas = teste.match(/FALHA: /g) ?? [];
    expect(oks.length).toBeGreaterThanOrEqual(19);
    expect(falhas.length).toBeGreaterThanOrEqual(oks.length);
  });

  it("0015 é aditiva — a única remoção é a assinatura de 3 args do ajustar_custo", () => {
    const sql = semComentarios(ler("0015_lifeboard_v3_fila_dia_e_dono.sql")).toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop index");
    const drops = sql.match(/drop function[^;]*;/g) ?? [];
    expect(drops).toEqual([
      "drop function if exists public.fila_prompts_ajustar_custo(text, uuid, numeric);",
    ]);
    expect(sql).toContain("add column if not exists ultimo_worker_id");
    expect(sql).toContain("create or replace function");
  });

  it("D25 — o dia do item no SQL é o do FECHAMENTO (a régua de painel_fila_itens_do_dia)", () => {
    const sql = semComentarios(ler("0016_lifeboard_v3_consumo_por_entidade.sql"));
    expect(sql).toMatch(/painel_dia_operador\(f\.concluido_em\)\s*=\s*p_dia/);
    // e a régua de `ajustar_custo` é a MESMA (era `pego_em` de um lado e
    // `concluido_em` do outro — o botão prometia e não movia número nenhum):
    expect(sql).toMatch(/painel_dia_operador\(v_row\.concluido_em\)\s*<>\s*public\.painel_dia_operador\(\)/);
    expect(sql).not.toContain("coalesce(f.pego_em, f.criado_em)");
  });
});

/**
 * ═══ RODADA 7 — o que 0016 tem que dizer, e o que ela NÃO pode ter ═══
 *
 * Contrato mínimo de novo, com o mesmo aviso do bloco D28: estes testes são de
 * ORTOGRAFIA. Quem prova COMPORTAMENTO é `supabase/tests/fila_prompts.test.sql`
 * — blocos T21/T22/T25 (D31), T26/T27/T28 (D32) e T29 (MÉDIO 4/BAIXO 9), e as
 * seis mutações do relatório da rodada, cada uma derrubando ao menos 2 blocos.
 */
describe("D31/D32 — 0016 (a migration da rodada 7)", () => {
  const SQL_0016 = () => semComentarios(ler("0016_lifeboard_v3_consumo_por_entidade.sql"));

  it("é aditiva — a única remoção é a assinatura de 13 args do motivo_do_pull", () => {
    const sql = SQL_0016().toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop index");
    const drops = sql.match(/drop function[^;]*;/g) ?? [];
    expect(drops).toHaveLength(1);
    expect(drops[0]).toContain("painel_fila_motivo_do_pull");
    expect(sql).toContain("add column if not exists exigir_medicao_recente");
    expect(sql).toContain("create or replace function");
  });

  it("D31 — o `left join lateral` NÃO filtra por dia (era a cobrança em dobro)", () => {
    const sql = SQL_0016();
    // O trecho entre `left join lateral (` e `) ses on true` é a dedup por
    // ENTIDADE: nele não pode sobrar nenhuma comparação com `p_dia`.
    const inicio = sql.indexOf("left join lateral (");
    const fim = sql.indexOf(") ses on true", inicio);
    expect(inicio, "0016 precisa ter o lateral da dedup").toBeGreaterThan(0);
    const lateral = sql.slice(inicio, fim);
    expect(lateral).toContain("s.sessao_id = f.session_id");
    expect(lateral).toContain("s.custo_usd is not null");
    expect(lateral).not.toContain("p_dia");
    // E a contribuição é 0 ou o custo inteiro — nunca uma subtração (que fazia
    // a estimativa virar PISO quando o real era menor).
    expect(sql).toContain("case when ses.custo_usd is null then f.custo_usd else 0 end");
    expect(sql).not.toContain("greatest(f.custo_usd - ses.custo_usd");
  });

  it("D32 — o limite de defasagem do SQL é LIMITE_DEFASAGEM_HORAS", () => {
    const sql = SQL_0016();
    const achados = [...sql.matchAll(/p_defasagem_horas\s*>\s*(\d+)/g)].map((m) =>
      Number.parseInt(m[1] as string, 10),
    );
    expect(achados.length, "0016 precisa comparar a defasagem com o limite").toBeGreaterThan(0);
    for (const horas of achados) expect(horas).toBe(LIMITE_DEFASAGEM_HORAS);
    // E a coluna que liga a trava nasce DESLIGADA: nada muda até o operador querer.
    expect(sql).toMatch(/exigir_medicao_recente boolean not null default false/);
  });

  it("D32 — nenhuma linha de 0016 mexe no VALOR do teto (isso é do operador)", () => {
    const sql = SQL_0016().toLowerCase();
    expect(sql).not.toMatch(/update\s+public\.painel_teto_diario\s+set\s+teto_usd/);
    expect(sql).not.toMatch(/alter\s+column\s+teto_usd\s+set\s+default/);
  });

  it("MÉDIO 4/BAIXO 9 — medido ZERO é ajustável e o enum não chega à tela", () => {
    const sql = SQL_0016();
    expect(sql).toMatch(/not v_row\.custo_e_estimativa and coalesce\(v_row\.custo_usd, 0\) <> 0/);
    expect(sql).toContain("public.painel_fila_estado_br(v_row.estado)");
    // A recusa de estado não pode voltar a interpolar o enum cru.
    expect(sql).not.toMatch(/\(este está %\)[\s\S]{0,40}v_row\.estado\s*$/m);
  });

  it("os blocos novos do teste SQL existem, e cada decisão de dinheiro tem DOIS", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    for (const marca of [
      "T21 · D31",
      "T22 · D31",
      "T23 · D26 POSSE, SEGUNDO CAMINHO",
      "T24 · D30/D31 DINHEIRO, SEGUNDO CAMINHO",
      "T25 · D31, SEGUNDO CAMINHO",
      "T26 · D32a/D32b",
      "T27 · D32c",
      "T28 · D32d",
      "T29 · MÉDIO 4 + BAIXO 9",
    ]) {
      expect(teste, `caso ausente: ${marca}`).toContain(marca);
    }
    const oks = teste.match(/RESULTADO: ok —/g) ?? [];
    expect(oks.length).toBeGreaterThanOrEqual(29);
  });
});

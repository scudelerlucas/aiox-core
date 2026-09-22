import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { Complexidade } from "@/core/prompts/tipos";
import {
  BACKOFF_POR_TENTATIVA_MIN,
  CONTAS,
  CUSTO_ESTIMADO_POR_COMPLEXIDADE,
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

/**
 * [rodada 10] As duas listas abaixo eram ESCRITAS À MÃO, e ficaram para trás:
 * faltavam a 0017, a 0020 e a 0021, e a 0021 derrubou este teste ao declarar
 * uma função nova. É o mesmo defeito que o CodeRabbit achou na sequência de
 * implantação do DEPLOY.md — lista humana que envelhece calada.
 *
 * Agora saem do DISCO, em ordem. Migration nova entra sozinha; o teste deixa
 * de ter uma lista para alguém esquecer de atualizar.
 */
function migrationsDoDisco(): readonly string[] {
  return readdirSync(DIR_MIGRATIONS)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith(".test.sql"))
    .sort();
}

/** Onde as funções vivem: todas as migrations, porque `create or replace` anda. */
const ARQUIVOS = migrationsDoDisco();

/**
 * As migrations da fila — a varredura do `raise` (#3) vale para todas.
 *
 * ALTO 2 (rodada 13): o filtro era só por NOME DE ARQUIVO, e as duas
 * migrations mais recentes do dinheiro não casavam com nenhuma das palavras —
 * `0027_lifeboard_v3_ultima_palavra_do_dinheiro` e
 * `0028_lifeboard_v3_credito_sem_dia_e_a_tela_que_sabe` ficavam de fora de
 * TODAS as guardas desta lista, inclusive da que exige que função citada pelo
 * teste SQL exista numa migration. O buraco só apareceu quando uma função
 * nasceu SÓ na 0027 (`painel_custo_maximo_por_item`): até então toda função
 * da 0027 também existia numa migration antiga de nome casado, e a ausência
 * ficava invisível. O filtro passa a olhar o CONTEÚDO — migration que declara
 * função da fila ou do caixa é migration da fila, tenha o nome que tiver.
 */
const MIGRATIONS_DA_FILA = migrationsDoDisco().filter(
  (f) =>
    /fila|caixa|livro_razao|consumo_por_entidade/.test(f) ||
    /create or replace function public\.(fila_prompts_|painel_(fila|caixa)_)/.test(
      readFileSync(join(DIR_MIGRATIONS, f), "utf8"),
    ),
);

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
    // [rodada 10] O piso era 1000 caracteres, calibrado para a lista escolhida
    // a dedo. Lendo o diretório inteiro entram migrations antigas e curtas (a
    // menor tem 844), e o número virava um obstáculo sem sentido: o que este
    // teste guarda é o CAMINHO — se `DIR_MIGRATIONS` quebrar, `ler` estoura ou
    // devolve vazio. O piso passa a dizer isso, e nada além disso.
    expect(ARQUIVOS.length, "nenhuma migration encontrada no disco").toBeGreaterThan(15);
    for (const arquivo of ARQUIVOS) {
      expect(ler(arquivo).length, arquivo).toBeGreaterThan(100);
    }
  });

  /*
   * [rodada 12] A casa passou de 3 para 4 contas (`arborcactus@gmail.com`,
   * que existe em produção com teto 500 desde 21/09/2026). Migration aplicada
   * não se edita, então as antigas continuam listando as 3 primeiras — e é
   * correto que continuem: a ordem delas é um PREFIXO da ordem de hoje, e o
   * `else 9` que todas trazem põe qualquer conta nova depois, na posição certa.
   *
   * O que este espelho passa a exigir, e é mais forte do que exigia antes:
   *   (a) nenhuma migration inverte a ordem — toda lista é prefixo de CONTAS;
   *   (b) a ÚLTIMA migration que declara o desempate lista TODAS as contas.
   * Era (b) que faltava: com a regra antiga, "todo arquivo igual a CONTAS",
   * acrescentar uma conta obrigaria a reescrever o passado ou a afrouxar o
   * teste — e a segunda saída é a que acontece na pressa.
   */
  it("nenhuma migration inverte a ordem de desempate (toda lista é prefixo de CONTAS)", () => {
    for (const arquivo of ARQUIVOS) {
      const ordem = ordemDasContas(semComentarios(ler(arquivo)));
      if (ordem.length === 0) continue; // migration que não repete o desempate
      expect(ordem, `${arquivo}: ordem das contas`).toEqual(
        [...CONTAS].slice(0, ordem.length),
      );
    }
  });

  it("a ÚLTIMA migration que declara o desempate lista TODAS as contas de CONTAS", () => {
    const comOrdem = ARQUIVOS.filter(
      (a) => ordemDasContas(semComentarios(ler(a))).length > 0,
    );
    expect(comOrdem.length, "nenhuma migration declara o desempate").toBeGreaterThan(0);
    const ultima = comOrdem[comOrdem.length - 1] as string;
    expect(
      ordemDasContas(semComentarios(ler(ultima))),
      `${ultima} é a última palavra sobre o desempate e precisa citar todas as contas`,
    ).toEqual([...CONTAS]);
  });

  it("0013 (a migration da rodada 4) declara o desempate — não herda em silêncio", () => {
    const ordem = ordemDasContas(semComentarios(ler("0013_lifeboard_v3_fila_contabilidade.sql")));
    expect(ordem.length, "0013 precisa declarar o desempate").toBeGreaterThan(0);
    expect(ordem).toEqual([...CONTAS].slice(0, ordem.length));
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

  /**
   * VARREDURA DE GENERALIZAÇÃO (rodada 14) · UNIVERSO POR CONVENÇÃO.
   *
   * Esta guarda varria `MIGRATIONS_DA_FILA` — o subconjunto escolhido por nome
   * de arquivo OU por conteúdo. Só que o defeito que ela pega (`raise` com
   * `%s`, que o Postgres imprime literalmente, porque quem tem `%s` é o
   * `format`) não é um defeito "da fila": é de QUALQUER migration, e a
   * mensagem quebrada chega ao operador do mesmo jeito. Guarda que afirma uma
   * propriedade universal tem de varrer o universo — é o ALTO 1 desta rodada,
   * em TypeScript. Passa a varrer `ARQUIVOS`, que é o diretório inteiro, com
   * piso no número de arquivos varridos.
   */
  it("#3 — NENHUMA migration usa %s num `raise` (isso é `format`)", () => {
    expect(ARQUIVOS.length, "a varredura não achou migration nenhuma").toBeGreaterThan(15);
    for (const arquivo of ARQUIVOS) {
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
      "T24 · MÉDIO 3 + ALTO 1, SEGUNDO CAMINHO",
      "T25 · D31/D41, SEGUNDO CAMINHO",
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

/**
 * ═══ RODADA 8 — o que 0018 tem que dizer, e o que ela NÃO pode ter ═══
 *
 * Mesmo aviso dos dois blocos acima, sem eufemismo: ESTES testes são de
 * ORTOGRAFIA. Quem prova COMPORTAMENTO é `supabase/tests/fila_prompts.test.sql`
 * — T30/T22 (D33, ALTO 1), T31/T37 (D34a, ALTO 2), T32/T38 (D34b, ALTO 2),
 * T33/T39 (D35, ALTO 3), T24/T40 (MÉDIO 3), T34/T41 (MÉDIO 4), T35 (BAIXO 4 e
 * 5) e T36 (BAIXO 1) — rodados contra o Postgres de verdade. Cada ALTO e cada
 * MÉDIO desta rodada tem DOIS blocos, por caminhos diferentes: o crítico da
 * rodada 7 mediu 3 mutações que não derrubaram bloco nenhum, e foi assim que
 * os ALTOS passaram.
 */
describe("D33/D34/D35 — 0018 (a migration da rodada 8)", () => {
  const SQL_0018 = () => semComentarios(ler("0018_lifeboard_v3_caixa_auditavel.sql"));

  it("é ADITIVA — nenhuma remoção de função, tabela, coluna ou índice", () => {
    const sql = SQL_0018().toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop index");
    expect(sql).not.toContain("drop function");
    expect(sql).not.toContain("drop view");
    expect(sql).toContain("add column if not exists custo_origem");
    expect(sql).toContain("create or replace function");
    expect(sql).toContain("create or replace view");
  });

  it("D33 — o dia de cobrança é o do FECHAMENTO do item, e a view o usa", () => {
    const sql = SQL_0018();
    expect(sql).toContain("create or replace function public.painel_sessao_dia_de_cobranca");
    // o dia do ITEM entra na conta, e é `concluido_em` que o define:
    expect(sql).toMatch(/painel_dia_operador\(f\.concluido_em\)[\s\S]{0,400}f\.session_id = p_sessao_id/);
    // e a view de consumo por dia passou a chamar a função (não mais o instante cru):
    expect(sql).toMatch(/as dia[\s\S]{0,200}from public\.painel_frentes_sessoes s/);
    expect(sql).toContain("public.painel_sessao_dia_de_cobranca(\n    s.sessao_id");
  });

  it("D34b — `and s.conta = f.conta` NÃO está mais no lateral da dedup", () => {
    const sql = SQL_0018();
    const inicio = sql.indexOf("left join lateral (");
    const fim = sql.indexOf(") ses on true", inicio);
    expect(inicio, "0018 precisa ter o lateral da dedup").toBeGreaterThan(0);
    const lateral = sql.slice(inicio, fim);
    expect(lateral).toContain("s.sessao_id = f.session_id");
    expect(lateral).not.toContain("s.conta = f.conta");
    // BAIXO 7: a linha morta saiu, e a ordenação deixa a equivalência explícita.
    expect(lateral).not.toContain("s.custo_usd is not null");
    expect(lateral).toContain("order by s.custo_usd desc nulls last");
    // A contribuição continua sendo 0 ou o custo inteiro — nunca uma subtração.
    expect(sql).toContain("case when ses.custo_usd is null then f.custo_usd else 0 end");
  });

  it("D35 — `painel_fila_medido_ate` só olha sessão COM custo", () => {
    const sql = SQL_0018();
    const inicio = sql.indexOf("create or replace function public.painel_fila_medido_ate");
    const fim = sql.indexOf("$$;", inicio);
    expect(inicio).toBeGreaterThan(0);
    expect(sql.slice(inicio, fim)).toContain("s.custo_usd is not null");
  });

  it("BAIXO 4 — o 150 fantasma NÃO existe mais no caminho do dinheiro", () => {
    const sql = SQL_0018();
    expect(sql).not.toMatch(/v_teto\s*:=\s*150/);
    expect(sql).toMatch(/não tem teto diário declarado no painel/);
  });

  it("BAIXO 5 — todo `headroom_usd` do pull sai clampado em 0", () => {
    const sql = SQL_0018();
    const saidas = [...sql.matchAll(/'headroom_usd',\s*round\(([^)]*\)?[^,]*),\s*2\)/g)].map((m) => m[1]);
    expect(saidas.length, "o pull precisa devolver headroom_usd").toBeGreaterThanOrEqual(3);
    for (const expr of saidas) expect(expr).toContain("greatest(");
  });

  it("MÉDIO 4 — a trava do ajuste olha a ORIGEM, não o valor", () => {
    const sql = SQL_0018();
    expect(sql).toMatch(/v_row\.custo_origem = 'medido' and coalesce\(v_row\.custo_usd, 0\) <> 0/);
    expect(sql).not.toMatch(/not v_row\.custo_e_estimativa and coalesce\(v_row\.custo_usd, 0\) <> 0/);
    // e o ajuste GRAVA a origem do operador:
    expect(sql).toContain("custo_origem = 'operador'");
    // o fechamento grava a da sessão, o lançamento da casa grava a dela:
    expect(sql).toContain("custo_origem = 'medido'");
    expect(sql).toContain("custo_origem = 'estimativa'");
  });

  it("MÉDIO 3 — `itens` conta o que a fila rodou, sem filtro de contribuição", () => {
    const sql = SQL_0018();
    expect(sql).toMatch(/'itens', \(select count\(\*\) from public\.painel_fila_itens_do_dia\(t\.conta, v_dia\) d\)/);
    expect(sql).toContain("'itens_com_contribuicao'");
  });

  it("D34a — as três portas que vinculam sessão consultam a conta dona", () => {
    const sql = SQL_0018();
    expect(sql).toContain("create or replace function public.painel_sessao_dona");
    const chamadas = sql.match(/v_dona := public\.painel_sessao_dona\(v_sess\);/g) ?? [];
    expect(chamadas, "heartbeat + fechar + ajustar_custo").toHaveLength(3);
    const recusas = sql.match(/Esta sessão é da conta % — não dá para vinculá-la a um item da conta %\./g) ?? [];
    expect(recusas).toHaveLength(3);
  });

  it("NENHUMA linha de 0018 mexe no VALOR do teto (isso é do operador)", () => {
    const sql = SQL_0018().toLowerCase();
    expect(sql).not.toMatch(/update\s+public\.painel_teto_diario\s+set\s+teto_usd/);
    expect(sql).not.toMatch(/alter\s+column\s+teto_usd\s+set\s+default/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.painel_teto_diario/);
  });

  it("os blocos novos do teste SQL existem, e cada ALTO/MÉDIO tem DOIS", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    for (const marca of [
      "T30 · D33",
      "T31 · D34a",
      "T32 · D34b",
      "T33 · D35",
      "T34 · MÉDIO 4",
      "T35 · BAIXO 4 + BAIXO 5",
      "T36 · BAIXO 1",
      "T37 · D34a, SEGUNDO CAMINHO",
      "T38 · D34b, SEGUNDO CAMINHO",
      "T39 · D35, SEGUNDO CAMINHO",
      "T40 · MÉDIO 3, TERCEIRO CAMINHO",
      "T41 · MÉDIO 4, SEGUNDO CAMINHO",
    ]) {
      expect(teste, `caso ausente: ${marca}`).toContain(marca);
    }
    const oks = teste.match(/RESULTADO: ok —/g) ?? [];
    expect(oks.length).toBeGreaterThanOrEqual(41);
  });

  it("BAIXO 8 — todo bloco que MEDE dinheiro limpa a conta de prova antes", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    const blocos = teste.split(/(?:^|\n)do \$\$/).slice(1);
    expect(blocos.length).toBeGreaterThanOrEqual(51);

    /**
     * D43 (rodada 9): a suíte tem blocos que NÃO tocam a conta de prova — T42
     * roda o chooser como função pura sobre uma tabela de casos, T51 só olha
     * os gatilhos do catálogo, T62 (pós-merge) só confere que a checagem de
     * dono pede o lock da entidade certa. Eles não limpam porque não medem
     * dinheiro.
     *
     * [pós-merge] A régua era `limpezas >= blocos - 3`: um número mágico que
     * todo bloco novo sem dinheiro obrigava a mexer, e que dizia "3" sem
     * apontar QUAIS. Agora ela pergunta bloco a bloco — quem ESCREVE dinheiro
     * limpa antes —, e quando falha ela NOMEIA o bloco em vez de mostrar dois
     * números.
     */
    const escreveDinheiro = (b: string): boolean =>
      /public\.painel_caixa_lancar/.test(b) ||
      /public\.fila_prompts_(enfileirar|pegar|fechar|cancelar|ajustar|heartbeat)/.test(b);
    const semLimpeza = blocos
      .filter(escreveDinheiro)
      .filter((b) => !/delete from public\.painel_frentes_sessoes where conta/.test(b))
      .map((b) => /T\d+/.exec(b)?.[0] ?? "bloco sem marca");
    expect(semLimpeza, "bloco que escreve dinheiro sem limpar a conta de prova antes").toEqual([]);
  });
});

/**
 * ═══ RODADA 9 — O LIVRO-RAZÃO (0019) ═══
 *
 * Mesmo aviso de sempre, sem eufemismo: ESTES testes são de ORTOGRAFIA. Quem
 * prova COMPORTAMENTO é `supabase/tests/fila_prompts.test.sql` — T43 (ALTO 1),
 * T44 (ALTO 2), T46 (ALTO 3), T47 (ALTO 4), T42 (MÉDIO 1), T50/T24/T40
 * (MÉDIO 3), T49 (MÉDIO 5), T45 (D12/M23), T48 (a imutabilidade) e T51 (a
 * barreira) — rodados contra o Postgres de verdade.
 */
describe("D37–D43 — 0019 (a migration do livro-razão)", () => {
  const SQL_0019 = () => semComentarios(ler("0019_lifeboard_v3_livro_razao.sql"));

  it("é ADITIVA — nenhuma remoção de função, tabela, coluna, índice ou view", () => {
    const sql = SQL_0019().toLowerCase();
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop index");
    expect(sql).not.toContain("drop function");
    expect(sql).not.toContain("drop view");
    expect(sql).toContain("create table if not exists public.painel_caixa_lancamentos");
    expect(sql).toContain("create or replace function");
    expect(sql).toContain("create or replace view");
  });

  it("D37 — o livro é IMUTÁVEL e o gatilho que recusa existe", () => {
    const sql = SQL_0019();
    expect(sql).toContain("create or replace function public.painel_caixa_imutavel");
    expect(sql).toMatch(/before update or delete on public\.painel_caixa_lancamentos/);
    expect(sql).toContain("O livro-razão do caixa é imutável");
  });

  it("D37 — nenhum lançamento novo cai num dia passado (o dia é sempre hoje)", () => {
    const sql = SQL_0019();
    const inicio = sql.indexOf("create or replace function public.painel_caixa_lancar(");
    const fim = sql.indexOf("$$;", inicio);
    expect(inicio).toBeGreaterThan(0);
    const corpo = sql.slice(inicio, fim);
    // A ÚNICA atribuição de `v_dia` dentro da porta de escrita é o dia de hoje.
    const atribuicoes = [...corpo.matchAll(/v_dia\s*:=\s*([^;]+);/g)].map((m) => m[1]);
    expect(atribuicoes).toEqual(["public.painel_dia_operador()"]);
  });

  it("D40 — zero é NÃO-LANÇAMENTO, e isso é um `check` da tabela", () => {
    const sql = SQL_0019();
    expect(sql).toMatch(/valor_usd\s+numeric not null check \(valor_usd <> 0\)/);
    // e a sessão sem custo (ou com custo zero) não estorna o que o item lançou
    expect(sql).toMatch(/if new\.custo_usd is null or new\.custo_usd = 0 then\n\s*return null;/);
  });

  it("D41 — as leituras do dia saem TODAS do livro", () => {
    const sql = SQL_0019();
    expect(sql).toMatch(/create or replace view public\.painel_consumo_por_conta_dia as[\s\S]{0,600}from public\.painel_caixa_lancamentos l/);
    expect(sql).toMatch(/create or replace function public\.painel_fila_consumo_do_dia[\s\S]{0,400}public\.painel_caixa_do_dia\(p_conta, p_dia\)/);
    expect(sql).toMatch(/create or replace function public\.painel_fila_itens_do_dia[\s\S]{0,600}from public\.painel_caixa_lancamentos l/);
    expect(sql).toMatch(/create or replace function public\.painel_fila_medido_ate[\s\S]{0,400}max\(l\.medido_em\)/);
  });

  it("D42 — o chooser é função PURA e `enfileirar` chama ELE (não um laço próprio)", () => {
    const sql = SQL_0019();
    expect(sql).toContain("create or replace function public.painel_fila_escolher_conta");
    expect(sql).toContain("public.painel_fila_escolher_conta(coalesce(v_consumos, '[]'::jsonb), v_estimado)");
    // o limite de defasagem do chooser é o mesmo LIMITE_DEFASAGEM_HORAS do TS
    const limites = [...sql.matchAll(/v_limite_defasagem constant numeric := (\d+)/g)].map((m) =>
      Number.parseInt(m[1] as string, 10),
    );
    expect(limites.length).toBeGreaterThan(0);
    for (const limite of limites) expect(limite).toBe(LIMITE_DEFASAGEM_HORAS);
  });

  it("MÉDIO 5 — o relatório é a UNIÃO (conta sem teto não some)", () => {
    const sql = SQL_0019();
    expect(sql).toContain("'sem_teto_declarado', (c.teto_usd is null)");
    expect(sql).toMatch(/select t\.conta, t\.teto_usd from public\.painel_teto_diario t\n\s*union/);
  });

  it("D43 — a barreira é DIFERIDA e cobre as quatro tabelas de dinheiro", () => {
    const sql = SQL_0019();
    const gatilhos = sql.match(/create constraint trigger \w+_barreira_teste/g) ?? [];
    expect(gatilhos).toHaveLength(4);
    const diferidos = sql.match(/deferrable initially deferred/g) ?? [];
    expect(diferidos).toHaveLength(4);
    // e a suíte arma o parâmetro UMA vez, para a sessão inteira do psql
    const teste = readFileSync(TESTE_SQL, "utf8");
    expect(teste).toContain("select set_config('lifeboard.teste', 'on', false)");
  });

  it("NENHUMA linha de 0019 mexe no VALOR do teto (isso é do operador)", () => {
    const sql = SQL_0019().toLowerCase();
    expect(sql).not.toMatch(/update\s+public\.painel_teto_diario\s+set\s+teto_usd/);
    expect(sql).not.toMatch(/alter\s+column\s+teto_usd\s+set\s+default/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.painel_teto_diario/);
    expect(sql).not.toContain("150");
  });

  it("os blocos da rodada 9 existem no teste SQL", () => {
    const teste = readFileSync(TESTE_SQL, "utf8");
    for (const marca of [
      "T42 · MÉDIO 1",
      "T43 · ALTO 1 (M14)",
      "T44 · ALTO 2 (M19)",
      "T45 · D12 (M23)",
      "T46 · ALTO 3",
      "T47 · ALTO 4 (M21)",
      "T48 · D37",
      "T49 · MÉDIO 5",
      "T50 · MÉDIO 3",
      "T51 · D43",
    ]) {
      expect(teste, `caso ausente: ${marca}`).toContain(marca);
    }
    const oks = teste.match(/RESULTADO: ok —/g) ?? [];
    expect(oks.length).toBeGreaterThanOrEqual(51);
  });
});

/**
 * BAIXO 3 (rodada 9) — `CUSTO_ESTIMADO_POR_COMPLEXIDADE` duplicava
 * `public.painel_custo_estimado` SEM teste de deriva: os dois coincidiam por
 * sorte. O custo por complexidade aparece em TRÊS lugares do SQL (a seed da
 * tabela em 0009, o fallback do trigger de admissão em 0018 e o fallback de
 * `fila_prompts_enfileirar`) e num só do TS. Agora eles se olham.
 */
describe("BAIXO 3 — o custo por complexidade é o MESMO no TS e no SQL", () => {
  it("a seed de painel_custo_estimado (0009) bate com a tabela do TS", () => {
    const sql = semComentarios(ler("0009_lifeboard_v3_fila_ajustes.sql"));
    const inicio = sql.indexOf("insert into public.painel_custo_estimado");
    expect(inicio, "0009 precisa semear painel_custo_estimado").toBeGreaterThan(0);
    const trecho = sql.slice(inicio, sql.indexOf(";", inicio));
    const pares = [...trecho.matchAll(/\('(baixa|media|alta|maxima)',\s*(\d+)\)/g)];
    expect(pares.length, "a seed precisa ter as 4 complexidades").toBe(4);
    for (const par of pares) {
      const complexidade = par[1] as Complexidade;
      expect(
        CUSTO_ESTIMADO_POR_COMPLEXIDADE[complexidade],
        `seed de ${complexidade}`,
      ).toBe(Number.parseInt(par[2] as string, 10));
    }
  });

  it("o fallback do trigger de admissão (0018) bate com a tabela do TS", () => {
    const sql = semComentarios(ler("0018_lifeboard_v3_caixa_auditavel.sql"));
    const achado = /when 'baixa' then (\d+) when 'media' then (\d+) when 'alta' then (\d+) when 'maxima' then (\d+)/.exec(
      sql,
    );
    expect(achado, "0018 precisa ter o fallback de custo por complexidade").not.toBeNull();
    const valores = (achado as RegExpExecArray).slice(1).map((n) => Number.parseInt(n, 10));
    expect(valores).toEqual([
      CUSTO_ESTIMADO_POR_COMPLEXIDADE.baixa,
      CUSTO_ESTIMADO_POR_COMPLEXIDADE.media,
      CUSTO_ESTIMADO_POR_COMPLEXIDADE.alta,
      CUSTO_ESTIMADO_POR_COMPLEXIDADE.maxima,
    ]);
  });
});

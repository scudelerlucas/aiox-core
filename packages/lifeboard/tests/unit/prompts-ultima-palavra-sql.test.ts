import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONTAS,
  CUSTO_ESTIMADO_POR_COMPLEXIDADE,
  CUSTO_MAXIMO_POR_ITEM_USD,
  CUSTO_MINIMO_POR_ITEM_USD,
  ITENS_SIMULTANEOS_MAXIMOS_POR_VALOR,
  LIMITE_DEFASAGEM_HORAS,
  MAXIMO_EM_VOO_POR_CONTA,
  TETO_DIARIO_PADRAO_USD,
} from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — M1 (rodada 11): A GUARDA QUE OLHA A **ÚLTIMA PALAVRA**.
 *
 * ═══ POR QUE ESTE ARQUIVO EXISTE ═══
 *
 * `prompts-espelho-sql.test.ts` fixa ARQUIVO: afirma a trava de medição contra
 * o texto da `0016` e o livro-razão contra o texto da `0019`. Os dois seguem
 * verdadeiros — e seguem irrelevantes para quem aplica o banco, porque o que
 * vale depois de rodar `0001` … `NNNN` em ordem não é o que a `0019` diz: é o
 * que a **ÚLTIMA** migration a redefinir cada função diz.
 *
 * Medido na rodada 11: as migrations `0022`, `0023` e `0024` são versões
 * ANTIGAS (rodaram em produção em 13/09, antes do livro-razão) que chegaram ao
 * repositório depois, com números que as põem no FIM da ordem. Resultado num
 * banco novo aplicado pelo DEPLOY.md:
 *
 *   · `fila_prompts_fechar_interno` (última: 0023) — fechar item NÃO escreve
 *     no livro-razão: o custo do item some do gasto do dia;
 *   · `fila_prompts_pegar_interno` (última: 0022) — sem a recusa por medição
 *     velha e com o teto fantasma `v_teto := 150` de volta.
 *
 * As migrations `0020`–`0025` não eram lidas por teste nenhum. Por isso três
 * migrations puderam entrar DEPOIS do livro-razão e apagar as duas funções do
 * dinheiro sem nenhum dos 1350 testes piscar.
 *
 * ═══ O QUE ESTA GUARDA FAZ ═══
 *
 * Varre TODAS as migrations em ordem numérica, monta o mapa
 * `função(assinatura) → última definição viva` (respeitando `drop function`) e
 * afirma sobre ESSA definição — nunca sobre um arquivo escolhido a dedo.
 * Quando falha, ela NOMEIA a função e o arquivo que virou a última palavra.
 *
 * Ela é de ORTOGRAFIA, como as outras que leem `.sql` — quem prova
 * COMPORTAMENTO é `supabase/tests/fila_prompts.test.sql` contra um Postgres de
 * verdade. Mas esta ortografia é a única que enxerga a ORDEM, e era a ordem
 * que estava errada.
 */

const DIR_MIGRATIONS = join(__dirname, "..", "..", "supabase", "migrations");

interface Definicao {
  /** `fila_prompts_pegar_interno` */
  readonly nome: string;
  /** `public.fila_prompts_pegar_interno(text, text)` — nome + tipos, sem os nomes dos parâmetros. */
  readonly chave: string;
  /** O arquivo que a declarou. */
  readonly arquivo: string;
  /** O corpo inteiro, do `create` até o `$$;` que o fecha. */
  readonly corpo: string;
}

/** As migrations do disco, em ordem numérica — a ordem em que o banco as aplica. */
function migrationsEmOrdem(): readonly string[] {
  return readdirSync(DIR_MIGRATIONS)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.includes(".test."))
    .sort((a, b) => a.localeCompare(b, "en"));
}

/** Acha o `)` que fecha o `(` da posição `abre`, contando profundidade. */
function fechaParenteses(texto: string, abre: number): number {
  let nivel = 0;
  for (let i = abre; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === "(") nivel += 1;
    else if (c === ")") {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/** `p_id uuid, p_dia date default null` → `uuid, date`. Serve também para o `drop` (só tipos). */
function tiposDaAssinatura(lista: string): string {
  const partes: string[] = [];
  let nivel = 0;
  let atual = "";
  for (const c of lista) {
    if (c === "(") nivel += 1;
    if (c === ")") nivel -= 1;
    if (c === "," && nivel === 0) {
      partes.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  if (atual.trim().length > 0) partes.push(atual);

  return partes
    .map((p) => {
      const semDefault = p.replace(/\s+default\s+[\s\S]*$/i, "").trim();
      const tokens = semDefault.split(/\s+/).filter((t) => t.length > 0);
      if (tokens.length === 0) return "";
      // `p_nome tipo` (declaração) → tipo. `tipo` sozinho (drop) → ele mesmo.
      return (tokens.length >= 2 ? tokens.slice(1) : tokens).join(" ").toLowerCase();
    })
    .filter((t) => t.length > 0)
    .join(", ");
}

/**
 * O mapa `chave → última definição viva`, montado aplicando as migrations na
 * ordem em que o banco as aplica. `drop function` remove a chave; um
 * `create or replace` posterior a repõe.
 */
function ultimaPalavra(): Map<string, Definicao> {
  const vivas = new Map<string, Definicao>();

  for (const arquivo of migrationsEmOrdem()) {
    const sql = readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8");

    // Um só varrimento, na ordem do arquivo: `create or replace` e `drop`
    // disputam a mesma chave e quem vem depois manda.
    const regex = /(create\s+or\s+replace\s+function|drop\s+function\s+if\s+exists)\s+(public|private)\.([a-z0-9_]+)\s*\(/gi;
    let achado: RegExpExecArray | null = regex.exec(sql);
    while (achado !== null) {
      const eDrop = /^drop/i.test(achado[1] as string);
      const esquema = achado[2] as string;
      const nome = achado[3] as string;
      const abre = regex.lastIndex - 1;
      const fecha = fechaParenteses(sql, abre);
      if (fecha < 0) {
        achado = regex.exec(sql);
        continue;
      }
      const chave = `${esquema}.${nome}(${tiposDaAssinatura(sql.slice(abre + 1, fecha))})`;

      if (eDrop) {
        vivas.delete(chave);
      } else {
        // O corpo vai até o `$$;` que fecha o `as $$` desta função.
        const fimCorpo = sql.indexOf("\n$$;", fecha);
        const corpo = fimCorpo < 0 ? sql.slice(achado.index) : sql.slice(achado.index, fimCorpo + 4);
        vivas.set(chave, { nome, chave, arquivo, corpo });
      }
      achado = regex.exec(sql);
    }
  }
  return vivas;
}

const VIVAS = ultimaPalavra();

/** Todas as definições vivas de uma função, por NOME (pode haver sobrecargas). */
function vivasDe(nome: string): Definicao[] {
  return [...VIVAS.values()].filter((d) => d.nome === nome);
}

/** A única definição viva de uma função — falha nomeando o problema se houver 0 ou 2+. */
function unicaViva(nome: string): Definicao {
  const todas = vivasDe(nome);
  expect(
    todas.map((d) => `${d.chave} (${d.arquivo})`),
    `public.${nome} precisa ter EXATAMENTE uma definição viva depois de aplicar todas as migrations em ordem`,
  ).toHaveLength(1);
  return todas[0] as Definicao;
}

/**
 * CRÍTICO (rodada 15): a ÚLTIMA expressão declarada para uma CHECK nomeada.
 *
 * A guarda antiga fazia `toMatch` sobre TODAS as migrations concatenadas: ela
 * dizia verdade quando a grafia aparecia em QUALQUER lugar, inclusive numa
 * linha morta de uma migration anterior. É a mesma classe de defeito que este
 * arquivo existe para fechar, uma casa acima: a última palavra é a que vale, e
 * para CHECK constraint também.
 */
function ultimaCheck(nomeDaConstraint: string): { arquivo: string; expressao: string } {
  let achado: { arquivo: string; expressao: string } | null = null;
  for (const arquivo of migrationsEmOrdem()) {
    const sql = readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8");
    const re = new RegExp(`add\\s+constraint\\s+${nomeDaConstraint}\\s*\\n?\\s*check\\s*\\(`, "gi");
    let m: RegExpExecArray | null = re.exec(sql);
    while (m !== null) {
      const abre = re.lastIndex - 1;
      const fecha = fechaParenteses(sql, abre);
      if (fecha > 0) achado = { arquivo, expressao: sql.slice(abre + 1, fecha).trim() };
      m = re.exec(sql);
    }
  }
  expect(achado, `nenhuma migration declara a check ${nomeDaConstraint}`).not.toBeNull();
  return achado as { arquivo: string; expressao: string };
}

/** As funções que ESCREVEM no livro-razão — se uma delas parar, o dinheiro some do dia. */
const FUNCOES_QUE_LANCAM = [
  "fila_prompts_fechar_interno",
  "fila_prompts_pegar_interno",
  "fila_prompts_cancelar",
] as const;

describe("M1 — a ÚLTIMA definição de cada função é a que vale (varredura em ordem)", () => {
  it("a varredura acha as migrations e as funções do dinheiro (se o parser quebrar, grita aqui)", () => {
    expect(migrationsEmOrdem().length, "nenhuma migration numerada no disco").toBeGreaterThan(20);
    expect(VIVAS.size, "nenhuma função viva — o parser quebrou").toBeGreaterThan(20);
    for (const nome of FUNCOES_QUE_LANCAM) {
      expect(vivasDe(nome).length, `public.${nome} sumiu da varredura`).toBe(1);
    }
  });

  it("toda função que fecha dinheiro LANÇA no livro-razão na sua ÚLTIMA definição", () => {
    const mudas = FUNCOES_QUE_LANCAM.map((nome) => unicaViva(nome))
      .filter((d) => !/public\.painel_caixa_lancar(_item)?\s*\(/.test(d.corpo))
      .map(
        (d) =>
          `${d.chave} — última palavra em ${d.arquivo}: fecha item e NÃO chama painel_caixa_lancar_item`,
      );
    expect(
      mudas,
      "função de dinheiro cuja ÚLTIMA definição não escreve no livro-razão (o custo some do gasto do dia)",
    ).toEqual([]);
  });

  it("fila_prompts_fechar_interno lança nos TRÊS caminhos de fechamento", () => {
    const d = unicaViva("fila_prompts_fechar_interno");
    const chamadas = d.corpo.match(/public\.painel_caixa_lancar_item\s*\(/g) ?? [];
    // reaberto pelo último dono · item cancelado que foi medido · fechamento normal
    expect(
      chamadas.length,
      `${d.chave} — última palavra em ${d.arquivo}: faltam caminhos de fechamento que lançam`,
    ).toBeGreaterThanOrEqual(3);
    expect(d.corpo, `${d.arquivo}: o fechamento precisa gravar a origem do número`).toContain(
      "custo_origem = 'medido'",
    );
  });

  it("fila_prompts_pegar_interno tem a TRAVA DE MEDIÇÃO na sua última definição", () => {
    const d = unicaViva("fila_prompts_pegar_interno");
    const ondeFalhou = `${d.chave} — última palavra em ${d.arquivo}`;
    expect(d.corpo, `${ondeFalhou}: não lê exigir_medicao_recente`).toContain(
      "exigir_medicao_recente",
    );
    expect(d.corpo, `${ondeFalhou}: não devolve recusado_por_medicao`).toContain(
      "'recusado_por_medicao', true",
    );
    // A recusa vem ANTES de qualquer escrita: nenhum `update` antes dela.
    const recusa = d.corpo.indexOf("'recusado_por_medicao', true");
    const primeiroUpdate = d.corpo.search(/\n\s*(with alvo as|update public\.)/);
    expect(
      primeiroUpdate === -1 || recusa < primeiroUpdate,
      `${ondeFalhou}: a recusa por medição velha acontece DEPOIS de já ter escrito na fila`,
    ).toBe(true);
    // e o limite é o mesmo do TS
    const limites = [...d.corpo.matchAll(/v_defasagem\s*>\s*(\d+)/g)].map((m) =>
      Number.parseInt(m[1] as string, 10),
    );
    expect(limites.length, `${ondeFalhou}: não compara a defasagem com limite nenhum`).toBeGreaterThan(0);
    for (const h of limites) expect(h, ondeFalhou).toBe(LIMITE_DEFASAGEM_HORAS);
  });

  it("nenhuma função VIVA crava um teto de 150 (o teto é declarado, nunca inventado)", () => {
    const culpadas = [...VIVAS.values()]
      .filter((d) => /v_teto\s*:=\s*150\b/.test(d.corpo))
      .map((d) => `${d.chave} — última palavra em ${d.arquivo}: inventa teto 150`);
    expect(
      culpadas,
      "função viva com teto fantasma — sem teto DECLARADO a RPC tem de recusar, não chutar 150",
    ).toEqual([]);
  });

  it("nenhuma migration RECUPERADA DO BANCO (0022–0024) é a última palavra sobre função da fila", () => {
    const recuperadas = /^002[234]_/;
    const atrasadas = [...VIVAS.values()]
      .filter((d) => recuperadas.test(d.arquivo))
      .map(
        (d) =>
          `${d.chave} — última palavra em ${d.arquivo}, que é uma VERSÃO ANTIGA recuperada do ` +
          `histórico do banco e numerada no fim da ordem`,
      );
    expect(
      atrasadas,
      "migration antiga recuperada do banco virou a última palavra — redeclare a versão certa numa migration NOVA",
    ).toEqual([]);
  });

  it("M3 — o teto de 500 por conta existe em MIGRATION, não só em prosa do DEPLOY.md", () => {
    const tudo = migrationsEmOrdem()
      .map((a) => `${a}\n${readFileSync(join(DIR_MIGRATIONS, a), "utf8")}`)
      .join("\n");
    expect(
      tudo,
      "o default do teto precisa estar numa migration (era um passo manual do DEPLOY.md)",
    ).toMatch(
      new RegExp(`alter\\s+column\\s+teto_usd\\s+set\\s+default\\s+${TETO_DIARIO_PADRAO_USD}\\b`),
    );
    // MÉDIO 2 (crítico da rodada 13): esta expressão não tinha a borda de
    // palavra que a de cima tem. "set teto_usd = 5000" CONTÉM
    // "set teto_usd = 500", então a guarda casava com um teto dez vezes maior
    // — medido: trocar 500 por 5000 na 0027 §4 mantinha os 1401 testes verdes.
    expect(
      tudo,
      "as contas da casa precisam sair da migration com o teto da decisão de 14/09 — e com ESTE número, não com um que apenas comece por ele",
    ).toMatch(new RegExp(`set teto_usd = ${TETO_DIARIO_PADRAO_USD}\\b`));
    // E a seed nominal: cada conta da casa nasce com o teto da decisão. Sem
    // isto, bastava manter o `update` e inflar as quatro linhas do `insert`.
    //
    // Busca LITERAL, não expressão regular (CodeQL js/incomplete-sanitization,
    // alerta alto na rodada 13): a versão anterior montava a expressão com
    // `conta.replace(/\./g, "\\.")`, que escapa o ponto e deixa passar a
    // barra invertida e os outros caracteres especiais — escape pela metade.
    // O trecho procurado é texto literal na migration (`('conta', 500)`), então
    // não há nada a escapar: `toContain` diz a mesma coisa sem a armadilha.
    for (const conta of CONTAS) {
      expect(tudo, `conta sem teto da decisão na seed: ${conta}`).toContain(
        `('${conta}', ${TETO_DIARIO_PADRAO_USD})`,
      );
    }
  });

  /**
   * MÉDIO 5 (crítico da rodada 13): NINGUÉM SOMAVA OS TETOS.
   *
   * A 0027 §4 semeia QUATRO contas com 500 — US$ 2.000/dia de orçamento
   * despachável na casa. A régua da casa `teto-de-gasto-diario` ainda dizia
   * "500 por conta, nas TRÊS" (US$ 1.500), e a própria régua nomeia isso como
   * violação: "alterar a trava sem atualizar este arquivo". Nenhuma guarda
   * somava teto nem comparava com a régua, então o total da casa subiu 33% sem
   * uma linha de aviso.
   *
   * O operador confirmou US$ 2.000/dia em 22/09/2026 e a régua do hub foi
   * atualizada. Este teste é o que impede a próxima mudança silenciosa: a
   * conta da casa é um número fixado, e mexer nele exige mexer aqui.
   * O irmão deste teste no banco é o bloco T78 da suíte SQL, que soma a
   * tabela `painel_teto_diario` depois de aplicar todas as migrations.
   */
  it("MÉDIO 5 — o orçamento da casa é 4 × 500 = US$ 2.000/dia, e está somado em algum lugar", () => {
    const TETO_DA_CASA_USD = 2000;
    expect(
      CONTAS.length * TETO_DIARIO_PADRAO_USD,
      "o total da casa mudou — atualize a régua `teto-de-gasto-diario` no hub NO MESMO ato, que é o que ela mesma exige",
    ).toBe(TETO_DA_CASA_USD);

    const tudo = migrationsEmOrdem()
      .map((a) => readFileSync(join(DIR_MIGRATIONS, a), "utf8"))
      .join("\n");
    // a seed tem de ter uma linha por conta da casa, e nenhuma conta a mais
    const semeadas = [...tudo.matchAll(/\('([^']+@[^']+)', (\d+)\)/g)].filter(
      (m) => (m[2] as string) === String(TETO_DIARIO_PADRAO_USD),
    );
    const contasSemeadas = new Set(semeadas.map((m) => m[1] as string));
    expect(
      [...contasSemeadas].sort(),
      "a seed do teto divergiu da lista de contas da casa — conta nova sobe o orçamento total sem avisar",
    ).toEqual([...CONTAS].sort());

    // e o comentário da coluna precisa DIZER o total, para quem lê o banco
    expect(
      tudo,
      "o `comment on column` do teto precisa dizer o total da casa em voz alta",
    ).toContain("US$ 2.000/dia");
  });
});

/**
 * RODADA 14 · A VARREDURA DE GENERALIZAÇÃO — os espelhos de TS que não estavam
 * amarrados a nada.
 *
 * O crítico da rodada 14 registrou, na lista do que ele atacou e NÃO virou
 * achado, uma ressalva que é a mesma forma de todos os oito: "a amarra é o
 * número mágico 620 num teste, não uma comparação com
 * `painel_custo_maximo_por_item()`; subir o espelho para 700 ou 10.000.000
 * continua verde". O espelho de TS existia, o SQL existia, e nada os comparava
 * — a guarda media a HIPÓTESE (620 passa) e não o PRODUTO (os dois números são
 * o mesmo).
 *
 * Estas três guardas comparam cada constante de TS com a ÚLTIMA definição do
 * SQL lida do disco, do mesmo jeito que o resto deste arquivo.
 */
describe("RODADA 14 — cada espelho de TS é comparado com a última palavra do SQL", () => {
  /** O corpo da última definição viva, por nome (sem argumentos). */
  function corpoDe(nome: string): string {
    return unicaViva(nome).corpo;
  }

  it("CUSTO_MAXIMO_POR_ITEM_USD é o número que painel_custo_maximo_por_item() devolve", () => {
    const corpo = corpoDe("painel_custo_maximo_por_item");
    const m = corpo.match(/select\s+(\d+)::numeric/);
    expect(
      m,
      "painel_custo_maximo_por_item() deixou de devolver um literal — se ela passou a derivar de outra coisa, esta guarda precisa passar a ler de lá",
    ).not.toBeNull();
    const doSql = Number.parseInt((m as RegExpMatchArray)[1] as string, 10);
    expect(
      CUSTO_MAXIMO_POR_ITEM_USD,
      "o espelho de TS da faixa de sanidade divergiu do SQL — a tela recusaria um número que o banco aceita, ou aceitaria um que ele recusa",
    ).toBe(doSql);
  });

  it("a faixa de sanidade cabe na coluna custo_usd declarada nas migrations", () => {
    // BAIXO 8 (rodada 14): o crítico subiu a sanidade para 1.000.000 com os
    // cinco portões verdes, e a faixa passou a aceitar número que
    // `numeric(10,4)` não guarda — o fechamento devolvia `numeric field
    // overflow` cru em vez da recusa em português. A parede de runtime é a
    // 0029 §5 (aborta a migration) e o bloco T84; esta é a de ortografia.
    const tudo = migrationsEmOrdem()
      .map((a) => readFileSync(join(DIR_MIGRATIONS, a), "utf8"))
      .join("\n");
    const decl = [...tudo.matchAll(/custo_usd\s+numeric\((\d+),\s*(\d+)\)/g)];
    expect(decl.length, "nenhuma migration declara a precisão de custo_usd").toBeGreaterThan(0);
    const ultima = decl[decl.length - 1] as RegExpMatchArray;
    const precisao = Number.parseInt(ultima[1] as string, 10);
    const escala = Number.parseInt(ultima[2] as string, 10);
    const cabe = 10 ** (precisao - escala) - 10 ** -escala;
    expect(
      CUSTO_MAXIMO_POR_ITEM_USD,
      `a faixa de sanidade passou do que custo_usd numeric(${precisao},${escala}) guarda (${cabe})`,
    ).toBeLessThanOrEqual(cabe);
  });

  it("CONTAS é a mesma lista, na mesma ordem, de painel_contas_da_casa()", () => {
    // ALTO 6 (rodada 14): a lista das quatro contas estava escrita à mão em
    // cinco lugares do SQL. Agora sai de uma função só — e esta guarda amarra
    // o espelho de TS a ELA, não a uma das cópias.
    const corpo = corpoDe("painel_contas_da_casa");
    const doSql = [...corpo.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1] as string);
    expect(
      doSql,
      "painel_contas_da_casa() divergiu de CONTAS (ordem inclusive: ela é a ordem de desempate do chooser)",
    ).toEqual([...CONTAS]);
  });

  it("nenhuma estimativa fica ABAIXO DO PISO — nem no TS, nem na seed do SQL", () => {
    // CRÍTICO 5 (rodada 14) + CRÍTICO (rodada 15). A rodada 14 exigia `> 0` e
    // essa exigência conferia o CASO, não a CLASSE: `usd = 0.0001` passava por
    // aqui de cabeça erguida, e com ele o coordenador despachou 40 sessões em
    // voo contra US$ 1,00 de espaço (reserva total de US$ 0,0040).
    // As paredes de runtime são as checks da 0030 §§2-3, o pull (0030 §8) e os
    // blocos T79/T80/T86/T87.
    for (const [complexidade, usd] of Object.entries(CUSTO_ESTIMADO_POR_COMPLEXIDADE)) {
      expect(
        usd,
        `estimativa de ${complexidade} abaixo do piso de US$ ${CUSTO_MINIMO_POR_ITEM_USD} — com ela o pull despacha praticamente sem consumir headroom`,
      ).toBeGreaterThanOrEqual(CUSTO_MINIMO_POR_ITEM_USD);
    }
    const tudo = migrationsEmOrdem()
      .map((a) => readFileSync(join(DIR_MIGRATIONS, a), "utf8"))
      .join("\n");
    const semeadas = [
      ...tudo.matchAll(/\('(baixa|media|alta|maxima)',\s*(\d+(?:\.\d+)?)\)/g),
    ];
    expect(semeadas.length, "nenhuma migration semeia painel_custo_estimado").toBeGreaterThan(0);
    for (const m of semeadas) {
      expect(
        Number.parseFloat(m[2] as string),
        `a seed de painel_custo_estimado tem ${m[1]} abaixo do piso`,
      ).toBeGreaterThanOrEqual(CUSTO_MINIMO_POR_ITEM_USD);
    }

    // E a ÚLTIMA check viva de cada uma das duas colunas do dinheiro exige o
    // PISO, não "diferente de zero". Lida pela última palavra, não por
    // `toMatch` no bolo de todas as migrations: a grafia `check (usd > 0)`
    // continua existindo na 0029, morta, e satisfazia a guarda antiga.
    const daTabela = ultimaCheck("painel_custo_estimado_usd_check");
    expect(
      daTabela.expressao,
      `a última check de painel_custo_estimado.usd (${daTabela.arquivo}) precisa exigir o PISO — "> 0" e ">= 0" aceitam US$ 0,0001, que reserva 1/50.000 do que um item custa`,
    ).toMatch(/usd\s*>=\s*public\.painel_custo_minimo_por_item\(\)/);

    const daColuna = ultimaCheck("painel_fila_prompts_custo_estimado_check");
    expect(
      daColuna.expressao,
      `a última check de painel_fila_prompts.custo_estimado_usd (${daColuna.arquivo}) precisa exigir o PISO — é a parede de baixo, contra update direto na coluna`,
    ).toMatch(/custo_estimado_usd\s*>=\s*public\.painel_custo_minimo_por_item\(\)/);
  });
});

/**
 * CRÍTICO (coordenador da rodada 15) — O PISO E O TETO DE SESSÕES EM VOO.
 *
 * O achado: as três paredes da rodada 14 (`usd > 0`, `custo_estimado_usd > 0`,
 * `v_headroom > 0`) fecharam o NÚMERO que a sabotagem daquela rodada usou —
 * zero — e deixaram a CLASSE aberta. Com `usd = 0.0001`, medido:
 *   dia 499 · teto 500 · 40 DESPACHADOS · 40 em voo · reserva US$ 0,0040
 *   headroom anunciado US$ 1,00
 * A US$ 0,0001 por item, US$ 1,00 de espaço admite dez mil sessões.
 *
 * Estas guardas seguram os TRÊS números e — mais importante — a RELAÇÃO entre
 * eles. O coordenador pediu, para qualquer número escolhido, "uma guarda que
 * reprove quando ele for CONTORNADO, não quando ele mudar": é o que os dois
 * últimos `it` fazem. Comportamento: blocos T86–T90 contra o Postgres.
 */
describe("CRÍTICO rodada 15 — o piso, o teto de sessões em voo e a relação entre eles", () => {
  function literalDe(nome: string): number {
    const corpo = unicaViva(nome).corpo;
    const m = corpo.match(/select\s+(\d+(?:\.\d+)?)(?:::numeric)?\s*;/);
    expect(
      m,
      `public.${nome}() deixou de devolver um literal — se ela passou a derivar de outra coisa, esta guarda precisa passar a ler de lá`,
    ).not.toBeNull();
    return Number.parseFloat((m as RegExpMatchArray)[1] as string);
  }

  it("os três números do TS são os mesmos do SQL (piso, razão e sessões em voo)", () => {
    expect(
      CUSTO_MINIMO_POR_ITEM_USD,
      "o espelho de TS do PISO divergiu de painel_custo_minimo_por_item() — a tela recusaria número que o banco aceita, ou o contrário",
    ).toBe(literalDe("painel_custo_minimo_por_item"));
    expect(
      ITENS_SIMULTANEOS_MAXIMOS_POR_VALOR,
      "o espelho de TS da razão piso×teto divergiu de painel_fila_itens_simultaneos_maximos_por_valor()",
    ).toBe(literalDe("painel_fila_itens_simultaneos_maximos_por_valor"));
    expect(
      MAXIMO_EM_VOO_POR_CONTA,
      "o espelho de TS do teto de sessões em voo divergiu de painel_fila_maximo_em_voo_por_conta()",
    ).toBe(literalDe("painel_fila_maximo_em_voo_por_conta"));
  });

  it("o PISO é o teto do dia dividido pela razão — não é número solto", () => {
    // Um piso escolhido no chute vira o próximo número mágico. Este é DERIVADO:
    // 1% do teto que a casa declara. Se o teto subir e o piso não, esta guarda
    // reprova — e é exatamente esse o caminho de circunvenção (não se mexe no
    // piso; sobe-se o teto, porque o piso vale 1/100 DELE).
    expect(
      CUSTO_MINIMO_POR_ITEM_USD * ITENS_SIMULTANEOS_MAXIMOS_POR_VALOR,
      `o piso de US$ ${CUSTO_MINIMO_POR_ITEM_USD} não sustenta um teto de US$ ${TETO_DIARIO_PADRAO_USD}: a conta admitiria ${Math.floor(TETO_DIARIO_PADRAO_USD / CUSTO_MINIMO_POR_ITEM_USD)} itens simultâneos só pelo valor. Suba painel_custo_minimo_por_item() junto com o teto`,
    ).toBeGreaterThanOrEqual(TETO_DIARIO_PADRAO_USD);
  });

  it("o PISO não recusa a complexidade mais barata que a casa declara", () => {
    // A outra direção do risco, que o coordenador nomeou: um piso alto demais
    // recusaria um dia legítimo de tarefas baratíssimas. Hoje o piso é IGUAL à
    // estimativa de `baixa` — a régua é "nada do que o painel declara é
    // recusado", não "quase nada".
    const maisBarata = Math.min(...Object.values(CUSTO_ESTIMADO_POR_COMPLEXIDADE));
    expect(
      CUSTO_MINIMO_POR_ITEM_USD,
      `o piso de US$ ${CUSTO_MINIMO_POR_ITEM_USD} passou da complexidade mais barata da casa (US$ ${maisBarata}) — a fila recusaria tarefa legítima`,
    ).toBeLessThanOrEqual(maisBarata);
  });

  it("o teto de SESSÕES EM VOO morde antes de a parede de valor ficar sem sentido", () => {
    // Se K itens no piso já não couberem no teto, quem recusa é o valor e o
    // limite de contagem é enfeite — a guarda irmã da 0030 §5(b).
    expect(MAXIMO_EM_VOO_POR_CONTA, "limite de zero sessões travaria a fila inteira").toBeGreaterThanOrEqual(1);
    expect(
      MAXIMO_EM_VOO_POR_CONTA * CUSTO_MINIMO_POR_ITEM_USD,
      `${MAXIMO_EM_VOO_POR_CONTA} sessões no piso somam mais que o teto de US$ ${TETO_DIARIO_PADRAO_USD} — a parede de valor morderia primeiro e painel_fila_maximo_em_voo_por_conta() seria decoração`,
    ).toBeLessThanOrEqual(TETO_DIARIO_PADRAO_USD);
  });

  it("a ÚLTIMA definição do pull tem as duas paredes novas, e a frase diz o que está em voo", () => {
    const pull = unicaViva("fila_prompts_pegar_interno").corpo;

    /**
     * A ESCOLHA, não o pull inteiro. Sabotagem minha, medida: apagar
     * `and f.custo_estimado_usd >= v_piso` da cláusula que ESCOLHE o item
     * deixava esta guarda verde, porque a mesma grafia aparece nos CONTADORES
     * (`count(*) filter (… and f.custo_estimado_usd >= v_piso)`) — a guarda
     * conferia a grafia em qualquer lugar do corpo, não no lugar que decide.
     * É a quinta forma dentro da própria guarda.
     */
    const inicio = pull.indexOf("select f.id into v_escolhido");
    const fim = pull.indexOf("for update skip locked", inicio);
    expect(
      inicio >= 0 && fim > inicio,
      "não achei a cláusula que ESCOLHE o item no pull — se ela mudou de forma, esta guarda precisa mudar com ela",
    ).toBe(true);
    const escolha = pull.slice(inicio, fim);
    expect(
      escolha,
      "a cláusula que ESCOLHE o item não exige o piso — sem essa linha um item de US$ 0,0001 atravessa qualquer dia (medido: 40 despachados contra US$ 1,00 de espaço)",
    ).toMatch(/and f\.custo_estimado_usd\s*>=\s*v_piso/);
    expect(
      escolha,
      "a cláusula que ESCOLHE o item perdeu a parede da rodada 14 (`v_headroom > 0`)",
    ).toMatch(/and v_headroom\s*>\s*0/);
    expect(
      pull,
      "a última palavra do pull não tem o teto de sessões em voo — é a parede que fecha o dano sem depender do valor da estimativa",
    ).toMatch(/if\s+not\s+v_no_limite\s+then/);
    expect(
      pull,
      "o pull continua anunciando headroom sem dizer quantas sessões estão em voo — era a mentira do painel (US$ 1,00 livres com 40 sessões gastando)",
    ).toMatch(/'em_voo'/);
  });

  it("o gatilho que recusa SUBIR o teto sem subir o piso existe e está armado", () => {
    const tudo = migrationsEmOrdem()
      .map((a) => readFileSync(join(DIR_MIGRATIONS, a), "utf8"))
      .join("\n");
    expect(
      vivasDe("painel_teto_diario_piso_sustenta").length,
      "a função da guarda de circunvenção do piso sumiu",
    ).toBe(1);
    expect(
      tudo,
      "a guarda existe como função mas não está armada como gatilho — função sem gatilho não é guarda (é a forma nº 1 desta base)",
    ).toMatch(
      /create trigger painel_teto_diario_piso_sustenta\s*\n?\s*before insert or update of teto_usd on public\.painel_teto_diario/,
    );
  });
});

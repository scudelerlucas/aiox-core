import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTAS, LIMITE_DEFASAGEM_HORAS, TETO_DIARIO_PADRAO_USD } from "@/core/prompts/tipos";

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
    for (const conta of CONTAS) {
      expect(tudo, `conta sem teto da decisão na seed: ${conta}`).toMatch(
        new RegExp(`\\('${conta.replace(/\./g, "\\.")}', ${TETO_DIARIO_PADRAO_USD}\\)`),
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

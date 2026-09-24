import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * OS-LIFEBOARD · P7 — MÉDIO 1 (crítico da rodada 13): GUARDA SEM GATILHO É
 * COMENTÁRIO, NÃO GUARDA.
 *
 * `scripts/checar-contraste.mjs` é quem confere a régua de contraste da tela
 * (kernel-inicio item 6, >= 4,5:1). Varredura do crítico no repositório
 * inteiro: ele aparecia em TRÊS comentários e no próprio cabeçalho, e em
 * nenhum `package.json`, nenhum workflow, nenhum hook. Só rodava quando
 * alguém digitava o comando à mão — enquanto o cabeçalho do runner da suíte
 * SQL e o do job `lifeboard-sql` afirmavam, por escrito, que "quem guarda a
 * tela é o vitest, o tsc e o checar-contraste.mjs".
 *
 * É a mesma forma que a rodada 12 mediu para a própria suíte SQL ("existia
 * desde julho e nenhum job a rodava"). Este arquivo é o gatilho do gatilho:
 * ele fica vermelho se o script sair do `package.json` ou do CI.
 */

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const PACOTE = join(AQUI, "..", "..");
const RAIZ_REPO = join(PACOTE, "..", "..");

describe("MÉDIO 1 — o checar-contraste tem gatilho de verdade", () => {
  it("existe como script do package.json (dá para rodar por `npm run contraste`)", () => {
    const pkg = JSON.parse(readFileSync(join(PACOTE, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(
      pkg.scripts.contraste,
      "sem entrada no package.json o script só roda se alguém lembrar de digitá-lo",
    ).toContain("checar-contraste.mjs");
  });

  it("roda num passo do CI, no mesmo job que roda o vitest e o tsc da tela", () => {
    const ci = readFileSync(join(RAIZ_REPO, ".github", "workflows", "ci.yml"), "utf8");
    expect(
      ci,
      "o job package-tests precisa CHAMAR o contraste, não só falar dele em comentário",
    ).toMatch(/run: npm run contraste --workspace=@aiox\/lifeboard/);
  });

  it("o cabeçalho que promete a guarda cita o comando que existe", () => {
    const runner = readFileSync(join(PACOTE, "scripts", "rodar-suite-sql.sh"), "utf8");
    expect(runner).toContain("npm run contraste");
  });
});

/**
 * MÉDIO 3 (crítico da rodada 14): GATILHO LIGADO NÃO É MEDIÇÃO FEITA.
 *
 * As três guardas acima conferem que `checar-contraste.mjs` está LIGADO ao
 * `package.json`, ao CI e ao cabeçalho do runner. Nenhuma delas conferia que
 * ele ainda MEDE alguma coisa — e o script contava a si mesmo: a mensagem
 * final era `${PARES.length} pares verificados`, com o número saindo do
 * próprio array auditado. O crítico apagou as nove linhas de `PARES` que
 * dizem `(P7` (todas as medições de acessibilidade desta peça, o `role=alert`
 * da recusa da fila entre elas) e o portão devolveu `55 pares verificados,
 * todos dentro da régua`, saída 0.
 *
 * É a SEGUNDA CÓPIA das duas travas que entraram no script: o piso numérico e
 * a lista nominal. Aqui elas são lidas de FORA — baixar o piso exige mexer em
 * dois arquivos, e cada mudança aparece no diff como um número ou um nome a
 * menos.
 */
describe("MÉDIO 3 — o contraste não conta a si mesmo", () => {
  const script = readFileSync(join(PACOTE, "scripts", "checar-contraste.mjs"), "utf8");

  /** O número escrito à mão no script (não derivado do array). */
  function piso(): number {
    const m = script.match(/const PISO_DE_PARES = (\d+);/);
    expect(m, "o script perdeu o PISO_DE_PARES — sem ele apagar par devolve verde").not.toBeNull();
    return Number.parseInt((m as RegExpMatchArray)[1] as string, 10);
  }

  /** As medições exigidas por NOME, fora do array auditado. */
  function exigidos(): string[] {
    const ini = script.indexOf("const MEDICOES_EXIGIDAS = [");
    expect(ini, "o script perdeu a lista nominal MEDICOES_EXIGIDAS").toBeGreaterThan(0);
    const fim = script.indexOf("];", ini);
    return [...script.slice(ini, fim).matchAll(/^\s+"(.+)",$/gm)].map((m) => m[1] as string);
  }

  /** Quantos pares o array do script tem HOJE — contado de fora dele. */
  function quantosPares(): number {
    const ini = script.indexOf("const PARES = [");
    expect(ini, "o script perdeu o array PARES").toBeGreaterThan(0);
    const fim = script.indexOf("\n];", ini);
    return [...script.slice(ini, fim).matchAll(/^\s+\["/gm)].length;
  }

  it("o script tem um PISO de pares, e o piso não desceu", () => {
    const PISO_FIXADO_AQUI = 64;
    expect(
      piso(),
      "o piso de pares do contraste desceu — se a régua encolheu de propósito, baixe o número NOS DOIS arquivos no mesmo commit e diga por quê",
    ).toBeGreaterThanOrEqual(PISO_FIXADO_AQUI);
  });

  it("o piso é comparado com PARES.length dentro do script (não é comentário)", () => {
    expect(
      script,
      "o piso existe mas ninguém o compara — guarda sem gatilho é comentário",
    ).toMatch(/PARES\.length\s*<\s*PISO_DE_PARES/);
    expect(script, "o script precisa somar em `falhou` quando o piso quebra").toMatch(
      /PARES\.length\s*<\s*PISO_DE_PARES[\s\S]{0,400}falhou\+\+/,
    );
  });

  it("as 9 medições da tela do P7 estão exigidas por NOME, fora do array", () => {
    // A chave é a DESCRIÇÃO, não o par de tokens: `bone-400 sobre navy-850`
    // aparece em três linhas de telas diferentes, então apagar as nove do P7
    // deixava oito chaves ainda "presentes" e a lista acusava uma só (medido).
    const DA_TELA_DO_P7 = [
      "placeholder do textarea de novo prompt",
      "legenda de complexidades no rodapé do formulário",
      "trilho da barra de progresso do cartão de conta",
      "'sem medição nenhuma' no cartão de conta",
      "'última medição há N h' no cartão de conta",
      "teto × faixa real dos dias medidos no cartão",
      "aviso 'isto entrou no gasto de hoje' na linha da fila",
      "sucesso mudo da fila (cancelamento sem custo)",
      "recusa em português da fila, role=alert",
    ];
    const lista = exigidos();
    expect(lista.length, "a lista nominal ficou curta demais para valer").toBeGreaterThanOrEqual(12);
    for (const medicao of DA_TELA_DO_P7) {
      expect(
        lista,
        `medição de acessibilidade do P7 fora da lista nominal: ${medicao} — apagá-la do array voltaria a devolver verde`,
      ).toContain(medicao);
    }
  });

  it("o array PARES do script ainda tem, contado de fora, ao menos o piso de pares", () => {
    // A TERCEIRA cópia, e a que faz o vitest (o portão barato) ficar vermelho
    // junto com o contraste: o número de pares é contado AQUI, lendo o
    // arquivo, e comparado com o mesmo piso.
    expect(
      quantosPares(),
      "o array PARES encolheu abaixo do piso — apagar medição de acessibilidade exige baixar o piso à mão, nos dois arquivos",
    ).toBeGreaterThanOrEqual(piso());
  });

  it("a lista nominal é conferida contra PARES dentro do script", () => {
    expect(script).toMatch(/MEDICOES_EXIGIDAS\.filter\(/);
    expect(script, "par exigido que sai da régua tem de REPROVAR, não só avisar").toMatch(
      /ausentes\.length[\s\S]{0,300}falhou \+= ausentes\.length/,
    );
  });
});

/**
 * MÉDIO 4 (crítico da rodada 13): o parágrafo que declara "do que o verde é
 * prova" citava `fila_prompts_pegar` e `fila_prompts_fechar` como "as portas
 * com segredo que embrulham as `_interno`". As duas NÃO EXISTEM: a 0009
 * (linhas 518-519) as apagou com `drop function if exists` e nada as recriou.
 * É o único texto que um revisor lê antes de confiar no verde, e ele estava
 * errado no exemplo que dava.
 */
describe("MÉDIO 4 — o cabeçalho da cobertura só cita função viva", () => {
  const MORTAS = ["fila_prompts_pegar", "fila_prompts_fechar"];
  const DIR_MIGRATIONS = join(PACOTE, "supabase", "migrations");

  /** A ÚLTIMA palavra das migrations sobre a função: "create" ou "drop". */
  function ultimaPalavra(fn: string): "create" | "drop" | "nunca" {
    let veredito: "create" | "drop" | "nunca" = "nunca";
    const arquivos = readdirSync(DIR_MIGRATIONS)
      .filter((a) => /^\d{4}_.*\.sql$/.test(a) && !a.endsWith(".test.sql"))
      .sort();
    for (const arquivo of arquivos) {
      const sql = readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8");
      const eventos = [
        ...sql.matchAll(new RegExp(`(create (?:or replace )?function|drop function(?: if exists)?) public\\.${fn}\\(`, "g")),
      ];
      for (const e of eventos) {
        veredito = (e[1] as string).startsWith("create") ? "create" : "drop";
      }
    }
    return veredito;
  }

  it("o runner da suíte SQL não promete cobertura de função apagada pela 0009", () => {
    const runner = readFileSync(join(PACOTE, "scripts", "rodar-suite-sql.sh"), "utf8");
    expect(
      runner,
      "a frase antiga dizia que fila_prompts_pegar/fechar são as portas com segredo que embrulham as _interno",
    ).not.toMatch(/as portas com segredo\s*\n#\s*que embrulham as/);
    expect(runner, "o texto precisa DIZER que as duas não existem").toContain("as duas NÃO EXISTEM");
  });

  it("o mesmo parágrafo do job lifeboard-sql foi corrigido junto", () => {
    const ci = readFileSync(join(RAIZ_REPO, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).not.toMatch(/PORTAS COM SEGREDO `fila_prompts_pegar` e `fila_prompts_fechar`/);
    expect(ci).toContain("não existem desde a 0009");
  });

  it("as duas funções continuam mortas: a última palavra das migrations é `drop`", () => {
    for (const fn of MORTAS) {
      expect(
        ultimaPalavra(fn),
        `${fn} voltou a existir — se voltou, o cabeçalho da cobertura precisa voltar a citá-la`,
      ).toBe("drop");
    }
  });
});

/**
 * P1 do Codex (PR #42, 23/09): o livro-razão é IMUTÁVEL pelo gatilho
 * `painel_caixa_lancamentos_imutavel` (0019). Um UPDATE/DELETE solto numa
 * migration passa no CI — o banco do CI tem o livro vazio, o comando toca
 * zero linhas e o gatilho nunca dispara — e aborta a migration inteira em
 * produção, onde há lançamentos. Foi o que a 0027 fazia com o preenchimento
 * do posto. Toda escrita no livro dentro de migration tem de estar sob o
 * desvio da 0020 §4 (`session_replication_role = replica` só nesta transação).
 */
describe("P1 — migration nenhuma edita o livro-razão fora do desvio da trava", () => {
  it("todo UPDATE/DELETE em painel_caixa_lancamentos vem depois de `replica` no mesmo bloco", () => {
    const pasta = join(PACOTE, "supabase", "migrations");
    const soltos: string[] = [];
    for (const nome of readdirSync(pasta).filter((n) => /^\d{4}_.*\.sql$/.test(n) && !n.endsWith(".test.sql"))) {
      const sql = readFileSync(join(pasta, nome), "utf8")
        .split("\n")
        .map((linha) => linha.replace(/--.*$/, ""))
        .join("\n");
      const escrita = /\b(update|delete\s+from)\s+public\.painel_caixa_lancamentos\b/gi;
      for (let m = escrita.exec(sql); m !== null; m = escrita.exec(sql)) {
        // o bloco `do $$ … $$` que contém a escrita
        const inicio = sql.lastIndexOf("$$", m.index);
        const trecho = sql.slice(inicio < 0 ? 0 : inicio, m.index);
        const dentroDeFuncao = /create\s+(or\s+replace\s+)?function/i.test(
          sql.slice(Math.max(0, sql.lastIndexOf("$$", inicio - 1) - 400), inicio),
        );
        if (dentroDeFuncao) continue; // corpo de função roda em runtime, não na migration
        if (!/session_replication_role\s*=\s*replica/i.test(trecho)) {
          soltos.push(`${nome}: ${sql.slice(m.index, m.index + 60).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(soltos, "escrita no livro sem o desvio da trava — aborta em produção").toEqual([]);
  });
});

/**
 * P1 do Codex (PR #42, 6ª rodada): a 0029 passou a chamar
 * `painel_fila_em_voo()` e `painel_fila_maximo_em_voo_por_conta()`, que só
 * nasciam na 0030. Corpo plpgsql só resolve nome na hora da chamada, então a
 * 0029 aplicava limpo — e o runner aplica cada arquivo num `psql` próprio,
 * em autocommit: parar entre a 0029 e a 0030 deixava duas RPCs no ar
 * chamando função que não existe. Nenhuma migration chama função `public.`
 * cuja primeira definição esteja numa migration posterior.
 */
describe("P1 — migration nenhuma chama função que só nasce depois dela", () => {
  it("toda chamada a public.<função>( vem de arquivo igual ou posterior ao que a cria", () => {
    const pasta = join(PACOTE, "supabase", "migrations");
    const arquivos = readdirSync(pasta)
      .filter((n) => /^\d{4}_.*\.sql$/.test(n) && !n.endsWith(".test.sql"))
      .sort();
    const semComentario = (sql: string): string =>
      sql
        .split("\n")
        .map((linha) => linha.replace(/--.*$/, ""))
        .join("\n");
    const textos = arquivos.map((n) => semComentario(readFileSync(join(pasta, n), "utf8")));

    const nascimento = new Map<string, number>();
    textos.forEach((sql, i) => {
      const def = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)\s*\(/gi;
      for (let m = def.exec(sql); m !== null; m = def.exec(sql)) {
        const nome = (m[1] as string).toLowerCase();
        if (!nascimento.has(nome)) nascimento.set(nome, i);
      }
    });

    const adiantadas: string[] = [];
    textos.forEach((sql, i) => {
      const chamada = /public\.([a-z_0-9]+)\s*\(/gi;
      for (let m = chamada.exec(sql); m !== null; m = chamada.exec(sql)) {
        const nome = (m[1] as string).toLowerCase();
        const nasce = nascimento.get(nome);
        if (nasce !== undefined && nasce > i) {
          adiantadas.push(`${arquivos[i]} chama ${nome}(), que nasce em ${arquivos[nasce]}`);
        }
      }
    });
    expect([...new Set(adiantadas)], "chamada a função que ainda não existe quando a migration termina").toEqual([]);
  });
});

/**
 * P1 do Codex (PR #42, 8ª rodada): o limite de sessões em voo só pode ser
 * ANUNCIADO (escolha de conta, listagem) no mesmo arquivo em que o PULL passa
 * a obedecê-lo — a 0030. Uma 0029 que o mencionasse, aplicada sozinha,
 * roteava e mostrava um limite que o pull ainda não aplicava.
 */
describe("P1 — a 0029 não anuncia o limite de voo que só a 0030 aplica", () => {
  it("nenhuma chamada às funções do limite de voo na 0029", () => {
    const sql = readFileSync(
      join(PACOTE, "supabase", "migrations", "0029_lifeboard_v3_estimativa_zero_e_a_lista_de_contas.sql"),
      "utf8",
    )
      .split("\n")
      .map((linha) => linha.replace(/--.*$/, ""))
      .join("\n");
    expect(sql).not.toMatch(/painel_fila_em_voo\s*\(|painel_fila_maximo_em_voo_por_conta\s*\(/);
  });
});

/**
 * P1 + P2 do Codex (PR #42, 21ª rodada): duas propriedades que a suíte SQL
 * não consegue exercitar, porque ela roda numa conexão só e aplica cada
 * migration inteira antes do primeiro bloco.
 *
 * (1) DROP e CREATE da mesma função numa transação. O runner e o passo do
 *     DEPLOY.md usam `psql` em autocommit; um deploy interrompido entre os dois
 *     comandos deixava os chamadores sem função nenhuma.
 * (2) `painel_caixa_lancar_item` trava o item antes de escolher a entidade
 *     canônica — sem isso, uma publicação concorrente a uma troca de sessão
 *     lia o vínculo antigo.
 */
describe("21ª rodada — o que só se prova lendo o SQL", () => {
  const MIGRACOES = join(PACOTE, "supabase", "migrations");
  const arquivos = readdirSync(MIGRACOES)
    .filter((n) => /^00(2[7-9]|3\d)_.*\.sql$/.test(n) && !n.endsWith(".test.sql"))
    .sort();

  // Exceção declarada: a 0027 apaga a SOBRECARGA de 13 argumentos de
  // `painel_fila_motivo_do_pull` enquanto a de 15 continua viva (0022/0024) —
  // não há intervalo sem função; o CREATE mais adiante substitui a de 15.
  const SOBRECARGA_EXTRA = new Set(["0027_lifeboard_v3_ultima_palavra_do_dinheiro.sql: painel_fila_motivo_do_pull"]);

  it("todo DROP FUNCTION seguido de CREATE da mesma função está dentro de begin/commit", () => {
    const soltos: string[] = [];
    for (const nome of arquivos) {
      const texto = readFileSync(join(MIGRACOES, nome), "utf8");
      const re = /^drop function if exists public\.(\w+)\(/gm;
      for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
        const funcao = m[1] as string;
        const depois = texto.slice(m.index);
        if (!new RegExp(`create or replace function public\\.${funcao}\\(`).test(depois)) continue;
        const antes = texto.slice(0, m.index);
        const ultimoBegin = antes.lastIndexOf("\nbegin;");
        const ultimoCommit = antes.lastIndexOf("\ncommit;");
        const chave = `${nome}: ${funcao}`;
        if (SOBRECARGA_EXTRA.has(chave)) continue;
        if (ultimoBegin === -1 || ultimoBegin < ultimoCommit) soltos.push(chave);
      }
    }
    expect(soltos, "drop+create fora de transação: um deploy interrompido deixa a função ausente").toEqual([]);
  });

  it("a última painel_caixa_lancar_item lê o item com FOR UPDATE", () => {
    const ultima = [...arquivos]
      .reverse()
      .map((nome) => readFileSync(join(MIGRACOES, nome), "utf8"))
      .find((t) => t.includes("create or replace function public.painel_caixa_lancar_item("));
    expect(ultima, "nenhuma migration define painel_caixa_lancar_item").toBeDefined();
    const corpo = (ultima as string).slice(
      (ultima as string).lastIndexOf("create or replace function public.painel_caixa_lancar_item("),
    );
    expect(corpo).toMatch(/from public\.painel_fila_prompts f where f\.id = p_item\s+for update;/);
  });
});

/**
 * P1 do Codex (PR #42, 22ª rodada): a publicação de uma sessão também TRAVA o
 * item antes de decidir de quem é o custo. Sem trava, a sessão A publicando
 * enquanto o item trocava de A para B achava o item pelo vínculo antigo e, já
 * dentro de `painel_caixa_lancar_item`, relia `session_id = B` e lançava o
 * custo de A na entidade B, com posto 40 — reproduzido com duas conexões
 * (B publicou 30, A publicou 70: o livro terminava com 70 em B e nada em A).
 * A suíte SQL roda numa conexão só e não consegue encenar a corrida, por isso
 * a guarda é de texto.
 */
describe("22ª rodada — a publicação trava o item que vai receber o custo", () => {
  const MIGRACOES = join(PACOTE, "supabase", "migrations");

  it("a última painel_frentes_sessoes_lancar busca o item com FOR UPDATE", () => {
    const ultima = readdirSync(MIGRACOES)
      .filter((n) => n.endsWith(".sql") && !n.endsWith(".test.sql"))
      .sort()
      .reverse()
      .map((nome) => readFileSync(join(MIGRACOES, nome), "utf8"))
      .find((t) => t.includes("create or replace function public.painel_frentes_sessoes_lancar()"));
    expect(ultima, "nenhuma migration define painel_frentes_sessoes_lancar").toBeDefined();
    const texto = ultima as string;
    const inicio = texto.lastIndexOf("create or replace function public.painel_frentes_sessoes_lancar()");
    const corpo = texto.slice(inicio, texto.indexOf("$$;", inicio));
    expect(corpo).toMatch(/where f\.session_id = new\.sessao_id\s+limit 1\s+for update;/);
  });
});

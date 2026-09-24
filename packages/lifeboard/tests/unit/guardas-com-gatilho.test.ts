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

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const AQUI = new URL(".", import.meta.url).pathname;
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

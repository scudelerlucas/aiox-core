#!/usr/bin/env node
/**
 * Gera a versão da suíte comportamental que roda no SQL Editor do Supabase.
 *
 * POR QUE EXISTE: `supabase/tests/fila_prompts.test.sql` foi escrito para
 * `psql -v ON_ERROR_STOP=0`. Cada bloco termina em `raise exception` — é assim
 * que ele desfaz o próprio trabalho e não deixa resíduo — e o psql segue para o
 * próximo. O SQL Editor do Supabase roda a colagem inteira como UMA transação e
 * aborta no primeiro erro: pararia no bloco 1 e os outros 58 nunca rodariam.
 *
 * O que este gerador faz: embrulha cada bloco num tratador de exceção que
 * captura a mensagem e grava numa tabela temporária. O `raise` continua lá e
 * continua revertendo (o tratador reverte até o início do bloco). Nenhuma
 * asserção é alterada.
 *
 * MEDIDO (14/09/2026, Postgres 16): num banco limpo, o arquivo original via
 * psql dá 59 ok / 0 falhas, e esta versão em transação única dá o mesmo. Numa
 * réplica com dado, os totais do livro-razão ficam idênticos antes e depois —
 * zero resíduo.
 *
 * A SUÍTE É SENSÍVEL A ESTADO: vários blocos conferem aritmética sobre a conta
 * de prova `lsgpandora@gmail.com` (ex.: T01 espera consumo=42). Num banco com
 * lançamentos anteriores dessa conta, esses blocos ficam vermelhos como
 * ARTEFATO, não como defeito. Os blocos que valem em qualquer estado, porque
 * medem invariante e não número, são T52, T53, T56, T57 e T58 — são eles que
 * provam as correções desta leva (D42, D43, D46, D47, D44b).
 *
 * Pré-requisito do banco: `private.lifeboard_config` precisa ter a chave
 * `load_secret` (ver DEPLOY.md). Sem ela, ~15 blocos param antes da asserção.
 *
 * Uso: node scripts/gerar-suite-sql-editor.mjs > /tmp/suite-sql-editor.sql
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origem = join(aqui, "..", "supabase", "tests", "fila_prompts.test.sql");
const src = readFileSync(origem, "utf8");

const padrao = /^do \$\$\n([\s\S]*?)\nend \$\$;/gm;
const blocos = [];
let m;
while ((m = padrao.exec(src)) !== null) {
  const antes = src.slice(0, m.index);
  const titulos = antes.match(/^-- (T\d+[^\n]*)$/gm) ?? [];
  const titulo = (titulos.at(-1) ?? `bloco ${blocos.length + 1}`)
    .replace(/^-- /, "")
    .trim()
    .replaceAll("'", "''");
  blocos.push({ corpo: m[1].trim(), titulo });
}

if (blocos.length === 0) {
  throw new Error(`Nenhum bloco encontrado em ${origem} — o formato mudou?`);
}

const partes = [
  `-- GERADO por scripts/gerar-suite-sql-editor.mjs — NÃO EDITE AQUI.`,
  `-- Fonte: supabase/tests/fila_prompts.test.sql (${blocos.length} blocos).`,
  `-- Versão para o SQL Editor do Supabase: cada bloco roda dentro de um`,
  `-- tratador de exceção, porque o Editor aborta a colagem inteira no primeiro`,
  `-- erro e os blocos terminam em \`raise\` de propósito (é o rollback deles).`,
  `--`,
  `-- Veredito por bloco: \`ok\` passou | \`FALHA\` não passou | \`ERRO\` quebrou antes.`,
  ``,
  `select set_config('lifeboard.teste', 'on', false) as barreira_de_teste;`,
  ``,
  `drop table if exists _resultado_suite;`,
  `create temp table _resultado_suite (n int, titulo text, veredito text, saida text);`,
  ``,
  `do $suite$`,
  `begin`,
];

blocos.forEach(({ corpo, titulo }, i) => {
  partes.push(
    ``,
    `  -- ───── ${titulo} ─────`,
    `  begin`,
    `    ${corpo}`,
    `    end;`,
    `  exception when others then`,
    `    insert into _resultado_suite values (${i + 1}, '${titulo}',`,
    `      case when sqlerrm like 'RESULTADO: ok%' then 'ok'`,
    `           when sqlerrm like 'FALHA:%'        then 'FALHA'`,
    `           else 'ERRO' end,`,
    `      sqlerrm);`,
    `  end;`,
  );
});

partes.push(
  ``,
  `end;`,
  `$suite$;`,
  ``,
  `select veredito, count(*) as blocos`,
  `  from _resultado_suite group by veredito order by 1;`,
  ``,
  `select n, titulo, veredito, saida`,
  `  from _resultado_suite where veredito <> 'ok' order by n;`,
  ``,
);

process.stdout.write(partes.join("\n"));

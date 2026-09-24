import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * OS-LIFEBOARD · P7 — CRÍTICO 1 (crítico da rodada 13): A SUÍTE SQL NÃO PODE
 * MAIS CONTAR A SI MESMA.
 *
 * O runner tirava o número de blocos esperados de um `grep -c` sobre o PRÓPRIO
 * arquivo da suíte. Apagar um bloco derrubava os dois lados da comparação e a
 * suíte dizia `✓ 73/73 blocos ok`. O crítico usou isso: apagou o T74 (o piso
 * do dia negativo), tirou dois `greatest(..., 0)` das migrations e despachou
 * US$ 840 contra um teto de US$ 500 com os quatro portões verdes. Do lado do
 * vitest só existiam guardas para T00–T51, T62 e T63 — T64 a T74, justamente
 * os blocos de D53, D54, headroom × execução e piso do dia negativo, não
 * tinham guarda nenhuma.
 *
 * Agora são TRÊS cópias independentes, e as três têm de casar:
 *   1. a suíte `supabase/tests/fila_prompts.test.sql` (os blocos de verdade);
 *   2. o manifesto `supabase/tests/BLOCOS.txt` (o que o RUNNER exige por nome);
 *   3. o array deste arquivo (o que o VITEST exige por nome).
 * Apagar um bloco exige mexer nos três, em três arquivos diferentes, e cada
 * mudança aparece no diff como uma linha removida de uma lista nominal.
 */

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const RAIZ = join(AQUI, "..", "..");
const SUITE = join(RAIZ, "supabase", "tests", "fila_prompts.test.sql");
const MANIFESTO = join(RAIZ, "supabase", "tests", "BLOCOS.txt");
const RUNNER = join(RAIZ, "scripts", "rodar-suite-sql.sh");

/**
 * A lista fixada À MÃO. Não se deriva de arquivo nenhum de propósito: derivar
 * é exatamente o defeito que este arquivo existe para fechar.
 */
const BLOCOS_FIXADOS: readonly string[] = [
  "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08",
  "T09", "T10", "T11", "T12", "T13", "T14", "T15", "T16",
  "T17", "T18", "T19", "T20", "T21", "T22", "T23", "T24",
  "T25", "T26", "T27", "T28", "T29", "T30", "T31", "T32",
  "T33", "T34", "T35", "T36", "T37", "T38", "T39", "T40",
  "T41", "T42", "T43", "T44", "T45", "T46", "T47", "T48",
  "T49", "T50", "T51", "T52", "T53", "T54", "T55", "T56",
  "T57", "T58", "T59", "T60", "T61", "T62", "T63", "T64",
  "T65", "T66", "T67", "T68", "T69", "T70", "T71", "T72",
  "T73", "T74", "T75", "T76", "T77", "T78", "T79", "T80",
  "T81", "T82", "T83", "T84", "T85", "T86", "T87", "T88",
  "T89", "T90", "T91", "T92", "T93", "T94", "T95", "T96", "T97", "T98", "T99", "T100", "T101", "T102", "T103", "T104", "T105", "T106", "T107", "T108", "T109", "T110", "T111", "T112",
];

function idsDoManifesto(): string[] {
  return readFileSync(MANIFESTO, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split(/\s+/)[0] as string);
}

function idsDaSuite(): string[] {
  const texto = readFileSync(SUITE, "utf8");
  // `T\d+`, não `T\d\d` + `slice(-3)`: com dois dígitos fixos o T100 era
  // lido como "T10".
  const achados = texto.match(/raise exception 'RESULTADO: ok — T\d+/g) ?? [];
  return achados.map((a) => a.slice(a.lastIndexOf("T")));
}

describe("CRÍTICO 1 — o esperado da suíte SQL é NOMINAL e vem de fora dela", () => {
  it("o manifesto BLOCOS.txt lista exatamente os blocos fixados aqui, na mesma ordem", () => {
    expect(
      idsDoManifesto(),
      "supabase/tests/BLOCOS.txt divergiu do array deste teste — se um bloco saiu de propósito, tire-o dos TRÊS lugares no mesmo commit",
    ).toEqual([...BLOCOS_FIXADOS]);
  });

  it("a suíte tem um bloco para cada identificador fixado, e nenhum a mais", () => {
    expect(
      idsDaSuite(),
      "os blocos de fila_prompts.test.sql divergiram da lista nominal — bloco apagado, renomeado ou acrescentado sem entrar no manifesto",
    ).toEqual([...BLOCOS_FIXADOS]);
  });

  /**
   * A QUARTA cópia, de forma diferente das outras três: um PISO.
   *
   * Sabotagem minha, rodada 13: apagar o bloco nos TRÊS lugares no mesmo
   * commit (suíte + manifesto + array) deixa tudo verde — e é assim por
   * desenho, porque remoção legítima existe. Só que um `sed` que troca "T67"
   * por nada apaga as três de uma vez, e o diff de um arquivo grande esconde
   * bem uma lista a menos.
   *
   * O piso é um NÚMERO, não um nome: para encolher a suíte é preciso baixá-lo
   * à mão, e uma linha `const PISO_DE_BLOCOS = 77` num diff é uma frase em voz
   * alta ("a suíte encolheu"), que é o que um revisor precisa ver.
   * Acrescentar bloco não pede nada aqui; o piso só proíbe descer.
   */
  it("a suíte nunca encolhe: o número de blocos só sobe", () => {
    const PISO_DE_BLOCOS = 112;
    expect(
      BLOCOS_FIXADOS.length,
      "a suíte SQL encolheu — se a remoção é de propósito, baixe o PISO_DE_BLOCOS no mesmo commit e diga por quê na mensagem",
    ).toBeGreaterThanOrEqual(PISO_DE_BLOCOS);
  });

  it("nenhum identificador aparece duas vezes (dois blocos com o mesmo nome escondem um apagado)", () => {
    expect(new Set(BLOCOS_FIXADOS).size).toBe(BLOCOS_FIXADOS.length);
  });

  it("os blocos que o crítico mediu sem guarda (T64–T74) estão na lista", () => {
    for (const id of ["T64", "T65", "T66", "T67", "T68", "T69", "T70", "T71", "T72", "T73", "T74"]) {
      expect(BLOCOS_FIXADOS, `bloco sem guarda de unidade: ${id}`).toContain(id);
    }
  });

  it("cada bloco do manifesto tem cabeçalho próprio na suíte (o rótulo não é enfeite)", () => {
    const texto = readFileSync(SUITE, "utf8");
    const semCabecalho = BLOCOS_FIXADOS.filter(
      (id) => !new RegExp(`^-- ${id} · `, "m").test(texto),
    );
    expect(semCabecalho, "bloco sem a linha `-- Txx · …` que explica o que ele prova").toEqual([]);
  });
});

/**
 * ALTO 1 (crítico da rodada 13): o runner declarava sucesso com ZERO testes.
 * `set -uo pipefail` sem `-e`: arquivo da suíte ausente → `ESPERADOS` vazio →
 * `[ 0 -lt "" ]` erra sem ser fatal → `✓ 0/ blocos ok`, saída 0. Estas guardas
 * seguram a FORMA do script; a prova de comportamento é rodá-lo sem o arquivo,
 * que é o que o job `lifeboard-sql` do CI faz a cada push.
 */
describe("ALTO 1 — o runner morre cedo em vez de dizer verde sem rodar nada", () => {
  const runner = readFileSync(RUNNER, "utf8");

  it("liga `set -e` (sem ele, comando que falha não interrompe o script)", () => {
    expect(runner).toMatch(/^set -euo pipefail$/m);
  });

  it("exige o arquivo da suíte e o manifesto ANTES de abrir o banco", () => {
    expect(runner).toMatch(/\[ -r "\$SUITE" \] \|\| morrer/);
    expect(runner).toMatch(/\[ -r "\$MANIFESTO" \] \|\| morrer/);
    expect(runner).toMatch(/\$\{#BLOCOS_ESPERADOS\[@\]\}" -gt 0 \] \|\| morrer/);
  });

  it("reprova quando nenhum bloco ficou verde", () => {
    expect(runner).toMatch(/\[ "\$VERDES" -eq 0 \] *; *then[\s\S]{0,200}morrer/);
  });

  it("não tira mais o esperado do próprio arquivo da suíte", () => {
    expect(
      runner,
      'o `grep -c "raise exception" "$SUITE"` é o CRÍTICO 1 — o esperado tem de vir do manifesto',
    ).not.toMatch(/ESPERADOS=.*grep -c.*\$SUITE/);
    expect(runner).toContain("BLOCOS.txt");
  });

  it("confere os dois sentidos: falta no relatório e sobra fora do manifesto", () => {
    expect(runner).toContain("FALTANDO");
    expect(runner).toContain("SOBRANDO");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * OS-LIFEBOARD · P5 — rodada 14, achado BAIXO 7: CAMPO QUE NINGUÉM LÊ.
 *
 * `fonteKind` viajava do servidor para o navegador em toda resposta da linha
 * do tempo, com um comentário que prometia o que ele faria — *"mesma cor do
 * grafo (`corDaFonte`), para o olho ligar as duas telas"* — e **nenhuma linha
 * de código o lia**. O mesmo valia para `duracaoTotal`. Os dois saíram.
 *
 * Campo morto é pior que campo ausente: ele faz o próximo leitor acreditar
 * que a tela usa aquilo e gastar o tempo dele procurando onde. E o tipo não
 * protege — TypeScript reprova o campo que FALTA, nunca o que sobra.
 *
 * ## Por que esta medida não conta a si mesma
 *
 * O universo dos campos é DERIVADO do arquivo de contrato (`src/types/linha-
 * do-tempo.ts`), não de uma lista escrita aqui: um campo novo entra sozinho.
 * Os leitores são DERIVADOS do que consome o contrato — o componente e os
 * módulos puros de `src/core/timeline/` —, com o MONTADOR de fora: é ele quem
 * escreve os campos, e incluí-lo faria todo campo parecer lido por ser
 * escrito. É exatamente a forma "universo por convenção" que esta base já
 * pegou em outras guardas.
 *
 * A rede fecha nos dois sentidos: campo sem leitor REPROVA (é o peso morto
 * voltando) e exceção declarada que já tem leitor TAMBÉM reprova (é uma
 * dispensa morta guardando a porta aberta para outra coisa).
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTRATO = "src/types/linha-do-tempo.ts";

/**
 * Quem consome o contrato. O montador (`src/core/timeline/linha-do-tempo.ts`)
 * fica FORA de propósito: ele é o escritor, e contá-lo como leitor aprovaria
 * qualquer campo só por existir.
 */
const CONSUMIDORES = [
  "src/components/timeline/linha-do-tempo.tsx",
  "src/core/timeline/assunto-em-palavras.ts",
  "src/core/timeline/periodo-da-tarefa.ts",
  "src/core/timeline/fora-da-janela-em-palavras.ts",
  "src/core/timeline/eixo-rotulos.ts",
  "src/core/timeline/geometria-painel.ts",
  "src/core/timeline/sincronizacao-painel.ts",
];

/**
 * Campos que existem sem leitor, com motivo escrito. Hoje: nenhum. A lista
 * existe para que a próxima exceção seja uma DECISÃO escrita, não um silêncio.
 */
const SEM_LEITOR_DECLARADOS: { campo: string; motivo: string }[] = [];

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Os campos de toda `interface` exportada do arquivo de contrato. */
function camposDoContrato(): { interfaceName: string; campo: string }[] {
  const fonte = readFileSync(join(RAIZ, CONTRATO), "utf8");
  const saida: { interfaceName: string; campo: string }[] = [];
  for (const m of fonte.matchAll(/export interface (\w+)[^{]*\{([\s\S]*?)\n\}/g)) {
    const corpo = semComentarios(m[2] ?? "");
    for (const c of corpo.matchAll(/^ {2}(\w+)\??:/gm)) {
      saida.push({ interfaceName: m[1] ?? "", campo: c[1] ?? "" });
    }
  }
  return saida;
}

const LEITURA = CONSUMIDORES.map((arquivo) =>
  semComentarios(readFileSync(join(RAIZ, arquivo), "utf8")),
).join("\n");

describe("o contrato da linha do tempo não carrega campo que ninguém lê", () => {
  it("o universo é derivado de verdade — o contrato inteiro, não uma lista", () => {
    const campos = camposDoContrato();
    /* Se a derivação quebrar (a forma das interfaces mudando), ela devolveria
       pouco ou nada — e a varredura aprovaria por vazio. Este é o piso. */
    expect(campos.length).toBeGreaterThan(25);
    expect(campos.map((c) => c.interfaceName)).toContain("LinhaDoTempoTarefaRow");
    expect(campos.map((c) => c.interfaceName)).toContain("LinhaDoTempoProps");
    expect(campos.map((c) => `${c.interfaceName}.${c.campo}`)).toContain(
      "LinhaDoTempoTarefaRow.predecessores",
    );
  });

  it("os leitores existem e leem de verdade (a fonte não está vazia)", () => {
    expect(LEITURA.length).toBeGreaterThan(50_000);
    expect(LEITURA).toContain("predecessores");
  });

  it("todo campo do contrato é lido por alguém que consome o contrato", () => {
    const orfaos = camposDoContrato()
      .filter(({ campo }) => !new RegExp(`\\b${campo}\\b`).test(LEITURA))
      .filter(({ campo }) => !SEM_LEITOR_DECLARADOS.some((d) => d.campo === campo))
      .map(({ interfaceName, campo }) => `${interfaceName}.${campo}`);
    expect(
      [...new Set(orfaos)],
      "campo do contrato que ninguém lê: ou a tela passa a usá-lo, ou ele sai do contrato (foi o que aconteceu com `fonteKind` e `duracaoTotal` na rodada 14)",
    ).toEqual([]);
  });

  it("exceção declarada que já tem leitor reprova — dispensa morta é porta aberta", () => {
    const mortas = SEM_LEITOR_DECLARADOS.filter((d) => new RegExp(`\\b${d.campo}\\b`).test(LEITURA));
    expect(mortas.map((d) => d.campo)).toEqual([]);
  });

  it("os dois campos da rodada 14 não voltaram", () => {
    const fonte = readFileSync(join(RAIZ, CONTRATO), "utf8");
    expect(semComentarios(fonte)).not.toMatch(/\bfonteKind\b/);
    expect(semComentarios(fonte)).not.toMatch(/\bduracaoTotal\b/);
  });
});

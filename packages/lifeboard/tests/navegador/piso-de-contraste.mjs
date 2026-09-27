/**
 * OS-LIFEBOARD · P5 — rodada 14, achado ALTO 1: O PISO VEM DE FORA.
 *
 * ## Por que este arquivo existe
 *
 * A guarda mede *"este elemento pinta na cor que ele declara?"* — distância
 * entre o pixel e a cor da linha. Essa pergunta, sozinha, **nunca mede α**.
 * No modelo de mistura que o compositor do navegador usa,
 *
 *     P = α·C + (1 − α)·B
 *
 * a cor esperada é calculada com o MESMO α que o elemento declara. Então
 * `opacity: 0.12` muda C e muda a expectativa junto: o pixel continua "em
 * cima da linha", os pixels continuam mudando quando o elemento se esconde, e
 * a medida aprova uma faixa que o olho não vê. Provado duas vezes, sem
 * combinação: na peça P4 (12,40:1 → 1,21:1) e na P5, pelo crítico da rodada
 * 13, na faixa "Hoje" (9,89:1 → 1,18:1).
 *
 * A cura é fazer DUAS perguntas separadas:
 *
 *   1. **é a cor certa?** — distância até a linha declarada (o que já existia);
 *   2. **dá para um humano enxergar?** — o CONTRASTE do pixel composto contra
 *      o pixel REAL do fundo daquele mesmo lugar, medido nas duas fotos.
 *
 * E o piso da pergunta 2 **não pode sair de onde sai a cor**. Se o número
 * morasse no componente, no tema ou na própria guarda, quem baixasse a
 * opacidade poderia baixar o piso no mesmo commit e a guarda contaria a si
 * mesma — a forma 1 do vício desta base. Por isso ele é LIDO de
 * `scripts/checar-contraste.mjs`, que é um portão independente (roda sozinho,
 * é um dos cinco) e cuja régua vem da WCAG 1.4.11, não desta peça.
 *
 * ## Como ele é lido, e por que não é importado
 *
 * `checar-contraste.mjs` é um script de topo: ele imprime e chama
 * `process.exit`. Importá-lo mataria a guarda. Então o piso é EXTRAÍDO do
 * texto da tabela `PARES` dele — e a extração é conferida: os mínimos
 * declarados lá têm de ser exatamente dois (o de não-texto e o de texto), com
 * pares de verdade em cada um. Qualquer outra forma REPROVA em vez de chutar
 * um número — piso que falha aberto é piso que não existe.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ARQUIVO_DO_PISO = "scripts/checar-contraste.mjs";

/**
 * Lê os mínimos declarados na tabela `PARES` do medidor de contraste.
 *
 * Devolve `{ naoTexto, texto, pares }`. Lança quando a tabela não tem a forma
 * esperada — nunca devolve um default.
 */
export function pisosDeContraste() {
  const fonte = readFileSync(join(RAIZ_DO_PACOTE, ARQUIVO_DO_PISO), "utf8");
  const tabela = /const PARES = \[([\s\S]*?)\n\];/.exec(fonte);
  if (!tabela) {
    throw new Error(
      `${ARQUIVO_DO_PISO}: não achei a tabela \`PARES\` — o piso de contraste desta guarda vem dela, e sem ela a guarda não tem régua`,
    );
  }
  /* Só linhas de código: uma linha comentada (`// ["state-error", …]`) é
     registro histórico, não régua vigente. O arquivo tem uma dessas. */
  const linhas = tabela[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("["));
  const minimos = [];
  for (const linha of linhas) {
    const m = /^\[\s*"[^"]+"\s*,\s*"[^"]+"\s*,\s*([\d.]+)\s*,/.exec(linha);
    if (m) minimos.push(Number(m[1]));
  }
  const distintos = [...new Set(minimos)].sort((a, b) => a - b);
  if (distintos.length !== 2) {
    throw new Error(
      `${ARQUIVO_DO_PISO}: esperava DOIS mínimos distintos na régua (não-texto e texto) e achei ${JSON.stringify(
        distintos,
      )} em ${String(minimos.length)} pares — a guarda não inventa piso`,
    );
  }
  const [naoTexto, texto] = distintos;
  if (!(naoTexto > 1 && texto > naoTexto)) {
    throw new Error(`${ARQUIVO_DO_PISO}: mínimos fora de ordem: ${JSON.stringify(distintos)}`);
  }
  /* Cada um dos dois mínimos tem de ter par de verdade — um mínimo com uma
     linha só é um valor de teste, não uma régua. */
  for (const piso of distintos) {
    const quantos = minimos.filter((v) => v === piso).length;
    if (quantos < 2) {
      throw new Error(
        `${ARQUIVO_DO_PISO}: o mínimo ${String(piso)} aparece em só ${String(quantos)} par(es)`,
      );
    }
  }
  return { naoTexto, texto, pares: minimos.length };
}

import type { SourceKind } from "@/types/canonical";

/**
 * OS-LIFEBOARD — regra do filtro por fonte, em módulo próprio para poder ser
 * testada sem montar o dashboard inteiro (que arrasta ReactFlow e o router).
 */

/**
 * Filtro vazio significa "todas as fontes" — inclusive uma fonte cujo `kind`
 * não estava na união quando este arquivo foi escrito. Antes existia aqui uma
 * lista fixa dos 5 kinds conhecidos em julho, usada como "todas"; a fonte
 * `lms` (Cativa, no banco desde 12/08) não entrava nela, então toda tarefa
 * dela sumiria da lista de hoje **sem nada na tela dizer por quê**. Mesma
 * causa-raiz do 500 de 13/09: união do TypeScript congelada contra um banco
 * que já aceita mais valores.
 */
export function passaNoFiltro(
  kind: SourceKind | undefined,
  selecionadas: SourceKind[],
): boolean {
  if (selecionadas.length === 0) return true; // sem filtro = tudo
  return kind === undefined || selecionadas.includes(kind);
}

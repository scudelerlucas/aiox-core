import "server-only";
/**
 * OS-LIFEBOARD · E4 — Motor HIERARQ (camada O do CHC, INALIENÁVEL). Função PURA.
 *
 * Fonte da verdade: PRD §4 — "O motor de priorização diária ordena tarefas por
 * HIERARQ (S1×S2×S3, desempate S1>S3>S2)" — e architecture.md §8.
 *
 *   • Score:     S = s1 × s2 × s3   (de `task.priorityHierarq`)
 *   • Ordenação: por S DECRESCENTE (maior prioridade primeiro)
 *   • Desempate: aplicado só quando o PRODUTO S empata. Compara na ORDEM EXATA
 *                s1 > s3 > s2 (cada campo maior primeiro):
 *                  1º) s1 desc;  2º) empate → s3 desc;  3º) empate → s2 desc.
 *
 * `import "server-only"` no topo (kill-switch nº 3 do PRD): esta lógica é a
 * camada O inalienável — NUNCA entra no bundle client. Espelha o padrão de
 * `adapters/<fonte>/client.mcp.ts`. Em teste, `server-only` é aliasado p/ um stub
 * (vitest.config.ts), então os testes unitários importam este módulo direto.
 */

import type { Task } from "@/types/canonical";

/** S = s1 × s2 × s3 (PRD §4 / architecture.md §8). Puro, determinístico. */
export function scoreHierarq(task: Task): number {
  const { s1, s2, s3 } = task.priorityHierarq;
  return s1 * s2 * s3;
}

/**
 * Comparador de ordenação HIERARQ (PRD §4). Uso: `tasks.sort(compareHierarq)`.
 * Retorna < 0 quando `a` tem MAIOR prioridade que `b` (vem antes na lista "hoje").
 *
 * 1º) produto S = s1×s2×s3 (maior primeiro)
 * 2º) empate no produto → desempate na ordem EXATA s1 > s3 > s2 (cada campo desc)
 *
 * Nota matemática: quando o produto e s1 empatam, s2×s3 empata; se s3 também
 * empata, então s2 é forçado a empatar. Logo a comparação final por s2 nunca
 * decide sozinha sob produto igual — está aqui por COMPLETUDE fiel ao PRD §4.
 */
export function compareHierarq(a: Task, b: Task): number {
  const sa = scoreHierarq(a);
  const sb = scoreHierarq(b);
  if (sa !== sb) return sb - sa; // produto: maior primeiro

  // Empate no produto → desempate S1 > S3 > S2 (PRD §4), cada campo desc.
  const pa = a.priorityHierarq;
  const pb = b.priorityHierarq;
  if (pa.s1 !== pb.s1) return pb.s1 - pa.s1; // 1º s1
  if (pa.s3 !== pb.s3) return pb.s3 - pa.s3; // 2º s3
  if (pa.s2 !== pb.s2) return pb.s2 - pa.s2; // 3º s2 (completude — ver nota acima)
  return 0; // totalmente empatado → ordem estável (Array.prototype.sort é estável)
}

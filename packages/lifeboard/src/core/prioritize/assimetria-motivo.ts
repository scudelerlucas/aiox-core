/**
 * OS-LIFEBOARD · P6 — por que uma tarefa não tem score de assimetria.
 *
 * [BAIXO #7, rodada 5 do crítico] `scoreAssimetria` devolvia `null` para dois
 * casos que NÃO são o mesmo, e a tela dizia a mesma frase nos dois:
 *
 *  - `sem_atomos` — a tarefa não declarou `assimetria` (ou declarou átomo
 *    fora do domínio): a frase "Sem átomos declarados" é verdadeira e o
 *    próximo passo do operador é declarar os três.
 *  - `nao_calculavel` — os átomos ESTÃO declarados e válidos, mas a divisão
 *    não pode ser feita (esforço/custo efetivos em 0 ou não finitos — a
 *    guarda de defesa em profundidade de `assimetria.ts`). Aqui "Sem átomos
 *    declarados" é FALSO: mandava o operador re-declarar o que já estava
 *    salvo, e ele nunca sairia do lugar.
 *
 * Vive em módulo próprio (não em `assimetria.ts`) porque `assimetria.ts` é
 * `server-only` — o Client Component `atomos-form.tsx` precisa só DESTE tipo,
 * e não pode puxar aquele módulo nem por engano (kill-switch nº 3).
 */
export type MotivoSemScore = "sem_atomos" | "nao_calculavel";

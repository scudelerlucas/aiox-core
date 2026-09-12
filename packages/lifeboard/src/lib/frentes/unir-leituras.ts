/**
 * PAINEL DE ASSUNTOS — junta as leituras parciais do banco num só conjunto.
 *
 * Por que existe: o que está ABERTO não pode ser cortado por janela de tempo
 * nem por teto de lista. Medido no banco real em 12/09/2026 — 823 mudanças na
 * janela de 90 dias, das quais só 29 abertas: um único `.limit(400)` ordenado
 * por data deixava 2 mudanças abertas de fora, e mudança aberta fora do painel
 * é exatamente o que o painel existe para não deixar acontecer.
 *
 * Então o repositório faz duas consultas (aberto, sem janela · encerrado, com
 * janela) e estas funções PURAS costuram os resultados sem duplicar ninguém.
 */

import { maisRecente, ms } from "@/lib/frentes/tempo";
import type { BranchSemPr, Pr } from "@/lib/frentes/types";

/** Momento em que a mudança se mexeu por último. */
function quandoPr(p: Pr): number {
  return ms(maisRecente(p.atualizado_em, p.mergeado_em, p.fechado_em));
}

/**
 * Une mudanças abertas (nunca cortadas) e encerradas, sem repetir. Quando a
 * mesma mudança vem nas duas consultas — corrida entre o `merge` e a leitura —
 * vale a cópia de estado MAIS AVANÇADO: se uma diz "mergeado" e a outra ainda
 * diz "aberto", a verdade é que ela fechou.
 */
export function unirPrs(abertas: Pr[], encerradas: Pr[]): Pr[] {
  const porChave = new Map<string, Pr>();
  for (const p of [...abertas, ...encerradas]) {
    const chave = `${p.repo}#${p.numero}`;
    const anterior = porChave.get(chave);
    if (!anterior) {
      porChave.set(chave, p);
      continue;
    }
    // Encerrada vence aberta; entre duas iguais, a que se mexeu mais tarde.
    const anteriorAberta = anterior.estado === "aberto";
    const atualAberta = p.estado === "aberto";
    if (anteriorAberta && !atualAberta) porChave.set(chave, p);
    else if (anteriorAberta === atualAberta && quandoPr(p) > quandoPr(anterior)) {
      porChave.set(chave, p);
    }
  }
  return [...porChave.values()].sort((a, b) => quandoPr(b) - quandoPr(a));
}

/** Une trabalho commitado sem mudança (nunca cortado) e o resto, sem repetir. */
export function unirBranches(
  semMudanca: BranchSemPr[],
  comMudanca: BranchSemPr[],
): BranchSemPr[] {
  const porChave = new Map<string, BranchSemPr>();
  for (const b of [...semMudanca, ...comMudanca]) {
    const chave = `${b.repo}@@${b.branch}`;
    const anterior = porChave.get(chave);
    if (!anterior || ms(b.ultimo_commit_em) > ms(anterior.ultimo_commit_em)) {
      porChave.set(chave, b);
    }
  }
  return [...porChave.values()].sort(
    (a, b) => ms(b.ultimo_commit_em) - ms(a.ultimo_commit_em),
  );
}

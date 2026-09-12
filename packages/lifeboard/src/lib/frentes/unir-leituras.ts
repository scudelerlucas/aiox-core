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

import type { BranchSemPr, Pr } from "@/lib/frentes/types";

function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const valor = Date.parse(iso);
  return Number.isNaN(valor) ? 0 : valor;
}

/** Une mudanças abertas (nunca cortadas) e encerradas, sem repetir. */
export function unirPrs(abertas: Pr[], encerradas: Pr[]): Pr[] {
  const vistas = new Set<string>();
  const saida: Pr[] = [];
  for (const p of [...abertas, ...encerradas]) {
    const chave = `${p.repo}#${p.numero}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(p);
  }
  return saida.sort(
    (a, b) =>
      ms(b.atualizado_em ?? b.mergeado_em ?? b.fechado_em) -
      ms(a.atualizado_em ?? a.mergeado_em ?? a.fechado_em),
  );
}

/** Une trabalho commitado sem mudança (nunca cortado) e o resto, sem repetir. */
export function unirBranches(
  semMudanca: BranchSemPr[],
  comMudanca: BranchSemPr[],
): BranchSemPr[] {
  const vistas = new Set<string>();
  const saida: BranchSemPr[] = [];
  for (const b of [...semMudanca, ...comMudanca]) {
    const chave = `${b.repo}@@${b.branch}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(b);
  }
  return saida.sort((a, b) => ms(b.ultimo_commit_em) - ms(a.ultimo_commit_em));
}

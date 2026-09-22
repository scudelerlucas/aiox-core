"use client";

/**
 * OS-LIFEBOARD · P6 — o rascunho dos campos de texto da página da tarefa.
 *
 * [BAIXO #6, rodada 5 do crítico] Escrever meia nota, clicar numa subtarefa
 * (ou numa relação) e voltar apagava tudo: o `useState` da textarea morre
 * com a rota. Decisão do operador: guardar em `sessionStorage` por
 * `tarefa:<id>:<campo>`, restaurar ao voltar, apagar ao salvar — e **nunca**
 * `beforeunload` (o diálogo "deseja mesmo sair?" é ruído do navegador, não
 * uma decisão do operador).
 *
 * ═══════════════════════════════════════════════════════════ MÉDIO #1, rodada 14 ═
 * O MECANISMO PROTEGIA A NOTA E ABANDONAVA OS VIZINHOS.
 *
 * Este arquivo se chamava `rascunho-nota.ts` e era importado por UM lugar
 * (`notas-painel.tsx`). Na mesma página, a "Nota da relação" nasceu na rodada
 * 13 já sem a proteção; o título e a duração da subtarefa também não a tinham;
 * A página é cheia de links para outras tarefas (cada relação, cada subtarefa) e
 * `useAvisoDeSaida` só arma quando há gravação a caminho — navegar apagava, em
 * silêncio.
 *
 * O campo de duração da TAREFA é o único que fica de fora, e por escrito: ele
 * nasce com o número que o servidor guarda, e um rascunho ali faria a caixa
 * discordar do banco sem dizer (ver `duracao-form.tsx`).
 *
 * A correção não é copiar o mecanismo em cada formulário: é ele deixar de ser
 * "da nota". As funções passam a receber o NOME DO CAMPO, os sete campos de
 * texto livre da página usam as mesmas quatro funções, e a guarda que cobra
 * isso é derivada do JSX (`camposDeTextoLivre`, em
 * `tests/unit/tarefa-varredura-derivada.ts`): o próximo campo de texto que
 * nascer sem rascunho deixa o teste vermelho, sem ninguém ter de lembrar de
 * acrescentar um nome a lista nenhuma.
 *
 * As chaves dos dois campos da nota continuam `tarefa:<id>:nota` e
 * `tarefa:<id>:nota:autor` — quem tinha rascunho na sessão não o perde na
 * troca.
 *
 * `sessionStorage` pode LANÇAR na leitura e na escrita (aba anônima com
 * cookies bloqueados, cota estourada, Safari em modo privado antigo) — por
 * isso todo acesso é try/catch e o valor de falha é o estado neutro
 * ("sem rascunho"), nunca uma exceção que derrube a página da tarefa.
 *
 * `deposito` é injetável só para o teste (o repo não tem jsdom; ver
 * `controle-segmentado.test.tsx`) — em produção o default é
 * `window.sessionStorage`.
 */
export interface DepositoRascunho {
  getItem: (chave: string) => string | null;
  setItem: (chave: string, valor: string) => void;
  removeItem: (chave: string) => void;
}

/**
 * Os campos de texto livre da página, por nome. Existe como objeto para o
 * campo e a chave nascerem no mesmo lugar — e para o teste poder percorrer
 * todos sem escrever uma segunda lista.
 */
export const CAMPOS_COM_RASCUNHO = {
  nota: "nota",
  notaAutor: "nota:autor",
  relacaoNota: "relacao:nota",
  relacaoDesconto: "relacao:desconto",
  subtarefaTitulo: "subtarefa:titulo",
  subtarefaDuracao: "subtarefa:duracao",
} as const;

export type CampoComRascunho = (typeof CAMPOS_COM_RASCUNHO)[keyof typeof CAMPOS_COM_RASCUNHO];

/** Uma chave por tarefa E por campo — nunca uma global. */
export function chaveRascunho(taskId: string, campo: string): string {
  return `tarefa:${taskId}:${campo}`;
}

/** `null` quando não há `sessionStorage` utilizável (SSR, ou acesso que lança). */
export function depositoPadrao(): DepositoRascunho | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function lerRascunho(
  taskId: string,
  campo: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): string {
  if (!deposito) return "";
  try {
    return deposito.getItem(chaveRascunho(taskId, campo)) ?? "";
  } catch {
    return "";
  }
}

export function gravarRascunho(
  taskId: string,
  campo: string,
  valor: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  if (!deposito) return;
  try {
    // Rascunho vazio não é rascunho — apagar evita deixar lixo na sessão e
    // faz "limpei o campo de propósito" voltar limpo na próxima visita.
    if (valor.length === 0) deposito.removeItem(chaveRascunho(taskId, campo));
    else deposito.setItem(chaveRascunho(taskId, campo), valor);
  } catch {
    // Cota/permissão: perder o rascunho é aceitável; derrubar a página não.
  }
}

/**
 * Apaga os rascunhos de um formulário INTEIRO — texto e autor da nota saem
 * juntos, ou nenhum sai; título e duração da subtarefa, idem.
 */
export function limparRascunhos(
  taskId: string,
  campos: readonly string[],
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  if (!deposito) return;
  for (const campo of campos) {
    try {
      deposito.removeItem(chaveRascunho(taskId, campo));
    } catch {
      // idem
    }
  }
}

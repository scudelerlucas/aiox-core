"use client";

/**
 * OS-LIFEBOARD · P6 — rascunho da nota que sobrevive à navegação.
 *
 * [BAIXO #6, rodada 5 do crítico] Escrever meia nota, clicar numa subtarefa
 * (ou numa relação) e voltar apagava tudo: o `useState` da textarea morre
 * com a rota. Decisão do operador: guardar em `sessionStorage` por
 * `tarefa:<id>:nota`, restaurar ao voltar, apagar ao salvar — e **nunca**
 * `beforeunload` (o diálogo "deseja mesmo sair?" é ruído do navegador, não
 * uma decisão do operador).
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

export function chaveRascunhoNota(taskId: string): string {
  return `tarefa:${taskId}:nota`;
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

export function lerRascunhoNota(
  taskId: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): string {
  if (!deposito) return "";
  try {
    return deposito.getItem(chaveRascunhoNota(taskId)) ?? "";
  } catch {
    return "";
  }
}

export function gravarRascunhoNota(
  taskId: string,
  texto: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  if (!deposito) return;
  try {
    // Rascunho vazio não é rascunho — apagar evita deixar lixo na sessão e
    // faz "limpei o campo de propósito" voltar limpo na próxima visita.
    if (texto.length === 0) deposito.removeItem(chaveRascunhoNota(taskId));
    else deposito.setItem(chaveRascunhoNota(taskId), texto);
  } catch {
    // Cota/permissão: perder o rascunho é aceitável; derrubar a página não.
  }
}

export function limparRascunhoNota(
  taskId: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  if (!deposito) return;
  try {
    deposito.removeItem(chaveRascunhoNota(taskId));
  } catch {
    // idem
  }
}

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

/**
 * [BAIXO, rodada 11] O CAMPO "autor" NÃO VOLTAVA.
 *
 * Medido: o texto da nota sobrevivia ao F5 e o autor não — quem escrevia
 * "Lucas" e recarregava perdia só metade do formulário, que é o pior dos três
 * desfechos possíveis (voltar tudo, voltar nada, voltar metade sem avisar).
 * Mesma chave, mesmo depósito, mesmo tratamento de falha.
 */
export function chaveRascunhoAutorNota(taskId: string): string {
  return `tarefa:${taskId}:nota:autor`;
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
  return lerChave(chaveRascunhoNota(taskId), deposito);
}

export function lerRascunhoAutorNota(
  taskId: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): string {
  return lerChave(chaveRascunhoAutorNota(taskId), deposito);
}

function lerChave(chave: string, deposito: DepositoRascunho | null): string {
  if (!deposito) return "";
  try {
    return deposito.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

export function gravarRascunhoNota(
  taskId: string,
  texto: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  gravarChave(chaveRascunhoNota(taskId), texto, deposito);
}

export function gravarRascunhoAutorNota(
  taskId: string,
  autor: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  gravarChave(chaveRascunhoAutorNota(taskId), autor, deposito);
}

function gravarChave(chave: string, valor: string, deposito: DepositoRascunho | null): void {
  if (!deposito) return;
  try {
    // Rascunho vazio não é rascunho — apagar evita deixar lixo na sessão e
    // faz "limpei o campo de propósito" voltar limpo na próxima visita.
    if (valor.length === 0) deposito.removeItem(chave);
    else deposito.setItem(chave, valor);
  } catch {
    // Cota/permissão: perder o rascunho é aceitável; derrubar a página não.
  }
}

/** Apaga o rascunho INTEIRO — texto e autor saem juntos, ou nenhum sai. */
export function limparRascunhoNota(
  taskId: string,
  deposito: DepositoRascunho | null = depositoPadrao(),
): void {
  if (!deposito) return;
  try {
    deposito.removeItem(chaveRascunhoNota(taskId));
    deposito.removeItem(chaveRascunhoAutorNota(taskId));
  } catch {
    // idem
  }
}

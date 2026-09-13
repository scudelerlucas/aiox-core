/**
 * OS-LIFEBOARD · P7 — contratos da fila de prompts (pull entre as 3 contas).
 *
 * Fonte: hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
 * (linhas R1/R2/R6, transferências T1/T2) + o contrato exato de
 * `supabase/migrations/0007_lifeboard_v3_fila_prompts.sql`. Espelha
 * literalmente as 3 contas da casa e a tabela de roteamento de modelo
 * (`Lucas-Contexto-Geral/.claude/rules/model-routing.md`) — mudar aqui sem
 * mudar lá (ou vice-versa) quebra o "porquê" que a tela mostra.
 */

export const CONTAS = [
  "lucasscudeler@gmail.com",
  "lsgpandora@gmail.com",
  "almapetra.ltda@gmail.com",
] as const;

export type Conta = (typeof CONTAS)[number];

/** Rótulo curto para a UI — nunca o e-mail inteiro no cartão. */
export const ROTULO_CONTA: Record<Conta, string> = {
  "lucasscudeler@gmail.com": "Lucas",
  "lsgpandora@gmail.com": "Pandora",
  "almapetra.ltda@gmail.com": "Alma Petra",
};

export function contaValida(valor: string): valor is Conta {
  return (CONTAS as readonly string[]).includes(valor);
}

export const COMPLEXIDADES = ["baixa", "media", "alta", "maxima"] as const;
export type Complexidade = (typeof COMPLEXIDADES)[number];

export function complexidadeValida(valor: string): valor is Complexidade {
  return (COMPLEXIDADES as readonly string[]).includes(valor);
}

export type ModeloSugerido = "Haiku" | "Sonnet" | "Opus" | "Fable";

/**
 * Mapa complexidade → modelo, idêntico à tabela de `model-routing.md` do hub:
 * grep/listagem → Haiku · código comum/edição → Sonnet · arquitetura/auditoria
 * → Opus · decisão estratégica/ADR → Fable.
 */
export const MODELO_POR_COMPLEXIDADE: Record<Complexidade, ModeloSugerido> = {
  baixa: "Haiku",
  media: "Sonnet",
  alta: "Opus",
  maxima: "Fable",
};

export const ROTULO_COMPLEXIDADE: Record<Complexidade, string> = {
  baixa: "baixa",
  media: "média",
  alta: "alta",
  maxima: "máxima",
};

export function modeloParaComplexidade(complexidade: Complexidade): ModeloSugerido {
  return MODELO_POR_COMPLEXIDADE[complexidade];
}

export const ESTADOS_FILA = ["na_fila", "pega", "concluida", "falhou", "cancelada"] as const;
export type EstadoFila = (typeof ESTADOS_FILA)[number];

export interface ItemFilaPrompt {
  id: string;
  conta: Conta;
  prompt: string;
  complexidade: Complexidade;
  modeloSugerido: ModeloSugerido;
  estado: EstadoFila;
  custoUsd: number | null;
  criadoEm: string;
  pegoEm: string | null;
  concluidoEm: string | null;
  sessaoUrl: string | null;
  resultado: string | null;
  criadoPor: string | null;
  taskId: string | null;
}

export interface ConsumoConta {
  conta: Conta;
  tetoUsd: number;
  consumoHojeUsd: number;
}

export interface FilaPromptsState {
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
}

/** Faixa de cor da barra de progresso (régua declarada no pedido do P7). */
export type FaixaConsumo = "ok" | "warn" | "crit";

export function faixaConsumo(consumoHojeUsd: number, tetoUsd: number): FaixaConsumo {
  if (tetoUsd <= 0) return "crit";
  const razao = consumoHojeUsd / tetoUsd;
  if (razao >= 0.9) return "crit";
  if (razao >= 0.6) return "warn";
  return "ok";
}

export function tetoAtingido(consumoHojeUsd: number, tetoUsd: number): boolean {
  return consumoHojeUsd >= tetoUsd;
}

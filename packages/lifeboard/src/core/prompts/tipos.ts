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

/**
 * Achado CRÍTICO #1 do crítico hostil (rodada de correção, 13/09/2026):
 * mapa complexidade → custo ESTIMADO em US$, idêntico à seed de
 * `public.painel_custo_estimado` (`supabase/migrations/
 * 0009_lifeboard_v3_fila_ajustes.sql`). Mesma disciplina de
 * `MODELO_POR_COMPLEXIDADE` × `model-routing.md`: duas implementações porque
 * rodam em runtimes diferentes — o banco decide de verdade (o trigger SEMPRE
 * recalcula do lado do SQL, nenhum caller pode forjar o valor); esta tabela é
 * só o que a TELA usa para mostrar o headroom ANTES de enviar.
 */
export const CUSTO_ESTIMADO_POR_COMPLEXIDADE: Record<Complexidade, number> = {
  baixa: 5,
  media: 15,
  alta: 50,
  maxima: 120,
};

export function custoEstimadoParaComplexidade(complexidade: Complexidade): number {
  return CUSTO_ESTIMADO_POR_COMPLEXIDADE[complexidade];
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
  /** Achado CRÍTICO #1: custo estimado gravado no item — sempre recalculado pelo trigger, nunca aceito de fora. */
  custoEstimadoUsd: number;
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
  /** Gasto MEDIDO do dia (sem estimativa) — sessões publicadas + itens concluídos hoje. */
  consumoHojeUsd: number;
  /** Achado CRÍTICO #1/#2: soma do custo estimado de tudo que está `na_fila` ou `pega` para esta conta. */
  reservadoUsd: number;
  /** Achado ALTO #7: instante da última sincronização medida (ISO) — null se nenhuma sessão foi publicada hoje ainda. */
  medidoAteEm: string | null;
}

export interface FilaPromptsState {
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
}

/** Faixa de cor da barra de progresso (régua declarada no pedido do P7). */
export type FaixaConsumo = "ok" | "warn" | "crit";

/**
 * Achado ALTO #7: a faixa e o "atingido" agora olham medido + reservado — um
 * item Fable na_fila que empurraria a conta para o teto já pinta a barra
 * como crítica, mesmo antes de qualquer sessão real gastar 1 centavo.
 */
export function faixaConsumo(
  consumoHojeUsd: number,
  reservadoUsd: number,
  tetoUsd: number,
): FaixaConsumo {
  if (tetoUsd <= 0) return "crit";
  const razao = (consumoHojeUsd + reservadoUsd) / tetoUsd;
  if (razao >= 0.9) return "crit";
  if (razao >= 0.6) return "warn";
  return "ok";
}

export function tetoAtingido(
  consumoHojeUsd: number,
  reservadoUsd: number,
  tetoUsd: number,
): boolean {
  return consumoHojeUsd + reservadoUsd >= tetoUsd;
}

/** Headroom (US$) ainda livre hoje para esta conta, podendo ficar negativo. */
export function headroomUsd(consumo: ConsumoConta): number {
  return consumo.tetoUsd - consumo.consumoHojeUsd - consumo.reservadoUsd;
}

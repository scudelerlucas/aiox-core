/**
 * OS-LIFEBOARD · P7 — contratos da fila de prompts (pull entre as 3 contas).
 *
 * Fonte: hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
 * (linhas R1/R2/R6, transferências T1/T2) + o contrato exato de
 * `supabase/migrations/0007…` → `0009…` → `0011…` → `0012_lifeboard_v3_fila_
 * posse_e_tentativas.sql` (rodada 3: posse, heartbeat, tentativas,
 * elegibilidade por item). Espelha literalmente as 3 contas da casa e a
 * tabela de roteamento de modelo (`Lucas-Contexto-Geral/.claude/rules/
 * model-routing.md`) — mudar aqui sem mudar lá (ou vice-versa) quebra o
 * "porquê" que a tela mostra.
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

/**
 * D9 (rodada 3): a tela NUNCA escreve o valor cru do enum. "maxima" é chave de
 * banco; "máxima" é português. Toda frase que cita a complexidade passa por
 * aqui — foi a falta disto que produziu "uma tarefa maxima" na recusa.
 */
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
 * Mapa complexidade → custo ESTIMADO em US$, idêntico à seed de
 * `public.painel_custo_estimado`. O banco decide de verdade (o trigger SEMPRE
 * recalcula; nenhum caller pode forjar o valor); esta tabela é o que a TELA
 * usa para mostrar o espaço livre ANTES de enviar.
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

/**
 * D9 (rodada 3): dinheiro em português — "US$ 120,00", nunca "US$ 120.00".
 * `Intl` daria o mesmo resultado, mas com dependência de ICU no runtime do
 * servidor; o valor aqui vai de 0 a 500, então a troca do ponto é suficiente
 * e determinística em qualquer ambiente (inclusive no teste).
 */
export function formatarUsd(valor: number): string {
  return `US$ ${valor.toFixed(2).replace(".", ",")}`;
}

// ── D1/D2 · posse e sinal de vida ────────────────────────────────────────────

/** 45 min sem sinal = o worker morreu (mesma constante do SQL, 0012). */
export const HEARTBEAT_LIMITE_MIN = 45;
const MINUTO_MS = 60_000;
export const HEARTBEAT_LIMITE_MS = HEARTBEAT_LIMITE_MIN * MINUTO_MS;

export const ESTADOS_FILA = ["na_fila", "pega", "concluida", "falhou", "cancelada"] as const;
export type EstadoFila = (typeof ESTADOS_FILA)[number];

export interface ItemFilaPrompt {
  id: string;
  conta: Conta;
  /** D8: vem TRUNCADO em 300 caracteres da RPC — `promptTamanho` diz o real. */
  prompt: string;
  promptTamanho: number;
  complexidade: Complexidade;
  modeloSugerido: ModeloSugerido;
  estado: EstadoFila;
  custoUsd: number | null;
  /** Custo estimado gravado no item — sempre recalculado pelo trigger, nunca aceito de fora. */
  custoEstimadoUsd: number;
  criadoEm: string;
  pegoEm: string | null;
  concluidoEm: string | null;
  /** D1: último sinal de vida do worker que pegou (ISO) — null quando ninguém está com ele. */
  heartbeatEm: string | null;
  /** D1: id da sessão da Routine que pegou (fencing token). */
  workerId: string | null;
  tentativas: number;
  maxTentativas: number;
  /** D1/D6: id da sessão FILHA criada pelo `create_session`. */
  sessionId: string | null;
  /** D2: por que virou `falhou` sem o worker dizer nada. */
  motivoFalha: string | null;
  sessaoUrl: string | null;
  resultado: string | null;
  criadoPor: string | null;
  taskId: string | null;
}

export interface ConsumoConta {
  conta: Conta;
  tetoUsd: number;
  /** Gasto MEDIDO do dia — sessões publicadas + itens fechados hoje cuja sessão ainda não foi publicada (D6). */
  consumoHojeUsd: number;
  /** D3: soma do estimado do que está EM EXECUÇÃO agora (`pega` com heartbeat vivo). `na_fila` NÃO entra. */
  reservadoUsd: number;
  /** D3: soma do estimado do que ESPERA (`na_fila`) — só pesa na ESCOLHA da conta, nunca na recusa. */
  naFilaUsd: number;
  /** Instante da última sincronização medida (ISO) — null se nenhuma sessão foi publicada hoje. */
  medidoAteEm: string | null;
}

export interface FilaPromptsState {
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
  /** D8: existe página anterior a esta (itens mais antigos) além do limite pedido. */
  temMais: boolean;
  limite: number;
}

/** Faixa de cor da barra de consumo. */
export type FaixaConsumo = "ok" | "warn" | "crit";

/** A barra mostra o que já foi gasto + o que está gastando AGORA (nunca a fila parada). */
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

/**
 * D3: o que o PULL realmente checa — `medido + em_execucao + estimado <= teto`.
 * A fila parada (`naFilaUsd`) NÃO entra: ela não gastou nada ainda.
 */
export function headroomUsd(consumo: ConsumoConta): number {
  return consumo.tetoUsd - consumo.consumoHojeUsd - consumo.reservadoUsd;
}

/**
 * D5: o que o ROTEADOR usa para ESCOLHER a conta — desconta também a fila
 * parada, para não empilhar tudo na mesma conta. Nunca é motivo de recusa.
 */
export function espacoLivreUsd(consumo: ConsumoConta): number {
  return headroomUsd(consumo) - consumo.naFilaUsd;
}

// ── D7 · o que a tela diz sobre um item em execução ──────────────────────────

/** Um item `pega` cujo último sinal passou de 45 min: o próximo pull o devolve. */
export function semSinal(item: ItemFilaPrompt, agora: number): boolean {
  if (item.estado !== "pega") return false;
  const ultimo = item.heartbeatEm ?? item.pegoEm;
  if (!ultimo) return true;
  const t = Date.parse(ultimo);
  if (Number.isNaN(t)) return true;
  return agora - t > HEARTBEAT_LIMITE_MS;
}

/** "2 h 10 min", "37 min", "3 d 4 h" — duração sóbria, sem "há". */
export function duracaoCurta(ms: number): string {
  const total = Math.max(0, Math.round(ms / MINUTO_MS));
  if (total < 1) return "menos de 1 min";
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas < 24) return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto === 0 ? `${dias} d` : `${dias} d ${resto} h`;
}

/**
 * D7: a frase que a linha da fila mostra para um item `pega`.
 * Vivo:  "em execução há 2 h 10 min · último sinal há 3 min"
 * Morto: "sem sinal há 1 h — volta para a fila no próximo pull"
 * (na última tentativa, o próximo pull não devolve: marca como falhou.)
 */
export function descricaoExecucao(item: ItemFilaPrompt, agora: number): string | null {
  if (item.estado !== "pega") return null;
  const idade = item.pegoEm ? duracaoCurta(agora - Date.parse(item.pegoEm)) : null;
  const ultimo = item.heartbeatEm ?? item.pegoEm;
  const desdeSinal = ultimo ? duracaoCurta(agora - Date.parse(ultimo)) : null;

  if (semSinal(item, agora)) {
    const fim =
      item.tentativas >= item.maxTentativas
        ? "vira “falhou” no próximo pull (última tentativa)"
        : "volta para a fila no próximo pull";
    return `sem sinal há ${desdeSinal ?? "muito tempo"} — ${fim}`;
  }
  return `em execução há ${idade ?? "pouco"} · último sinal há ${desdeSinal ?? "pouco"}`;
}

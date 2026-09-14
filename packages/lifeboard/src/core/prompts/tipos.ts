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

/**
 * 45 min sem sinal = o worker morreu. D17 (rodada 4): esta constante e a
 * próxima NÃO são "a mesma coisa do SQL" por promessa — `tests/unit/
 * prompts-espelho-sql.test.ts` LÊ as migrations do disco e compara. Renomeadas
 * nesta rodada (`HEARTBEAT_LIMITE_MIN` → `JANELA_HEARTBEAT_MIN`) para o teste
 * apontar para um nome só.
 */
export const JANELA_HEARTBEAT_MIN = 45;
const MINUTO_MS = 60_000;
export const JANELA_HEARTBEAT_MS = JANELA_HEARTBEAT_MIN * MINUTO_MS;

/** Quantas vezes um item pode ser pego antes de virar `falhou` (default do SQL). */
export const MAX_TENTATIVAS = 3;

/** D19 (rodada 4): castigo de um item devolvido — 15 min × tentativas. */
export const BACKOFF_POR_TENTATIVA_MIN = 15;

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
  /** D20: o `custoUsd` foi lançado pela casa (ninguém mediu) — a tela marca. */
  custoEEstimativa: boolean;
  /** D20: quando o operador corrigiu o custo pela tela (ISO) — null se nunca. */
  custoAjustadoEm: string | null;
  /** D19: item devolvido só volta a ser elegível a partir deste instante (ISO). */
  disponivelEm: string | null;
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
  /** D20: quanto do `consumoHojeUsd` é ESTIMATIVA da casa (ninguém mediu). */
  estimativaUsd: number;
  /** D20: quantos itens formam essa parcela. */
  estimativaItens: number;
  /** D19: quantos itens estão de castigo (backoff) esperando nova tentativa. */
  emEspera: number;
  /** Instante da última sincronização medida (ISO) — null se nenhuma sessão foi publicada hoje. */
  medidoAteEm: string | null;
}

export interface FilaPromptsState {
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
  /** D8: existe página anterior a esta (itens mais antigos) além do limite pedido. */
  temMais: boolean;
  limite: number;
  /** D15: cursor do ÚLTIMO item desta página — vira `?antes=` na URL. */
  proximoAntesDe: string | null;
  /** D15: o `id` do mesmo item — o desempate do cursor (`?antesId=`). */
  proximoAntesId: string | null;
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
  return agora - t > JANELA_HEARTBEAT_MS;
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

// ── D13 · uma régua só, e nunca um número negativo na tela ───────────────────

/**
 * O que a TELA mostra de espaço livre. A régua é o headroom (`teto − medido −
 * em_execucao`) — o mesmo número que o pull compara. Negativo não vira
 * "US$ -20,00 livres": vira "sem espaço livre agora", porque dívida de teto
 * não é espaço.
 */
export function textoEspacoLivre(consumo: ConsumoConta): string {
  const headroom = headroomUsd(consumo);
  if (headroom <= 0) return "sem espaço livre agora";
  return `${formatarUsd(headroom)} livres`;
}

/**
 * D13: a previsão — quanto sobra DEPOIS do que já está na fila daquela conta.
 * Serve para escolher a conta e para avisar; nunca para recusar. Clampada em 0
 * pelo mesmo motivo acima.
 */
export function textoPrevisaoComFila(consumo: ConsumoConta, itensNaFrente?: number): string | null {
  if (consumo.naFilaUsd <= 0) return null;
  const sobra = Math.max(0, espacoLivreUsd(consumo));
  // A contagem só entra quando alguém a MEDIU (a RPC de enfileirar devolve
  // `itens_na_frente`). Sem ela, a frase fala de dinheiro, que é o que se sabe
  // — inventar um número de itens a partir do valor seria chute com cara de dado.
  const sujeito =
    itensNaFrente === undefined
      ? `${formatarUsd(consumo.naFilaUsd)} já esperando na fila`
      : `${itensNaFrente === 1 ? "1 item na frente soma" : `${itensNaFrente} itens na frente somam`} ${formatarUsd(consumo.naFilaUsd)}`;
  return `${sujeito} — sobrariam ${formatarUsd(sobra)}`;
}

/**
 * D20: a parcela do consumo que ninguém mediu. A tela precisa dizer isto em
 * voz alta: um número inflado por estimativa pode congelar a conta o dia
 * inteiro, e o operador tem que saber que pode corrigi-lo.
 */
export function textoEstimativa(consumo: ConsumoConta): string | null {
  if (consumo.estimativaUsd <= 0 || consumo.estimativaItens <= 0) return null;
  const itens =
    consumo.estimativaItens === 1
      ? "1 item que morreu sem fechar"
      : `${consumo.estimativaItens} itens que morreram sem fechar`;
  return `${formatarUsd(consumo.estimativaUsd)} do consumo são estimativa de ${itens}`;
}

// ── D14 · o SQL manda código + números; a frase nasce aqui ───────────────────

/** Códigos devolvidos por `fila_prompts_enfileirar` (migration 0013). */
export const MOTIVOS_ENFILEIRAR = [
  "auto_maior_espaco",
  "auto_nao_cabe_hoje",
  "manual_cabe",
  "manual_nao_cabe_hoje",
] as const;
export type MotivoEnfileirar = (typeof MOTIVOS_ENFILEIRAR)[number];

export function motivoEnfileirarValido(v: string): v is MotivoEnfileirar {
  return (MOTIVOS_ENFILEIRAR as readonly string[]).includes(v);
}

export interface NumerosDoEnfileiramento {
  conta: Conta;
  complexidade: Complexidade;
  headroomUsd: number;
  espacoLivreUsd: number;
  custoEstimadoUsd: number;
  naFilaUsd: number;
  itensNaFrente: number;
}

/**
 * A frase de sucesso que o operador lê — montada AQUI, com rótulo de conta,
 * complexidade por extenso e vírgula decimal. Antes, em modo live, o texto vinha
 * cru do Postgres ("roteamento automatico: maior espaco livre hoje (US$ 150.00)"):
 * sem acento, com ponto decimal e com o vocabulário do banco.
 *
 * D29 (rodada 6): UMA RÉGUA. Estas frases falavam do HEADROOM enquanto a conta
 * era escolhida pelo ESPAÇO LIVRE (headroom − fila parada). O crítico mediu o
 * resultado: "nenhuma conta tem US$ 50,00 livres hoje" com uma conta de US$ 150
 * de headroom e US$ 140 já na fila. Agora o número da frase é o espaço livre, e
 * a frase diz `contando a fila parada` — o headroom aparece ao lado, como
 * explicação, nunca como o veredito.
 */
export function fraseDoEnfileiramento(
  codigo: MotivoEnfileirar,
  n: NumerosDoEnfileiramento,
): string {
  const conta = ROTULO_CONTA[n.conta];
  const complexidade = ROTULO_COMPLEXIDADE[n.complexidade];
  const espaco = Math.max(0, n.espacoLivreUsd);
  const detalheDaFila =
    n.naFilaUsd > 0
      ? ` (headroom de ${formatarUsd(Math.max(0, n.headroomUsd))} menos ` +
        `${n.itensNaFrente === 1 ? "1 item" : `${n.itensNaFrente} itens`} de ` +
        `${formatarUsd(n.naFilaUsd)} já na fila)`
      : "";

  switch (codigo) {
    case "auto_maior_espaco":
      return (
        `Enfileirado para ${conta}: é a conta com maior espaço livre hoje contando a fila ` +
        `parada (${formatarUsd(espaco)} para uma tarefa ${complexidade} de ` +
        `${formatarUsd(n.custoEstimadoUsd)})${detalheDaFila}.`
      );
    case "manual_cabe":
      return (
        `Enfileirado para ${conta} (escolha manual): cabe hoje contando a fila parada — ` +
        `${formatarUsd(espaco)} livres para uma tarefa ${complexidade} de ` +
        `${formatarUsd(n.custoEstimadoUsd)}${detalheDaFila}.`
      );
    case "auto_nao_cabe_hoje":
      return (
        `Enfileirado para ${conta}: nenhuma conta tem ${formatarUsd(n.custoEstimadoUsd)} livres ` +
        `para uma tarefa ${complexidade} contando a fila parada — a mais folgada tem ` +
        `${espaco > 0 ? formatarUsd(espaco) : "nenhum espaço livre"}${detalheDaFila}. ` +
        `Entra na fila e roda quando houver espaço.`
      );
    case "manual_nao_cabe_hoje":
      return (
        `Enfileirado para ${conta} (escolha manual): não cabe hoje contando a fila parada — ` +
        `${espaco > 0 ? `só ${formatarUsd(espaco)} livres` : "sem espaço livre agora"} ` +
        `para uma tarefa ${complexidade} de ${formatarUsd(n.custoEstimadoUsd)}${detalheDaFila}. ` +
        `Entra na fila e roda quando houver espaço.`
      );
  }
}

// ── #11 · cancelar: três histórias diferentes, três frases diferentes ────────

export const MOTIVOS_CANCELAMENTO = [
  "cancelado_nunca_pego",
  "cancelado_apos_devolucao",
  "cancelado_em_execucao",
] as const;
export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

export function motivoCancelamentoValido(v: string): v is MotivoCancelamento {
  return (MOTIVOS_CANCELAMENTO as readonly string[]).includes(v);
}

export function fraseDoCancelamento(
  codigo: MotivoCancelamento,
  custoLancadoUsd: number,
  tentativas: number,
): string {
  switch (codigo) {
    case "cancelado_nunca_pego":
      return "Cancelado. Este prompt nunca chegou a rodar, então não entrou no gasto de hoje.";
    case "cancelado_apos_devolucao":
      return (
        `Cancelado. Ele já tinha sido pego ${tentativas === 1 ? "1 vez" : `${tentativas} vezes`} e voltado ` +
        `para a fila, então ${formatarUsd(custoLancadoUsd)} entram no gasto de hoje como estimativa — ` +
        `ajuste na linha se souber o valor real.`
      );
    case "cancelado_em_execucao":
      return (
        `Cancelado durante a execução. ${formatarUsd(custoLancadoUsd)} entram no gasto de hoje como ` +
        `estimativa (a sessão estava rodando) — ajuste na linha se souber o valor real.`
      );
  }
}

// ── D27 · o motivo do pull, ADITIVO — espelho texto a texto do SQL ──────────

/**
 * Os números que o pull mede antes de escrever a frase. Nomes em TS, um a um
 * na ordem dos parâmetros de `public.painel_fila_motivo_do_pull` (migration
 * 0015) — quem mexer em um lado tem que mexer no outro, e
 * `tests/unit/prompts-motivo-do-pull.test.ts` compara os DOIS textos contra as
 * mesmas quatro frases literais que `supabase/tests/fila_prompts.test.sql`
 * afirma contra o banco.
 */
export interface NumerosDoPull {
  /** Itens que morreram NESTE disparo (3ª expiração sem sinal). */
  mortos: number;
  /** Quanto esses mortos lançaram no gasto do dia. */
  mortosUsd: number;
  /** Custo do item que o pull pegou — `null` quando não pegou nenhum. */
  custoEscolhidoUsd: number | null;
  /** `teto − medido − em execução`. Pode ser negativo; a frase nunca o mostra. */
  headroomUsd: number;
  /** O mais barato DISPONÍVEL agora (fora do backoff) — `null` se não há nenhum. */
  menorDisponivelUsd: number | null;
  /** Quantos itens disponíveis CABEM no headroom (sem travar linha nenhuma). */
  elegiveis: number;
  /** Quantos estão de castigo (backoff). */
  emEspera: number;
  /** O mais barato entre os que estão de castigo. */
  menorEmEsperaUsd: number | null;
  /** Em quantos minutos o primeiro deles volta a ser elegível. */
  voltaEmMin: number | null;
  /** Itens devolvidos para a fila NESTE disparo. */
  devolvidos: number;
  /** Itens elegíveis em uso por outra transação (B5). */
  travados: number;
  /** D20: parcela do consumo de hoje que ninguém mediu. */
  estimativaUsd: number;
  estimativaItens: number;
}

/**
 * A frase do disparo. **Aditiva**: todo fato não-zero vira uma oração, coladas
 * por "; ", nesta ordem — mortos · escolhido/nada cabe · em espera ·
 * devolvidos · travados · parcela estimada.
 *
 * Era um `case` de ramo único no SQL, e o crítico mediu as duas mentiras que
 * isso produzia: "o mais barato da fila custa US$ 120,00" com três itens de
 * US$ 5,00 em backoff, e uma morte de US$ 120,00 que o motivo calava porque
 * havia um item caro na frente. Nenhuma oração cala outra.
 */
export function montarMotivoDoPull(n: NumerosDoPull): string {
  const frases: string[] = [];

  if (n.mortos === 1) {
    frases.push(
      `1 item morreu sem fechar neste disparo e lançou ${formatarUsd(n.mortosUsd)} no dia`,
    );
  } else if (n.mortos > 1) {
    frases.push(
      `${n.mortos} itens morreram sem fechar neste disparo e lançaram ${formatarUsd(n.mortosUsd)} no dia`,
    );
  }

  if (n.custoEscolhidoUsd !== null) {
    frases.push(
      `peguei o item mais antigo que cabe: ${formatarUsd(n.custoEscolhidoUsd)} de ` +
        `${formatarUsd(n.headroomUsd)} livres`,
    );
  } else if (n.menorDisponivelUsd !== null && n.elegiveis === 0) {
    // Só é honesto dizer "nada cabe" quando NADA cabe; e headroom negativo
    // nunca vira número (o crítico mediu "so ha US$ -3.00 livres").
    const folga =
      n.headroomUsd > 0 ? `há ${formatarUsd(n.headroomUsd)} livres` : "não há espaço livre agora";
    frases.push(
      `nada cabe agora: o mais barato disponível custa ${formatarUsd(n.menorDisponivelUsd)} e ${folga}`,
    );
  }

  if (n.emEspera === 1) {
    frases.push(`1 item de ${formatarUsd(n.menorEmEsperaUsd ?? 0)} volta em ${n.voltaEmMin ?? 1} min`);
  } else if (n.emEspera > 1) {
    frases.push(
      `${n.emEspera} itens de ${formatarUsd(n.menorEmEsperaUsd ?? 0)} voltam em ${n.voltaEmMin ?? 1} min`,
    );
  }

  if (n.devolvidos === 1) {
    frases.push("1 item voltou para a fila e aguarda nova tentativa");
  } else if (n.devolvidos > 1) {
    frases.push(`${n.devolvidos} itens voltaram para a fila e aguardam nova tentativa`);
  }

  if (n.travados === 1) {
    frases.push("1 item elegível está em uso por outra operação; tente no próximo disparo");
  } else if (n.travados > 1) {
    frases.push(
      `${n.travados} itens elegíveis estão em uso por outra operação; tente no próximo disparo`,
    );
  }

  if (n.estimativaUsd > 0) {
    const itens =
      n.estimativaItens === 1
        ? "1 item que morreu sem fechar"
        : `${n.estimativaItens} itens que morreram sem fechar`;
    frases.push(`${formatarUsd(n.estimativaUsd)} do consumo de hoje são estimativa de ${itens}`);
  }

  if (frases.length === 0) return "fila vazia para esta conta";
  return frases.join("; ");
}

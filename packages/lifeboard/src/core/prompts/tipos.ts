/**
 * OS-LIFEBOARD · P7 — contratos da fila de prompts (pull entre as 4 contas).
 *
 * Fonte: hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`
 * (linhas R1/R2/R6, transferências T1/T2) + o contrato exato de
 * `supabase/migrations/0007…` → `0009…` → `0011…` → `0012_lifeboard_v3_fila_
 * posse_e_tentativas.sql` (rodada 3: posse, heartbeat, tentativas,
 * elegibilidade por item). Espelha literalmente as contas da casa — hoje QUATRO,
 * e a fonte no banco é `public.painel_contas_da_casa()` (0029 §1) — e a
 * tabela de roteamento de modelo (`Lucas-Contexto-Geral/.claude/rules/
 * model-routing.md`) — mudar aqui sem mudar lá (ou vice-versa) quebra o
 * "porquê" que a tela mostra.
 */

/**
 * MÉDIO 3 (rodada 12): a QUARTA conta. Medido em produção em 21/09/2026 —
 * `painel_teto_diario` tem quatro linhas, `arborcactus@gmail.com` entre elas
 * com teto 500, e nenhuma função da fila a citava: ela tinha orçamento e não
 * podia receber um item sequer. Esta lista e a lista das funções da
 * migration 0027 são o MESMO contrato; a ordem aqui é a ordem de desempate
 * lá (`prompts-espelho-sql.test.ts` confere as duas).
 */
export const CONTAS = [
  "lucasscudeler@gmail.com",
  "lsgpandora@gmail.com",
  "almapetra.ltda@gmail.com",
  "arborcactus@gmail.com",
] as const;

export type Conta = (typeof CONTAS)[number];

/** Rótulo curto para a UI — nunca o e-mail inteiro no cartão. */
export const ROTULO_CONTA: Record<Conta, string> = {
  "lucasscudeler@gmail.com": "Lucas",
  "lsgpandora@gmail.com": "Pandora",
  "almapetra.ltda@gmail.com": "Alma Petra",
  "arborcactus@gmail.com": "Arbor Cactus",
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
  /**
   * MÉDIO 4 (rodada 8): QUEM pôs este número — a coluna `custo_origem` do
   * banco. `custoEEstimativa` sozinho não distingue "medido pela sessão" de
   * "digitado pelo operador", e essa confusão travava a segunda correção do
   * operador com a frase "este foi medido", sobre uma sessão que nunca
   * reportou nada. Opcional para a tela degradar (e não quebrar) contra um
   * banco anterior à migration 0018.
   */
  custoOrigem?: OrigemGravada;
  /**
   * MÉDIO 3 (rodada 13) · O QUE O LIVRO DIZ DESTE ITEM — a origem do
   * lançamento ATIVO da entidade canônica dele (a sessão vinculada quando
   * existe; senão o próprio item).
   *
   * A CAUSA que estes três campos matam: a tela decidia pela COLUNA
   * `custoOrigem` do item e o banco decide pelo LANÇAMENTO VIVO da entidade.
   * Desde a precedência (D53) as duas divergem — a coluna diz `estimativa` (a
   * casa lançou quando o item morreu) enquanto a sessão vinculada já publicou
   * US$ 300 medidos. Daí saíam os três sintomas medidos pelo crítico: o botão
   * de ajuste aparecendo para um item que a RPC recusa, o aviso do
   * cancelamento prometendo dinheiro que não entra, e a célula imprimindo
   * US$ 50,00 para um item que pesa 300 no dia.
   *
   * Opcionais: banco anterior à 0028 não manda, e a tela degrada para a
   * dedução pela coluna — a mesma que valia antes.
   */
  livroOrigem?: OrigemGravada | null;
  /** MÉDIO 3: o POSTO do lançamento ativo (D53: 10/20/30/40). */
  livroPrecedencia?: number | null;
  /** MÉDIO 3: quanto essa entidade pesa no livro — a contribuição real ao dia. */
  livroLiquidoUsd?: number | null;
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
  /**
   * D32a (rodada 7): instante da ÚLTIMA medição desta conta — de QUALQUER dia,
   * não só de hoje (ISO). `null` passa a significar UMA coisa: esta conta nunca
   * teve sessão medida. Antes, `null` era "nenhuma sessão HOJE ainda", e uma
   * conta com 215 sessões e 37 h de atraso era indistinguível de uma conta que
   * nunca rodou nada — as duas imprimiam "US$ 0,00 de US$ 150,00 · US$ 150,00
   * livres", como se o zero fosse medido.
   */
  medidoAteEm: string | null;
  /** D32a: horas desde `medidoAteEm`; `null` quando nunca houve medição. */
  defasagemHoras?: number | null;
  /** D32c: esta conta recusa o pull enquanto a medição estiver velha. */
  exigeMedicaoRecente?: boolean;
  /** D32d: a faixa real dos últimos dias MEDIDOS, para o teto ser comparável. */
  historico?: HistoricoMedido | null;
  /**
   * P2 do Codex (PR #42): quantas sessões desta conta estão em voo agora e o
   * limite por conta (`painel_fila_em_voo` / `painel_fila_maximo_em_voo_por_conta`).
   * Opcionais: banco anterior à 0030 não manda, e a escolha é a de antes.
   */
  emVoo?: number;
  limiteEmVoo?: number | null;
}

/**
 * D32d (rodada 7): a realidade medida ao lado do teto. Medido pelo crítico na
 * conta real: 9 de 9 dias com dado ACIMA do teto de US$ 150 (mediana ~2,6×,
 * máximo 16,8× — 12/09 deu US$ 2.513,29 em 12 sessões). O teto continua sendo
 * decisão do operador; o que faltava era o operador PODER ver contra o quê
 * está decidindo.
 */
export interface HistoricoMedido {
  /** Quantos dias COM medição entraram na conta (hoje fora: hoje é parcial). */
  dias: number;
  minUsd: number | null;
  maxUsd: number | null;
  medianaUsd: number | null;
}

/**
 * D32a/D32b (rodada 7): acima disto o saldo é velho o bastante para ser dito em
 * voz alta. Espelho do `> 12` de `public.painel_fila_motivo_do_pull` e de
 * `fila_prompts_pegar_interno` (migration 0016) — `tests/unit/
 * prompts-espelho-sql.test.ts` lê o .sql do disco e compara com esta constante.
 */
export const LIMITE_DEFASAGEM_HORAS = 12;

/**
 * M3 (rodada 11): o TETO DIÁRIO POR CONTA — 500, por decisão do operador em
 * 14/09/2026 (régua da casa `teto-de-gasto-diario`).
 *
 * Ele existia em três lugares e em nenhum deles era conferível: o schema tinha
 * `default 150` (migration 0007 §42), o fixture tinha 500 escrito à mão, e o
 * número da decisão só vivia como PROSA no `DEPLOY.md` ("depois o `alter …
 * teto_usd set default 500`") — um passo manual que some na primeira
 * implantação feita com pressa. Agora o número mora aqui, a migration 0027 o
 * declara no banco e `tests/unit/prompts-ultima-palavra-sql.test.ts` compara
 * os dois.
 *
 * O valor é calibragem provisória: nos 9 dias com dado em
 * `painel_consumo_por_conta_dia`, 9 de 9 ficaram acima de 150 (mediana ~2,6×
 * o teto). Reavaliar com 14 dias de dado real nas quatro contas — a 0027 §4
 * semeia QUATRO (`arborcactus@gmail.com` entrou pela 0026), então o orçamento
 * despachável da casa é 4 × 500 = US$ 2.000/dia.
 */
export const TETO_DIARIO_PADRAO_USD = 500;

/**
 * ALTO 2 (crítico da rodada 13): O LIMITE POR ITEM NÃO É O TETO DO DIA.
 *
 * O limite `0..500` por item nasceu na migration 0009, quando o teto do dia
 * era 150 — um item nunca chegava perto. A decisão de 14/09 subiu o teto para
 * 500 e ninguém revisitou o limite por item: os dois números viraram o mesmo,
 * e a porta de FECHAMENTO passou a recusar a medição real. Medido: item com
 * estimativa de 120 que custou 620 era recusado ao fechar, morria valendo 120
 * no livro e abria US$ 380 de teto que não existiam.
 *
 * A régua agora: quem REGISTRA custo já gasto aceita o número real; quem
 * recusa é o PULL, que não despacha nada novo enquanto o dia não couber. Este
 * número é só sanidade (unidade trocada, dedo escorregado) e espelha
 * `public.painel_custo_maximo_por_item()` (0027 §0).
 */
export const CUSTO_MAXIMO_POR_ITEM_USD = 100000;

/**
 * CRÍTICO (crítico/coordenador da rodada 15): O PISO NÃO É O NÚMERO ZERO.
 *
 * A rodada 14 trocou `usd >= 0` por `usd > 0` em três paredes e fechou o
 * NÚMERO que o crítico daquela rodada usou. A CLASSE ficou aberta: com
 * `painel_custo_estimado.usd = 0.0001` o coordenador despachou 40 sessões em
 * voo na mesma conta contra US$ 1,00 de espaço no dia, reserva total de
 * US$ 0,0040 — e US$ 1,00 admitiria dez mil sessões.
 *
 * `ITENS_SIMULTANEOS_MAXIMOS_POR_VALOR` é o ÚNICO número da derivação: quantos
 * itens simultâneos o teto de um dia pode admitir só pelo VALOR antes de a
 * reserva por item deixar de ser freio. O piso é `teto / esse número` — 1% de
 * US$ 500 — e é igual à complexidade mais barata que a casa declara
 * (`baixa` = 5), então nada que o painel declara hoje é recusado.
 *
 * Espelha `public.painel_fila_itens_simultaneos_maximos_por_valor()` e
 * `public.painel_custo_minimo_por_item()` (migration 0030 §1);
 * `tests/unit/prompts-ultima-palavra-sql.test.ts` amarra os dois lados.
 */
export const ITENS_SIMULTANEOS_MAXIMOS_POR_VALOR = 100;

/** Piso de valor por item — irmão de `CUSTO_MAXIMO_POR_ITEM_USD`. */
export const CUSTO_MINIMO_POR_ITEM_USD = 5;

/**
 * CRÍTICO (rodada 15): QUANTAS SESSÕES A MESMA CONTA PODE TER EM VOO.
 *
 * O dano do achado é de CONTAGEM, não de soma: o que fere a casa é quantas
 * sessões caras rodam ao mesmo tempo na mesma conta. Uma sessão real custa da
 * ordem de US$ 200 (12/09/2026: US$ 2.513,29 em 12 sessões) contra um teto de
 * US$ 500 — duas medianas já comem o dia. Quatro é o que o teto paga na
 * complexidade mais cara declarada (`maxima` = 120), então esta parede não
 * tira nada que a parede de valor já permitia a preço cheio: tira só a compra
 * de concorrência por estimativa barata.
 *
 * Espelha `public.painel_fila_maximo_em_voo_por_conta()` (migration 0030 §1).
 */
export const MAXIMO_EM_VOO_POR_CONTA = 4;

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
  // CRÍTICO 1 (rodada 13): mesmo piso de `headroomUsd` — um dia negativo não
  // pode desfazer um teto já atingido pelo que está em execução.
  return Math.max(0, consumoHojeUsd) + reservadoUsd >= tetoUsd;
}

/**
 * D3: o que o PULL realmente checa — `medido + em_execucao + estimado <= teto`.
 * A fila parada (`naFilaUsd`) NÃO entra: ela não gastou nada ainda.
 *
 * CRÍTICO 1 (rodada 13): o gasto entra COM PISO ZERO, exatamente como
 * `fila_prompts_pegar_interno` (migration 0027 §1) passou a fazer. É a raiz de
 * "US$ 843,50 livres" num teto de 500, medida no Chromium: com
 * `consumoHojeUsd = -358,50` esta subtração devolvia MAIS teto do que existe, e
 * tudo o que deriva dela — a frase "livres", a previsão com a fila, a escolha
 * automática de conta — herdava o número inflado. Gasto negativo é crédito de
 * um dia fechado; crédito não vira teto, aqui nem no banco.
 */
export function headroomUsd(consumo: ConsumoConta): number {
  return consumo.tetoUsd - Math.max(0, consumo.consumoHojeUsd) - consumo.reservadoUsd;
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

// ── D32a/d · a tela diz DE QUANDO é o número, e contra o que o teto compara ──

/**
 * O que o card escreve sobre a idade do saldo. Três estados, e eles são
 * DIFERENTES — o crítico da rodada 6 mediu os três colapsados em um:
 *
 *  · nunca mediu nada      → "sem medição nenhuma" (NUNCA "US$ 0,00 … livres":
 *    zero não medido não é zero gasto, e a tela não pode fingir que é);
 *  · mediu há mais de 12 h → "última medição há N h" (medido: 37 h, e a tela
 *    mostrava o saldo como se fosse de agora);
 *  · mediu há pouco        → o de sempre, "medido até há X".
 *
 * Devolve o texto curto e o rótulo do estado; quem pinta é o componente.
 */
export type EstadoDaMedicao = "sem-medicao" | "atrasada" | "recente";

export function estadoDaMedicao(consumo: ConsumoConta, agora: number): EstadoDaMedicao {
  if (consumo.medidoAteEm === null) return "sem-medicao";
  const horas = horasDeDefasagem(consumo, agora);
  if (horas === null) return "sem-medicao";
  return horas > LIMITE_DEFASAGEM_HORAS ? "atrasada" : "recente";
}

/**
 * As horas de atraso: o número do banco (`defasagemHoras`) quando ele vem, e o
 * cálculo local a partir de `medidoAteEm` quando não vem (banco antigo, sem a
 * migration 0016 — a tela degrada, não quebra).
 */
export function horasDeDefasagem(consumo: ConsumoConta, agora: number): number | null {
  if (typeof consumo.defasagemHoras === "number" && Number.isFinite(consumo.defasagemHoras)) {
    return consumo.defasagemHoras;
  }
  if (consumo.medidoAteEm === null) return null;
  const t = Date.parse(consumo.medidoAteEm);
  if (Number.isNaN(t)) return null;
  return (agora - t) / 3_600_000;
}

export function textoDaMedicao(consumo: ConsumoConta, agora: number): string {
  const estado = estadoDaMedicao(consumo, agora);
  if (estado === "sem-medicao") return "sem medição nenhuma";
  if (estado === "atrasada") {
    const horas = horasDeDefasagem(consumo, agora) ?? 0;
    return `última medição há ${Math.round(horas)} h`;
  }
  return "medição recente";
}

/**
 * MÉDIO 1 (rodada 8) · O BANCO RECUSARIA ESTE DISPARO AGORA?
 *
 * Espelho exato da porta de `fila_prompts_pegar_interno` (migration 0016 §8,
 * mantida na 0018): com `exigir_medicao_recente = true` e a medição mais velha
 * que `LIMITE_DEFASAGEM_HORAS` — ou sem medição nenhuma —, o pull RECUSA 100%
 * dos disparos, antes de escrever qualquer coisa.
 *
 * Ele existe porque a rodada 7 criou um estado em que a tela CONVIDAVA para
 * uma ação que o banco recusa: o crítico mediu o card dizendo "escolhida
 * agora" e a frase do formulário dizendo "Pandora tem o maior espaço livre
 * hoje… US$ 500,00" sobre a mesma conta que, dois centímetros acima, declarava
 * "sem medição nenhuma". É a extensão de D9 ("teto atingido não convida") ao
 * estado novo — nenhuma superfície convida para o que o banco vai recusar.
 */
/**
 * P2 do Codex (PR #42): a conta está no limite de sessões em voo — o pull
 * não despacha nada dela até uma fechar. Espelho de `v_sem_vaga` em
 * `painel_fila_escolher_conta` (0030).
 */
export function semVagaEmVoo(consumo: ConsumoConta): boolean {
  const limite = consumo.limiteEmVoo ?? null;
  return limite !== null && limite > 0 && (consumo.emVoo ?? 0) >= limite;
}

export function bancoRecusaria(consumo: ConsumoConta, agora: number): boolean {
  if (consumo.exigeMedicaoRecente !== true) return false;
  const horas = horasDeDefasagem(consumo, agora);
  return horas === null || horas > LIMITE_DEFASAGEM_HORAS;
}

/**
 * MÉDIO 1 (rodada 8): o CARIMBO que acompanha toda frase de espaço livre —
 * "esse número é de quando?". Um saldo de 37 h atrás e um saldo de agora são
 * frases diferentes, e até esta rodada saíam idênticas.
 */
export function seloDaMedicao(consumo: ConsumoConta, agora: number): string {
  return textoDaMedicao(consumo, agora);
}

/**
 * D32d: o teto ao lado da realidade, numa linha. O valor do teto é decisão do
 * operador — esta função não o muda; ela só põe do lado o que os dias medidos
 * realmente custaram, que é a informação que faltava para ele escolher um teto
 * que exista.
 */
export function textoTetoVsRealidade(consumo: ConsumoConta): string | null {
  const h = consumo.historico;
  if (!h || h.dias <= 0 || h.minUsd === null || h.maxUsd === null || h.medianaUsd === null) {
    return null;
  }
  const dias = h.dias === 1 ? "no último dia medido" : `nos últimos ${h.dias} dias medidos`;
  return (
    `teto ${formatarUsd(consumo.tetoUsd)} · ${dias} o gasto ficou entre ` +
    `${formatarUsd(h.minUsd)} e ${formatarUsd(h.maxUsd)} (mediana ${formatarUsd(h.medianaUsd)})`
  );
}

// ── MÉDIO 4 (rodada 7) · de onde veio o número do custo, e se dá para mexer ───

/**
 * O crítico mediu o buraco: depois que o worker grava um número MEDIDO o botão
 * "ajustar custo" some e a tela não diz por quê — o operador fica olhando uma
 * linha sem ação e sem explicação. E havia um caso em que sumir era errado:
 * custo medido IGUAL A ZERO é o modo de falha conhecido (a sessão fechou sem
 * conseguir ler o usage). Zero não é medição; é a ausência dela com cara de
 * número, e sem porta o item fica cravado em US$ 0,00 para sempre.
 */
export type OrigemDoCusto = "estimativa" | "medido-zero" | "ajustado" | "medido";

/** O que o BANCO grava em `painel_fila_prompts.custo_origem` (migration 0018). */
export const ORIGEM_GRAVADA = ["estimativa", "medido", "operador"] as const;
export type OrigemGravada = (typeof ORIGEM_GRAVADA)[number];

export function origemGravadaValida(v: string): v is OrigemGravada {
  return (ORIGEM_GRAVADA as readonly string[]).includes(v);
}

// ── MÉDIO 3 (rodada 13) · A RÉGUA DO BANCO, LIDA PELA TELA ───────────────────
//
// Uma raiz, não três remendos. O banco aceita ou recusa uma escrita comparando
// POSTOS (D53, migration 0027 §5): um lançamento de posto menor não derruba um
// de posto maior. A tela passa a fazer a MESMA pergunta, com a MESMA régua e
// sobre o MESMO dado — o lançamento vivo da entidade, que `fila_prompts_listar`
// agora manda junto com o item (migration 0028 §2).
//
// Tudo o que a tela decide sobre dinheiro deriva daqui: se o botão de ajuste
// aparece, quanto o cancelamento lança, e qual número a célula imprime.

/** D53: o posto PADRÃO de cada origem gravada. A publicação da sessão é 40. */
export const POSTO_POR_ORIGEM: Record<OrigemGravada, number> = {
  estimativa: 10,
  operador: 20,
  medido: 30,
};

/** O posto de quem escreve pela TELA — o operador. */
export const POSTO_OPERADOR = POSTO_POR_ORIGEM.operador;
/** O posto da ESTIMATIVA DA CASA — o que um cancelamento tenta lançar. */
export const POSTO_ESTIMATIVA = POSTO_POR_ORIGEM.estimativa;

export interface LeituraDoLivro {
  /** A origem do lançamento ATIVO da entidade canônica do item. */
  origem: OrigemGravada;
  /** O posto dele (10/20/30/40) — a régua literal da D53. */
  posto: number;
  /** Quanto essa entidade pesa no livro: a contribuição REAL do item ao dia. */
  liquidoUsd: number;
}

/**
 * O que o livro diz deste item, ou `null` quando não há lançamento vivo (item
 * que nunca custou nada — e banco antigo, que não manda os campos).
 */
export function leituraDoLivro(item: ItemFilaPrompt): LeituraDoLivro | null {
  const origem = item.livroOrigem;
  if (typeof origem !== "string" || !origemGravadaValida(origem)) return null;
  const posto =
    typeof item.livroPrecedencia === "number" && Number.isFinite(item.livroPrecedencia)
      ? item.livroPrecedencia
      : POSTO_POR_ORIGEM[origem];
  const liquidoUsd =
    typeof item.livroLiquidoUsd === "number" && Number.isFinite(item.livroLiquidoUsd)
      ? item.livroLiquidoUsd
      : 0;
  return { origem, posto, liquidoUsd };
}

/**
 * O banco aceitaria uma escrita de `posto` sobre este item? Sem lançamento
 * vivo não há nada a derrubar — aceita. Com ele, vale a D53.
 */
export function livroAceita(item: ItemFilaPrompt, posto: number): boolean {
  const livro = leituraDoLivro(item);
  return livro === null || posto >= livro.posto;
}

/**
 * Quanto este item pesa no gasto de HOJE, do jeito que o livro conta. É o
 * número que a célula imprime quando ele discorda da coluna — a coluna é o que
 * o item diz de si, o livro é o que o dia cobra.
 */
export function contribuicaoNoDia(item: ItemFilaPrompt): number | null {
  const livro = leituraDoLivro(item);
  if (livro === null) return item.custoUsd;
  return livro.liquidoUsd;
}

/**
 * A frase que explica por que a tela não oferece a correção: o número que o
 * dia cobra não veio deste item, veio da sessão que o banco considera dona.
 */
export function textoLivroManda(item: ItemFilaPrompt): string | null {
  const livro = leituraDoLivro(item);
  if (livro === null || livro.posto <= POSTO_OPERADOR) return null;
  return "a sessão já publicou o número deste item — quem manda no gasto de hoje é ela";
}

/**
 * MÉDIO 4 (rodada 8): a origem vem do BANCO quando o banco a manda.
 *
 * A dedução antiga (`custoEEstimativa` + o VALOR) confundia dois números que
 * não têm nada em comum: o que a sessão mediu e o que o operador digitou. Ela
 * cravava "medido" em cima do segundo — e o ajuste virava porta de mão única
 * sobre o número que governa o teto. Pior: como olhava o VALOR, ajustar para
 * exatamente 0 reabria a porta ("medido-zero"), uma chave acidental.
 *
 * A dedução continua existindo SÓ como degradação para um banco anterior à
 * 0018 (a tela não quebra; ela perde a precisão que aquele banco não tem).
 */
export function origemDoCusto(item: ItemFilaPrompt): OrigemDoCusto | null {
  if (item.custoUsd === null) return null;
  if (item.custoOrigem !== undefined) {
    if (item.custoOrigem === "estimativa") return "estimativa";
    if (item.custoOrigem === "operador") return "ajustado";
    // `medido`: zero continua sendo o modo de falha conhecido — a sessão
    // fechou sem conseguir ler o usage. Zero não é medição.
    return item.custoUsd === 0 ? "medido-zero" : "medido";
  }
  if (item.custoEEstimativa) return "estimativa";
  if (item.custoUsd === 0) return "medido-zero";
  if (item.custoAjustadoEm !== null) return "ajustado";
  return "medido";
}

export function textoOrigemDoCusto(item: ItemFilaPrompt): string | null {
  switch (origemDoCusto(item)) {
    case "estimativa":
      return "estimativa da casa";
    case "medido-zero":
      return "a sessão fechou sem ler o gasto — dá para corrigir";
    case "ajustado":
      return "ajustado por você";
    case "medido":
      return "medido pela sessão";
    default:
      return null;
  }
}

/**
 * A frase que ENTRA NO LUGAR do botão quando o ajuste não é oferecido porque o
 * número foi medido. Só nesse caso: item de outro dia, ou item que ainda não
 * fechou, não ganham frase nenhuma (ali o botão nunca fez sentido).
 */
/**
 * MÉDIO 3 (rodada 13) · O QUE A CÉLULA DE CUSTO IMPRIME — um número só, e ele
 * é o que o DIA cobra.
 *
 * Medido pelo crítico: a célula dizia "US$ 50,00 · estimativa da casa" para um
 * item cuja contribuição real ao dia era US$ 300 — porque lia a coluna do item
 * e o dia é cobrado pelo livro. Quando os dois discordam, quem fala é o livro,
 * e a nota diz o que a casa estimava, para o número de antes não sumir sem
 * explicação.
 */
export interface CustoNaTela {
  valorUsd: number | null;
  nota: string | null;
  /** Palpite da casa ou medição que falhou — a tela marca em cor de atenção. */
  atencao: boolean;
}

export function custoNaTela(item: ItemFilaPrompt): CustoNaTela {
  const livro = leituraDoLivro(item);
  // P2 do Codex (PR #42, 2ª rodada): o livro manda sempre que tem posto acima
  // do operador — não só quando o VALOR difere. Com a condição antiga, uma
  // sessão que publicava exatamente os US$ 50 que a casa estimava deixava a
  // célula dizendo "estimativa da casa", em cor de atenção, ao lado da frase
  // "a sessão já publicou o número deste item". O "(a casa estimava …)" só
  // aparece quando há um número diferente para lembrar.
  if (livro !== null && livro.posto > POSTO_OPERADOR) {
    return {
      valorUsd: livro.liquidoUsd,
      nota:
        item.custoUsd === null || item.custoUsd === livro.liquidoUsd
          ? "medido pela sessão"
          : `medido pela sessão (a casa estimava ${formatarUsd(item.custoUsd)})`,
      atencao: false,
    };
  }
  const origem = origemDoCusto(item);
  return {
    valorUsd: item.custoUsd,
    nota: textoOrigemDoCusto(item),
    atencao: origem === "estimativa" || origem === "medido-zero",
  };
}

/**
 * MÉDIO 3 (rodada 13) · QUANTO O CANCELAMENTO DESTE ITEM LANÇA DE VERDADE.
 * Espelho de `fila_prompts_cancelar` (0027 §10), inclusive da parte que a tela
 * não via: a estimativa da casa tem posto 10 e o livro a RECUSA quando a
 * entidade já tem medição. Medido pelo crítico: a tela prometia "US$ 50,00
 * entram no gasto de hoje … dá para ajustar na linha depois" e entravam
 * US$ 0,00, sobre a única pergunta destrutiva da página.
 */
export function custoAoCancelarUsd(item: ItemFilaPrompt): number {
  const jaTeveDono = item.estado === "pega" || item.tentativas > 0;
  if (!jaTeveDono) return 0;
  if (item.custoUsd !== null) return 0;
  if (!livroAceita(item, POSTO_ESTIMATIVA)) return 0;
  return Math.min(item.custoEstimadoUsd, CUSTO_MAXIMO_POR_ITEM_USD);
}

export function textoSemAjuste(item: ItemFilaPrompt): string | null {
  // MÉDIO 4 (rodada 8): "ajustado" SAIU desta lista. O número que o operador
  // digitou continua sendo dele enquanto o dia está aberto — só o que uma
  // SESSÃO mediu é que não se reescreve pela tela.
  // MÉDIO 3 (rodada 13): o livro fala primeiro. A coluna do item pode dizer
  // `estimativa` enquanto a entidade dele já guarda a medição publicada — e
  // era exatamente aí que o botão aparecia para algo que a RPC recusa.
  const doLivro = textoLivroManda(item);
  if (doLivro !== null) return doLivro;
  return origemDoCusto(item) === "medido"
    ? "valores medidos pela sessão não são ajustados aqui"
    : null;
}

// ── D14 · o SQL manda código + números; a frase nasce aqui ───────────────────

/** Códigos devolvidos por `fila_prompts_enfileirar` (migration 0013). */
export const MOTIVOS_ENFILEIRAR = [
  "auto_maior_espaco",
  "auto_nao_cabe_hoje",
  "manual_cabe",
  "manual_nao_cabe_hoje",
  // D51 (pós-merge, CodeRabbit): a conta manual recusada por MEDIÇÃO VELHA
  // devolvia `manual_nao_cabe_hoje`, cuja frase fala de espaço livre — a tela
  // explicava falta de dinheiro onde o problema é medição parada.
  "manual_medicao_velha",
  // A4 (rodada 11): a RPC já devolvia `todas_recusadas` (migration 0025) e
  // ninguém lia. Quando TODAS as contas estão recusadas por medição velha, o
  // roteamento automático caía em `auto_nao_cabe_hoje`, cuja frase fala de
  // dinheiro — e saía se contradizendo: "nenhuma conta tem US$ 50,00 livres …
  // — a mais folgada tem US$ 500,00". O problema ali não é espaço; é medição
  // parada. Mesmo remédio de `manual_medicao_velha`, do lado automático.
  "auto_medicao_velha",
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
    case "auto_medicao_velha":
      return (
        `Enfileirado para ${conta}: nenhuma conta autoriza gasto agora — elas exigem medição de ` +
        `menos de ${LIMITE_DEFASAGEM_HORAS} h e a medição está parada. Não é falta de espaço ` +
        `(há ${formatarUsd(espaco)} livres para uma tarefa ${complexidade} de ` +
        `${formatarUsd(n.custoEstimadoUsd)})${detalheDaFila}. Entra na fila e roda quando a medição voltar.`
      );
    case "manual_medicao_velha":
      return (
        `Enfileirado para ${conta} (escolha manual): esta conta está com a medição parada há mais de ` +
        `${LIMITE_DEFASAGEM_HORAS} h, e enquanto ela não for medida de novo o disparo é recusado — ` +
        `não é falta de espaço (há ${formatarUsd(espaco)} livres para uma tarefa ${complexidade} de ` +
        `${formatarUsd(n.custoEstimadoUsd)})${detalheDaFila}. Entra na fila e roda quando a medição voltar.`
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
  // P2 do Codex (PR #42): o cancelamento de item que JÁ RODOU pode não lançar
  // nada — o item já tinha custo registrado, ou a sessão vinculada já
  // publicou a medição e o livro recusou a estimativa pelo posto (D53). O
  // banco devolve `custo_lancado_usd = 0`, e as duas frases abaixo diziam
  // "US$ 0,00 entram no gasto de hoje" e mandavam ajustar na linha — ajuste
  // que a tela, com razão, já não oferece nesse caso.
  if (codigo !== "cancelado_nunca_pego" && !(custoLancadoUsd > 0)) {
    const inicio =
      codigo === "cancelado_em_execucao"
        ? "Cancelado durante a execução."
        : `Cancelado. Ele já tinha sido pego ${tentativas === 1 ? "1 vez" : `${tentativas} vezes`}.`;
    return (
      `${inicio} Este cancelamento não soma nada ao gasto de hoje: o custo deste item já estava ` +
      `registrado (medido pela sessão ou lançado antes), e é esse número que conta.`
    );
  }
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
  /** D32a/b: horas desde a última medição desta conta; `null` = nunca mediu. */
  defasagemHoras?: number | null;
  /** D32c: a conta recusa o pull contra saldo velho (coluna do teto). */
  exigeMedicaoRecente?: boolean;
  /**
   * CRÍTICO (rodada 15): quantas sessões desta conta estão em voo agora, e o
   * limite. O headroom sozinho anunciava US$ 1,00 de espaço com 40 sessões
   * gastando dinheiro naquele instante — aritmeticamente correto, factualmente
   * falso. `limiteEmVoo` ausente ou nulo = a oração não existe, e toda frase
   * anterior à rodada 15 sai idêntica, letra por letra.
   */
  emVoo?: number;
  limiteEmVoo?: number | null;
  /**
   * CRÍTICO (rodada 15): quantos itens DISPONÍVEIS estão abaixo do piso. Sem
   * esta oração o pull dizia "nada cabe agora: o mais barato disponível custa
   * US$ 0,01 e há US$ 500,00 livres" — autocontraditório. O não é do piso, e
   * quem precisa ouvir isso é quem pode consertar a estimativa.
   */
  abaixoDoPiso?: number;
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
  const defasagem = n.defasagemHoras ?? null;
  // CRÍTICO (rodada 15): a conta está cheia de sessões, não sem dinheiro.
  const limiteEmVoo = n.limiteEmVoo ?? null;
  const noLimite = limiteEmVoo !== null && limiteEmVoo > 0 && (n.emVoo ?? 0) >= limiteEmVoo;
  const abaixoDoPiso = n.abaixoDoPiso ?? 0;

  // D32c (rodada 7): a RECUSA é a frase inteira. Não adianta listar o que
  // caberia num saldo que a casa acabou de declarar velho demais para
  // autorizar gasto. (Default `false` na coluna: nada muda até o operador ligar.)
  if (n.exigeMedicaoRecente === true && (defasagem === null || defasagem > LIMITE_DEFASAGEM_HORAS)) {
    return defasagem === null
      ? "não autorizo contra saldo nenhum: esta conta exige medição recente e nunca teve gasto medido"
      : `não autorizo contra saldo de ${Math.round(defasagem)} h atrás: esta conta exige medição recente`;
  }

  // D32b: a defasagem vem PRIMEIRO — ela qualifica todos os números seguintes.
  // Conta que NUNCA mediu nada não ganha oração aqui de propósito: os números
  // do pull dela são todos zero e a oração seria um prefixo permanente em toda
  // frase. Quem diz isso é o CARD ("sem medição nenhuma").
  if (defasagem !== null && defasagem > LIMITE_DEFASAGEM_HORAS) {
    frases.push(`atenção: o gasto medido desta conta é de ${Math.round(defasagem)} h atrás`);
  }

  // CRÍTICO 1 (rodada 12): `mortosUsd` é o que o LIVRO aceitou, não o que a
  // casa tentou lançar. Quando a sessão vinculada já publicou o número real, a
  // estimativa da morte é recusada por posto (D53) e o dia não anda — e a
  // frase diz isso, em vez de anunciar um lançamento de "US$ 0,00".
  if (n.mortos === 1 && n.mortosUsd === 0) {
    frases.push(
      "1 item morreu sem fechar neste disparo e não mudou o gasto do dia: o número real dele já estava medido",
    );
  } else if (n.mortos > 1 && n.mortosUsd === 0) {
    frases.push(
      `${n.mortos} itens morreram sem fechar neste disparo e não mudaram o gasto do dia: os números reais deles já estavam medidos`,
    );
  } else if (n.mortos === 1) {
    frases.push(
      `1 item morreu sem fechar neste disparo e lançou ${formatarUsd(n.mortosUsd)} no dia`,
    );
  } else if (n.mortos > 1) {
    frases.push(
      `${n.mortos} itens morreram sem fechar neste disparo e lançaram ${formatarUsd(n.mortosUsd)} no dia`,
    );
  }

  // CRÍTICO (rodada 15): a oração das SESSÕES EM VOO vem antes da oração do
  // item, porque quando ela aparece ela é a RAZÃO de nada ter sido pego.
  if (noLimite) {
    frases.push(
      (n.emVoo ?? 0) === 1
        ? `1 sessão desta conta está em voo (limite ${limiteEmVoo}): não despacho outra até ela fechar`
        : `${n.emVoo} sessões desta conta estão em voo (limite ${limiteEmVoo}): ` +
          "não despacho outra até uma delas fechar",
    );
  }

  // CRÍTICO (rodada 15): o item abaixo do piso tem frase própria.
  if (abaixoDoPiso === 1) {
    frases.push(
      `1 item da fila está com estimativa abaixo do piso de ${formatarUsd(CUSTO_MINIMO_POR_ITEM_USD)} ` +
        "e não entra em despacho: corrija a estimativa da complexidade dele",
    );
  } else if (abaixoDoPiso > 1) {
    frases.push(
      `${abaixoDoPiso} itens da fila estão com estimativa abaixo do piso de ` +
        `${formatarUsd(CUSTO_MINIMO_POR_ITEM_USD)} e não entram em despacho: ` +
        "corrija a estimativa da complexidade deles",
    );
  }

  if (n.custoEscolhidoUsd !== null) {
    frases.push(
      `peguei o item mais antigo que cabe: ${formatarUsd(n.custoEscolhidoUsd)} de ` +
        `${formatarUsd(n.headroomUsd)} livres`,
    );
  } else if (n.menorDisponivelUsd !== null && n.elegiveis === 0 && !noLimite) {
    // `!noLimite`: sem ele a frase saía autocontraditória — "nada cabe agora: o
    // mais barato disponível custa US$ 5,00 e há US$ 480,00 livres" — porque com
    // a conta no limite `elegiveis` é zero por CONTAGEM, não por preço.
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

  // D20: a parcela estimada é dita em voz alta — BAIXO 7 (rodada 7): exceto
  // quando ela é EXATAMENTE o dinheiro que a oração dos mortos deste disparo já
  // nomeou. Duas orações para o mesmo dinheiro só engordam a frase (o crítico
  // mediu 331 caracteres, com a repetição dentro), e essa frase vai LITERAL
  // para o relatório diário da Routine.
  const mesmoDinheiroDosMortos =
    n.mortos > 0 && n.mortos === n.estimativaItens && n.mortosUsd === n.estimativaUsd;
  if (n.estimativaUsd > 0 && !mesmoDinheiroDosMortos) {
    const itens =
      n.estimativaItens === 1
        ? "1 item que morreu sem fechar"
        : `${n.estimativaItens} itens que morreram sem fechar`;
    frases.push(`${formatarUsd(n.estimativaUsd)} do consumo de hoje são estimativa de ${itens}`);
  }

  if (frases.length === 0) return "fila vazia para esta conta";
  return frases.join("; ");
}

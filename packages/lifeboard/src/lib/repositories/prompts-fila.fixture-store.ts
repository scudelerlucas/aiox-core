/**
 * OS-LIFEBOARD · P7 — store MUTÁVEL em memória do modo fixture da fila.
 *
 * Mesmo padrão (e mesmo motivo) de `tasks.fixture-store.ts`:
 * `prompts-fila.fixture.ts` é a semente read-only; este módulo é a EXCEÇÃO que
 * muta, para `/prompts` funcionar em dev/teste sem Supabase. `globalThis` (não
 * um `let` de módulo) porque o bundler do Next pode inlinar o módulo em chunks
 * diferentes para a Server Action e para a árvore de Server Components.
 *
 * O que o fixture ESPELHA do banco:
 *  · D1 posse — `pegarFixture(conta, workerId)` grava worker/heartbeat/tentativa;
 *    `fecharFixture` só aceita de quem pegou.
 *  · D2 expiração com fim — 45 min sem sinal: volta enquanto `tentativas <
 *    maxTentativas`, depois `falhou` com o custo estimado.
 *  · D3 elegibilidade por item — o pull escolhe o mais antigo que CABE e a
 *    admissão só recusa o que nunca caberia.
 *  · D7 cancelar — aceita `na_fila` E `pega`.
 *  · D8 paginação e idempotência do fechamento.
 *
 * RODADA 4 — o que mudou aqui (D16 é a decisão que manda neste arquivo):
 *  · D16 · O CONSUMO DEIXOU DE SER CONSTANTE. Antes, `consumoHojeUsd` vinha
 *    fixo da semente e NADA que a fila fizesse o alterava — os testes de "o
 *    teto barra o pull" mexiam num número que ninguém lia. Agora o medido é
 *    `sessões publicadas + a contribuição de cada item fechado hoje`, pela
 *    MESMA regra do banco (D10/D12): `greatest(custo − custo da sessão
 *    publicada, 0)`, incluindo `cancelada` que já teve dono.
 *  · D10 · `publicarSessaoFixture` existe para o teste poder provar, em TS, a
 *    subtração que o SQL faz — publicar sem custo não abaixa nada.
 *  · D12 · cancelar item que já rodou lança o estimado; `fecharFixture` aceita
 *    item `cancelada` do próprio dono e troca só o custo.
 *  · D19 · backoff (`disponivelEm`) e a contagem de quem está de castigo.
 *  · D20 · marca de estimativa e `ajustarCustoFixture`.
 *  · D11 · `sessionId` é chave: recusa `sessionId === workerId` e sessão já
 *    usada por outro item.
 *  · D15 · paginação keyset com `(criadoEm, id)`.
 *
 * RODADA 6 — o que mudou aqui:
 *  · D25 · o dia de um item volta a ser o do FECHAMENTO (`concluidoEm`), e
 *    qualquer dia é consultável (`consumoDoDiaFixture`). D24, da rodada 5,
 *    arquivava o dinheiro num dia que nenhuma função sabia abrir.
 *  · D26 · a morte não apaga a posse: o ÚLTIMO dono fecha o item morto com o
 *    número medido (`fecharFixture` devolve `reabertoEFechado`), e
 *    `ajustarCustoFixture` aceita um `sessionId` para criar o vínculo.
 *  · D27 · o motivo é ADITIVO e vem da MESMA função pura que a tela usa
 *    (`montarMotivoDoPull`), espelho texto a texto de
 *    `public.painel_fila_motivo_do_pull` (migration 0015).
 *  · D30 · sessão vinculada que publicou CUSTO substitui a estimativa: o item
 *    contribui zero e a sessão responde por si.
 *
 * RODADA 5 — o que mudou aqui:
 *  · D21 · o pull escolhe pelo FILTRO (`custoEstimadoUsd <= headroom`, ordem
 *    `criadoEm, id`, o primeiro que sobrar), e `pulados`/`menorNaoCoube` saem
 *    de uma varredura de TODOS os que não cabem — espelho exato do `where` da
 *    RPC depois que ela deixou de iterar uma janela de 50 linhas.
 *  · D23 · o pull que MATOU um item diz isso, com o valor lançado, em vez de
 *    anunciar "fila vazia".
 *  · D24 · o dia de um item é o da RESERVA (`pegoEm`, com `criadoEm` de
 *    fallback), não o do fechamento.
 *  · #7 · `ajustarCustoFixture` recusa item cujo custo foi MEDIDO.
 *
 * O roteamento automático chama a MESMA função pura de produção
 * (`escolherConta`) — o fixture não reimplementa a regra, só o estado.
 */

import { escolherConta } from "@/core/prompts/roteador";
import { hojeNoFusoDoOperador } from "@/lib/fuso";
import type {
  Complexidade,
  Conta,
  ConsumoConta,
  EstadoFila,
  ItemFilaPrompt,
  MotivoCancelamento,
  MotivoEnfileirar,
} from "@/core/prompts/tipos";
import {
  BACKOFF_POR_TENTATIVA_MIN,
  CONTAS,
  JANELA_HEARTBEAT_MS,
  MAX_TENTATIVAS,
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  contaValida,
  custoEstimadoParaComplexidade,
  formatarUsd,
  headroomUsd,
  modeloParaComplexidade,
  montarMotivoDoPull,
  semSinal,
} from "@/core/prompts/tipos";
import { FIXTURE_CONSUMO, FIXTURE_FILA } from "@/lib/repositories/prompts-fila.fixture";

const LIMITE_PROMPT_RPC = 300;
const MINUTO_MS = 60_000;
const TETO_CUSTO_USD = 500;

export interface ResultadoEnfileirarFixture {
  ok: true;
  id: string;
  conta: Conta;
  complexidade: Complexidade;
  motivoCodigo: MotivoEnfileirar;
  cabeHoje: boolean;
  headroomUsd: number;
  espacoLivreUsd: number;
  custoEstimadoUsd: number;
  naFilaUsd: number;
  itensNaFrente: number;
}

export interface ResultadoCancelarFixture {
  ok: true;
  motivoCancelamento: MotivoCancelamento;
  custoLancadoUsd: number;
  tentativas: number;
}

export type ResultadoFilaFixture =
  | ResultadoEnfileirarFixture
  | ResultadoCancelarFixture
  | { ok: true }
  | { erro: string };

interface EstadoFilaFixture {
  fila: Map<string, ItemFilaPrompt>;
  /** Só o teto e o gasto das SESSÕES PUBLICADAS vivem aqui — o resto é derivado. */
  base: Map<Conta, { tetoUsd: number; publicadasUsd: number; medidoAteEm: string | null }>;
  /** D10: sessão publicada (`sessionId` → custo, `null` = publicada sem custo). */
  sessoesPublicadas: Map<string, number | null>;
  /**
   * D26 (rodada 6): quem pegou cada item por ÚLTIMO — o espelho da coluna
   * `ultimo_worker_id`. Mora fora de `ItemFilaPrompt` de propósito: é dado de
   * WORKER, e `ItemFilaPrompt` é o contrato que a TELA recebe da RPC de
   * listagem (que não devolve, e não precisa devolver, essa coluna).
   */
  ultimoDono: Map<string, string>;
  contador: number;
}

function estadoNovo(): EstadoFilaFixture {
  return {
    fila: new Map(FIXTURE_FILA.map((item) => [item.id, { ...item }] as const)),
    base: new Map(
      FIXTURE_CONSUMO.map(
        (c) =>
          [
            c.conta,
            { tetoUsd: c.tetoUsd, publicadasUsd: c.consumoHojeUsd, medidoAteEm: c.medidoAteEm },
          ] as const,
      ),
    ),
    sessoesPublicadas: new Map<string, number | null>(),
    ultimoDono: new Map<string, string>(),
    contador: 0,
  };
}

interface GlobalComStoreFila {
  __lifeboardFilaFixtureStore?: EstadoFilaFixture;
}

function loja(): EstadoFilaFixture {
  const g = globalThis as unknown as GlobalComStoreFila;
  if (!g.__lifeboardFilaFixtureStore) {
    g.__lifeboardFilaFixtureStore = estadoNovo();
  }
  return g.__lifeboardFilaFixtureStore;
}

/** Só para teste: devolve o store ao estado seed. */
export function resetarFilaFixtureStore(): void {
  (globalThis as unknown as GlobalComStoreFila).__lifeboardFilaFixtureStore = estadoNovo();
}

function itens(): ItemFilaPrompt[] {
  return [...loja().fila.values()];
}

/** D26: o último dono conhecido de um item (`ultimo_worker_id` no banco). */
function ultimoDonoDe(id: string): string | null {
  return loja().ultimoDono.get(id) ?? null;
}

/** Só para teste: monta o retrato de um item morto com dono conhecido. */
export function definirUltimoDonoFixture(id: string, workerId: string): void {
  loja().ultimoDono.set(id, workerId);
}

/**
 * O "dia do operador" (America/São_Paulo, UTC−3 o ano inteiro desde 2019) —
 * o espelho de `painel_dia_operador()`. Sem isto, um item fechado ontem à
 * noite contaria no teto de hoje.
 */
function diaOperador(instante: number | string): string {
  const t = typeof instante === "number" ? instante : Date.parse(instante);
  // Rodada 6: era uma subtração de 3 h feita à mão aqui. `hojeNoFusoDoOperador`
  // (src/lib/fuso.ts) é a função única do app para "que dia é este instante no
  // relógio do operador" — a mesma que a tela usa para decidir se o botão
  // "ajustar custo" aparece.
  return hojeNoFusoDoOperador(new Date(t));
}

/**
 * Quanto ESTE item pesa no dia `dia`.
 *
 * D25 (rodada 6): o dia é o do FECHAMENTO (`concluidoEm`) — o dia que
 * RECONHECE o gasto. D24 (rodada 5) usava `pegoEm` e o crítico mediu o buraco:
 * item pego 23h50 e fechado 00h10 com US$ 42 medidos sumia do dia seguinte e
 * devolvia o headroom inteiro. O item EM VOO não passa por aqui — ele pesa
 * como reserva do dia corrente (`reservadoDe`), sempre.
 *
 * D30 (rodada 6): sessão vinculada que publicou CUSTO substitui a estimativa —
 * o item contribui ZERO e a sessão responde por si. Era `greatest(custo −
 * sessão, 0)`, que fazia a estimativa virar PISO quando o real era menor (item
 * morto de 120 + sessão de 30 => 120). Sessão publicada SEM custo (21 das 215
 * reais) continua não abatendo nada.
 */
function contribuicaoDe(item: ItemFilaPrompt, dia: string): number {
  if (item.custoUsd === null || item.concluidoEm === null) return 0;
  if (diaOperador(item.concluidoEm) !== dia) return 0;
  const contaNoDia =
    item.estado === "concluida" ||
    item.estado === "falhou" ||
    (item.estado === "cancelada" &&
      (item.workerId !== null || ultimoDonoDe(item.id) !== null || item.tentativas > 0));
  if (!contaNoDia) return 0;
  if (item.sessionId === null) return item.custoUsd;
  const publicada = loja().sessoesPublicadas.get(item.sessionId);
  if (publicada === undefined || publicada === null) return item.custoUsd;
  return 0;
}

/** D16: o medido do dia MEXE — sessões publicadas + contribuição dos itens. */
function medidoDe(conta: Conta, agora: number): number {
  return consumoDoDiaFixture(conta, diaOperador(agora));
}

/**
 * D25 (rodada 6): o gasto medido de UM DIA QUALQUER — espelho de
 * `public.painel_fila_consumo_do_dia`. Existe porque "o dia que reconhece
 * paga" só é uma regra honesta se o dia anterior continuar legível.
 */
export function consumoDoDiaFixture(conta: Conta, dia: string): number {
  const base = loja().base.get(conta);
  const publicadas = base?.publicadasUsd ?? 0;
  return (
    publicadas +
    itens()
      .filter((i) => i.conta === conta)
      .reduce((soma, i) => soma + contribuicaoDe(i, dia), 0)
  );
}

/** D20: a parcela que ninguém mediu (e quantos itens a formam). */
function estimativaDe(conta: Conta, agora: number): { usd: number; itens: number } {
  const dia = diaOperador(agora);
  const lista = itens().filter(
    (i) => i.conta === conta && i.custoEEstimativa && contribuicaoDe(i, dia) > 0,
  );
  return {
    usd: lista.reduce((soma, i) => soma + contribuicaoDe(i, dia), 0),
    itens: lista.length,
  };
}

/** D19: quantos itens estão de castigo esperando nova tentativa. */
function emEsperaDe(conta: Conta, agora: number): number {
  return itens().filter(
    (i) =>
      i.conta === conta &&
      i.estado === "na_fila" &&
      i.disponivelEm !== null &&
      Date.parse(i.disponivelEm) > agora,
  ).length;
}

/** D3: reservado = SÓ o que está em execução com sinal vivo. */
function reservadoDe(conta: Conta, agora: number): number {
  return itens()
    .filter((i) => i.conta === conta && i.estado === "pega" && !semSinal(i, agora))
    .reduce((soma, i) => soma + i.custoEstimadoUsd, 0);
}

/** D3: o que espera — pesa só na ESCOLHA da conta. */
function naFilaDe(conta: Conta): number {
  return itens()
    .filter((i) => i.conta === conta && i.estado === "na_fila")
    .reduce((soma, i) => soma + i.custoEstimadoUsd, 0);
}

export function listarConsumoFixture(agora: number = Date.now()): ConsumoConta[] {
  const estado = loja();
  return CONTAS.map((conta) => {
    const base = estado.base.get(conta);
    const estimativa = estimativaDe(conta, agora);
    return {
      conta,
      tetoUsd: base?.tetoUsd ?? 150,
      consumoHojeUsd: medidoDe(conta, agora),
      reservadoUsd: reservadoDe(conta, agora),
      naFilaUsd: naFilaDe(conta),
      estimativaUsd: estimativa.usd,
      estimativaItens: estimativa.itens,
      emEspera: emEsperaDe(conta, agora),
      medidoAteEm: base?.medidoAteEm ?? null,
    };
  });
}

/** Ordem canônica da listagem: `(criadoEm desc, id desc)` — #12/D15. */
function ordenadaDesc(lista: ItemFilaPrompt[]): ItemFilaPrompt[] {
  return [...lista].sort((a, b) =>
    a.criadoEm === b.criadoEm ? b.id.localeCompare(a.id) : b.criadoEm.localeCompare(a.criadoEm),
  );
}

function antesDoCursor(item: ItemFilaPrompt, antesDe: string, antesId: string | null): boolean {
  if (item.criadoEm < antesDe) return true;
  if (item.criadoEm > antesDe) return false;
  return antesId !== null && item.id < antesId;
}

/** D15: mesma paginação KEYSET e o MESMO truncamento em 300 caracteres da RPC. */
export function listarFilaFixture(
  limite = 50,
  antesDe: string | null = null,
  antesId: string | null = null,
): ItemFilaPrompt[] {
  const elegiveis = itens().filter((i) => (antesDe === null ? true : antesDoCursor(i, antesDe, antesId)));
  return ordenadaDesc(elegiveis)
    .slice(0, Math.min(Math.max(limite, 1), 200))
    .map((i) => ({ ...i, prompt: i.prompt.slice(0, LIMITE_PROMPT_RPC) }));
}

export function filaTemMaisFixture(
  limite = 50,
  antesDe: string | null = null,
  antesId: string | null = null,
): boolean {
  const total = itens().filter((i) => (antesDe === null ? true : antesDoCursor(i, antesDe, antesId))).length;
  return total > Math.min(Math.max(limite, 1), 200);
}

/** D15: o cursor do último item da página (o que a tela põe na URL). */
export function cursorDaPaginaFixture(
  limite = 50,
  antesDe: string | null = null,
  antesId: string | null = null,
): { antesDe: string; antesId: string } | null {
  const pagina = listarFilaFixture(limite, antesDe, antesId);
  const ultimo = pagina[pagina.length - 1];
  if (!ultimo) return null;
  return { antesDe: ultimo.criadoEm, antesId: ultimo.id };
}

function novoId(): string {
  const estado = loja();
  estado.contador += 1;
  return `fila-fixture-novo-${estado.contador}`;
}

export interface EnfileirarFixtureInput {
  prompt: string;
  complexidade: Complexidade;
  /** Vem como texto solto do formulário/RPC — validado aqui, não no chamador. */
  conta?: string | null;
  criadoPor?: string | null;
  taskId?: string | null;
  agora?: number;
}

export function enfileirarFixture(input: EnfileirarFixtureInput): ResultadoFilaFixture {
  const estado = loja();
  const agora = input.agora ?? Date.now();
  const prompt = input.prompt.trim();
  if (prompt.length === 0) return { erro: "O prompt não pode ficar vazio." };
  if (prompt.length > 20000) return { erro: "O prompt passou de 20000 caracteres." };

  const custoEstimado = custoEstimadoParaComplexidade(input.complexidade);
  const consumos = listarConsumoFixture(agora);

  let conta: Conta;
  let manual: boolean;

  if (input.conta) {
    if (!contaValida(input.conta)) {
      return { erro: "conta precisa ser uma das 3 contas da casa." };
    }
    conta = input.conta;
    manual = true;
    const c = consumos.find((x) => x.conta === conta) as ConsumoConta;
    // D3: a ÚNICA recusa de admissão — o item nunca caberia nesta conta.
    if (custoEstimado > c.tetoUsd) {
      return {
        erro:
          `Uma tarefa ${ROTULO_COMPLEXIDADE[input.complexidade]} custa cerca de ${formatarUsd(custoEstimado)} ` +
          `e o teto diário da conta ${ROTULO_CONTA[conta]} é ${formatarUsd(c.tetoUsd)} — nunca vai caber.`,
      };
    }
  } else {
    const escolha = escolherConta(consumos, input.complexidade);
    if (escolha.conta === null) return { erro: escolha.motivo };
    conta = escolha.conta;
    manual = false;
  }

  const c = consumos.find((x) => x.conta === conta) as ConsumoConta;
  // D13: uma régua só — `headroom` decide `cabeHoje`; `espacoLivre` é previsão.
  const headroom = headroomUsd(c);
  const cabeHoje = custoEstimado <= headroom;
  const itensNaFrente = itens().filter((i) => i.conta === conta && i.estado === "na_fila").length;
  const motivoCodigo: MotivoEnfileirar = manual
    ? cabeHoje
      ? "manual_cabe"
      : "manual_nao_cabe_hoje"
    : cabeHoje
      ? "auto_maior_espaco"
      : "auto_nao_cabe_hoje";

  const id = novoId();
  estado.fila.set(id, {
    id,
    conta,
    prompt,
    promptTamanho: prompt.length,
    complexidade: input.complexidade,
    custoEstimadoUsd: custoEstimado,
    modeloSugerido: modeloParaComplexidade(input.complexidade),
    estado: "na_fila",
    custoUsd: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    criadoEm: new Date(agora).toISOString(),
    pegoEm: null,
    concluidoEm: null,
    disponivelEm: null,
    heartbeatEm: null,
    workerId: null,
    tentativas: 0,
    maxTentativas: MAX_TENTATIVAS,
    sessionId: null,
    motivoFalha: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: input.criadoPor ?? null,
    taskId: input.taskId ?? null,
  });

  return {
    ok: true,
    id,
    conta,
    complexidade: input.complexidade,
    motivoCodigo,
    cabeHoje,
    headroomUsd: headroom,
    espacoLivreUsd: headroom - c.naFilaUsd,
    custoEstimadoUsd: custoEstimado,
    naFilaUsd: c.naFilaUsd,
    itensNaFrente,
  };
}

/**
 * D7: cancela `na_fila` E `pega`. D12/#11 (rodada 4): quem já rodou não sai de
 * graça — o ESTIMADO entra no gasto do dia, marcado como estimativa, e o
 * código de motivo diz qual das três histórias aconteceu.
 */
export function cancelarFixture(id: string, agora: number = Date.now()): ResultadoFilaFixture {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return { erro: "Item não encontrado." };
  if (item.estado !== "na_fila" && item.estado !== "pega") {
    return { erro: "Item já fechado (concluída, falhou ou cancelada) — não dá para cancelar." };
  }

  const motivoCancelamento: MotivoCancelamento =
    item.estado === "pega"
      ? "cancelado_em_execucao"
      : item.tentativas > 0
        ? "cancelado_apos_devolucao"
        : "cancelado_nunca_pego";
  // D26: o cancelamento também é uma perda de posse — a memória fica.
  if (item.workerId !== null) estado.ultimoDono.set(id, item.workerId);
  const lanca = motivoCancelamento !== "cancelado_nunca_pego" && item.custoUsd === null;
  const custoLancadoUsd = lanca ? Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD) : 0;

  estado.fila.set(id, {
    ...item,
    estado: "cancelada",
    heartbeatEm: null,
    disponivelEm: null,
    concluidoEm: new Date(agora).toISOString(),
    custoUsd: lanca ? custoLancadoUsd : item.custoUsd,
    custoEEstimativa: lanca ? true : item.custoEEstimativa,
    motivoFalha:
      motivoCancelamento === "cancelado_em_execucao"
        ? "cancelado pelo operador durante a execução"
        : motivoCancelamento === "cancelado_apos_devolucao"
          ? `cancelado pelo operador depois de ${item.tentativas} tentativa(s)`
          : item.motivoFalha,
  });
  return { ok: true, motivoCancelamento, custoLancadoUsd, tentativas: item.tentativas };
}

/**
 * D20: o operador corrige o custo de um item `falhou`/`cancelada` fechado HOJE
 * cujo número era estimativa da casa.
 */
export function ajustarCustoFixture(
  id: string,
  custoUsd: number,
  sessionId: string | null = null,
  agora: number = Date.now(),
): ResultadoFilaFixture {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return { erro: "Item não encontrado." };
  if (custoUsd < 0 || custoUsd > TETO_CUSTO_USD) {
    return { erro: "O custo precisa ser um número entre 0 e 500." };
  }
  if (item.estado !== "falhou" && item.estado !== "cancelada") {
    return { erro: "Só dá para ajustar o custo de item que falhou ou foi cancelado." };
  }
  // D25 (rodada 6): esta é a MESMA régua de `contribuicaoDe` — o dia do
  // fechamento. Na rodada 5 as duas divergiam e o botão aceitava o ajuste sem
  // mover número nenhum ("o gasto de hoje já considera o número real" sobre um
  // dia que o consumo de hoje nem olhava).
  if (item.concluidoEm === null || diaOperador(item.concluidoEm) !== diaOperador(agora)) {
    return { erro: "Só dá para ajustar o custo de item fechado hoje." };
  }
  // #7 (rodada 5): a guarda que o comentário do SQL prometia e o código não
  // fazia — número MEDIDO por gente não se reescreve pela tela.
  if (!item.custoEEstimativa) {
    return { erro: "Só custo estimado pela casa pode ser ajustado; este foi medido." };
  }
  // D26 (rodada 6): sem o vínculo de sessão, o dia soma a estimativa do item
  // MAIS o custo real da sessão que rodou (o crítico mediu 200 num trabalho de
  // 80). A tela pode criar o vínculo aqui.
  const sess = sessionId === null || sessionId.trim().length === 0 ? null : sessionId.trim();
  if (sess !== null) {
    const outro = itens().find((i) => i.sessionId === sess && i.id !== id);
    if (outro) return { erro: "Esta sessão já está vinculada a outro item da fila." };
  }
  estado.fila.set(id, {
    ...item,
    custoUsd,
    custoEEstimativa: false,
    sessionId: sess ?? item.sessionId,
    custoAjustadoEm: new Date(agora).toISOString(),
  });
  return { ok: true };
}

/**
 * D10: registra uma sessão publicada em `painel_frentes_sessoes` (o fixture não
 * tem aquela tabela; tem este mapa). `custoUsd: null` é o caso real que o
 * crítico achou — 21 das 215 sessões publicadas não têm custo — e é justamente
 * o que NÃO pode abaixar o consumo.
 */
export function publicarSessaoFixture(
  conta: Conta,
  sessionId: string,
  custoUsd: number | null,
): void {
  const estado = loja();
  const jaPublicada = estado.sessoesPublicadas.get(sessionId);
  estado.sessoesPublicadas.set(sessionId, custoUsd);
  const base = estado.base.get(conta);
  if (!base) return;
  // A sessão publicada entra no "medido" das sessões, como a view do SQL.
  // Republicar com outro custo troca o valor, não soma duas vezes.
  const antes = jaPublicada ?? 0;
  estado.base.set(conta, {
    ...base,
    publicadasUsd: base.publicadasUsd - antes + (custoUsd ?? 0),
  });
}

// ── O worker, espelhado (D1/D2/D3/D19) — usado pelos testes, nunca pela tela ─

export interface ResultadoPegarFixture {
  item: ItemFilaPrompt | null;
  devolvidos: number;
  mortos: number;
  /** D23 (rodada 5): quanto os itens mortos NESTE pull lançaram no dia. */
  mortosUsd: number;
  /** D21 (rodada 5): quantos `na_fila` disponíveis NÃO cabem no headroom — a fila inteira, sem janela. */
  pulados: number;
  /**
   * B5 (rodada 6): itens que CABEM e estão em uso por outra transação. No
   * fixture é sempre 0 — não há locks em memória —, e é por isso que a frase
   * desse ramo se prova na função pura (`montarMotivoDoPull`) e em
   * `supabase/tests/fila_prompts.test.sql` T13, nunca aqui.
   */
  travados: number;
  /** D27: o mais barato da fila INTEIRA, backoff incluído. */
  menorCustoFilaUsd: number | null;
  /** D27: o mais barato DISPONÍVEL agora (fora do backoff). */
  menorCustoElegivelAgoraUsd: number | null;
  emEspera: number;
  /** D21: `teto − medido − em execução`, o número que decide a elegibilidade. */
  headroomUsd: number;
  estimativaUsd: number;
  estimativaItens: number;
  /** D27 (rodada 6): a frase ADITIVA, presente TAMBÉM quando um item foi pego. */
  motivo: string;
}

/**
 * Expira o que está mudo há mais de 45 min. Devolve os ids que voltaram, os que
 * morreram e — D23 (rodada 5) — quanto os mortos lançaram no gasto do dia: o
 * pull diz esse número em voz alta, em vez de anunciar "fila vazia".
 */
function expirar(
  conta: Conta,
  agora: number,
): { devolvidos: string[]; mortos: string[]; mortosUsd: number } {
  const estado = loja();
  const devolvidos: string[] = [];
  const mortos: string[] = [];
  let mortosUsd = 0;
  for (const item of itens()) {
    if (item.conta !== conta || item.estado !== "pega" || !semSinal(item, agora)) continue;
    // D26 (rodada 6): a posse vira MEMÓRIA antes de o `workerId` ser zerado.
    if (item.workerId !== null) estado.ultimoDono.set(item.id, item.workerId);
    if (item.tentativas < item.maxTentativas) {
      estado.fila.set(item.id, {
        ...item,
        estado: "na_fila",
        workerId: null,
        pegoEm: null,
        heartbeatEm: null,
        // D19: castigo de 15 min × tentativas antes de voltar a ser elegível.
        disponivelEm: new Date(
          agora + BACKOFF_POR_TENTATIVA_MIN * Math.max(item.tentativas, 1) * MINUTO_MS,
        ).toISOString(),
      });
      devolvidos.push(item.id);
    } else {
      estado.fila.set(item.id, {
        ...item,
        estado: "falhou",
        workerId: null,
        heartbeatEm: null,
        motivoFalha: `expirou ${item.tentativas} vezes sem fechamento`,
        // Conservador: quem sumiu provavelmente gastou. D20: marcado como estimativa.
        custoUsd: Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD),
        custoEEstimativa: true,
        concluidoEm: new Date(agora).toISOString(),
      });
      mortos.push(item.id);
      mortosUsd += Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD);
    }
  }
  return { devolvidos, mortos, mortosUsd };
}

export function pegarFixture(
  conta: Conta,
  workerId: string,
  agora: number = Date.now(),
): ResultadoPegarFixture {
  const estado = loja();
  const { devolvidos, mortos, mortosUsd } = expirar(conta, agora);

  const base = estado.base.get(conta);
  const teto = base?.tetoUsd ?? 150;
  const medido = medidoDe(conta, agora);
  const emExecucao = reservadoDe(conta, agora);
  const emEspera = emEsperaDe(conta, agora);
  const estimativa = estimativaDe(conta, agora);
  // D13/D21: uma régua só, e é ela que entra no filtro — nunca um teste dentro
  // de um laço sobre uma janela.
  const headroom = teto - medido - emExecucao;

  const disponiveis = itens().filter(
    (i) =>
      i.conta === conta &&
      i.estado === "na_fila" &&
      !devolvidos.includes(i.id) &&
      (i.disponivelEm === null || Date.parse(i.disponivelEm) <= agora),
  );

  /**
   * D21 (rodada 5) — o espelho exato do `where` da RPC:
   *   `… and custo_estimado_usd <= headroom order by criado_em, id limit 1`.
   * O laço com janela de 50 do SQL escondia o item elegível da posição 51 e
   * ainda mentia sobre ele ("o mais barato custa US$ 120" com um de US$ 5 na
   * fila). Aqui a escolha é sobre a lista INTEIRA, e `pulados`/`menorNaoCoube`
   * saem de uma varredura separada de TODOS os que não cabem.
   */
  const ordenados = [...disponiveis].sort((a, b) =>
    // #12: desempate explícito por id, como no `order by criado_em, id` do SQL.
    a.criadoEm === b.criadoEm ? a.id.localeCompare(b.id) : a.criadoEm.localeCompare(b.criadoEm),
  );
  const escolhido = ordenados.find((i) => i.custoEstimadoUsd <= headroom) ?? null;
  const naoCabem = disponiveis.filter((i) => i.custoEstimadoUsd > headroom);
  const pulados = naoCabem.length;
  const menorDisponivel =
    disponiveis.length === 0 ? null : Math.min(...disponiveis.map((i) => i.custoEstimadoUsd));
  const naFilaToda = itens().filter((i) => i.conta === conta && i.estado === "na_fila");
  const menorCustoFilaUsd =
    naFilaToda.length === 0 ? null : Math.min(...naFilaToda.map((i) => i.custoEstimadoUsd));
  const emBackoff = naFilaToda.filter(
    (i) => i.disponivelEm !== null && Date.parse(i.disponivelEm) > agora,
  );
  const menorEmEsperaUsd =
    emBackoff.length === 0 ? null : Math.min(...emBackoff.map((i) => i.custoEstimadoUsd));
  const voltaEmMin =
    emBackoff.length === 0
      ? null
      : Math.max(
          1,
          Math.ceil(
            (Math.min(...emBackoff.map((i) => Date.parse(i.disponivelEm as string))) - agora) /
              MINUTO_MS,
          ),
        );

  // D27 (rodada 6): a MESMA função pura que o SQL usa — nenhuma frase nasce
  // duas vezes. `travados` é sempre 0 aqui (não há lock em memória).
  const motivo = montarMotivoDoPull({
    mortos: mortos.length,
    mortosUsd,
    custoEscolhidoUsd: escolhido === null ? null : escolhido.custoEstimadoUsd,
    headroomUsd: headroom,
    menorDisponivelUsd: menorDisponivel,
    elegiveis: disponiveis.length - pulados,
    emEspera,
    menorEmEsperaUsd,
    voltaEmMin,
    devolvidos: devolvidos.length,
    travados: 0,
    estimativaUsd: estimativa.usd,
    estimativaItens: estimativa.itens,
  });

  const comum = {
    devolvidos: devolvidos.length,
    mortos: mortos.length,
    mortosUsd,
    pulados,
    travados: 0,
    menorCustoFilaUsd,
    menorCustoElegivelAgoraUsd: menorDisponivel,
    emEspera,
    headroomUsd: headroom,
    estimativaUsd: estimativa.usd,
    estimativaItens: estimativa.itens,
    motivo,
  };

  if (escolhido !== null) {
    const pego: ItemFilaPrompt = {
      ...escolhido,
      estado: "pega",
      workerId,
      pegoEm: new Date(agora).toISOString(),
      heartbeatEm: new Date(agora).toISOString(),
      disponivelEm: null,
      tentativas: escolhido.tentativas + 1,
    };
    estado.fila.set(pego.id, pego);
    estado.ultimoDono.set(pego.id, workerId);
    return { item: pego, ...comum };
  }

  return { item: null, ...comum };
}

export type ResultadoHeartbeatFixture =
  | { ok: true; expiraEm: string }
  | { ok: false; motivo: string }
  | { erro: string };

export function heartbeatFixture(
  id: string,
  conta: Conta,
  workerId: string,
  sessionId: string | null = null,
  agora: number = Date.now(),
): ResultadoHeartbeatFixture {
  const estado = loja();
  // D11: os dois ids vêm do mesmo bloco do doc do worker — confundi-los fazia
  // o abatimento de D10 procurar uma sessão que nunca seria publicada.
  if (sessionId !== null && sessionId === workerId) {
    return { erro: "session_id é o id da sessão FILHA, não o da Routine" };
  }
  const item = estado.fila.get(id);
  if (!item || item.conta !== conta) return { ok: false, motivo: "inexistente" };
  if (item.estado === "cancelada") return { ok: false, motivo: "cancelado" };
  if (item.workerId !== workerId) return { ok: false, motivo: "outro worker" };
  if (item.estado !== "pega") return { ok: false, motivo: `item esta ${item.estado}` };
  if (sessionId !== null) {
    const outro = itens().find((i) => i.sessionId === sessionId && i.id !== id);
    if (outro) return { erro: `sessão já vinculada ao item ${outro.id}` };
  }
  estado.fila.set(id, {
    ...item,
    heartbeatEm: new Date(agora).toISOString(),
    sessionId: sessionId ?? item.sessionId,
  });
  return { ok: true, expiraEm: new Date(agora + JANELA_HEARTBEAT_MS).toISOString() };
}

export type ResultadoFecharFixture =
  | { ok: true; jaFechado: boolean; reabertoEFechado: boolean; estado: EstadoFila }
  | { erro: string };

export function fecharFixture(input: {
  id: string;
  conta: Conta;
  workerId: string;
  estado: Extract<EstadoFila, "concluida" | "falhou">;
  custoUsd: number;
  sessionId?: string | null;
  agora?: number;
}): ResultadoFecharFixture {
  const loja_ = loja();
  const item = loja_.fila.get(input.id);
  if (!item || item.conta !== input.conta) {
    return { erro: "Item não encontrado ou não pertence à conta informada." };
  }
  if (input.custoUsd < 0 || input.custoUsd > TETO_CUSTO_USD) {
    return { erro: "custo_usd fora da faixa aceita (0 a 500)." };
  }
  const sessionId = input.sessionId ?? null;
  if (sessionId !== null && sessionId === input.workerId) {
    return { erro: "session_id é o id da sessão FILHA, não o da Routine" };
  }
  // D26 (rodada 6): a morte tira a posse VIVA para liberar a fila, não para
  // proibir o único ator com o número honesto de entregá-lo. Quem PEGOU o item
  // e já não o tem atravessa o fencing; o subconjunto que ainda vale reescrever
  // é o item MORTO cujo custo é estimativa da casa.
  const ultimoDono =
    item.workerId === null && ultimoDonoDe(item.id) === input.workerId && input.workerId.length > 0;
  const reabrir = item.estado === "falhou" && ultimoDono && item.custoEEstimativa;

  if (item.estado === "na_fila" && item.workerId === null) {
    return { erro: "Item voltou para a fila (45 min sem sinal) — não pode ser fechado." };
  }
  if (!ultimoDono && item.workerId !== input.workerId) {
    return { erro: `Item pertence a outro worker (${item.workerId ?? "nenhum"}).` };
  }
  if (sessionId !== null) {
    const outro = itens().find((i) => i.sessionId === sessionId && i.id !== item.id);
    if (outro) return { erro: `sessão já vinculada ao item ${outro.id}` };
  }
  const agora = input.agora ?? Date.now();
  if (reabrir) {
    loja_.fila.set(item.id, {
      ...item,
      estado: input.estado,
      custoUsd: input.custoUsd,
      custoEEstimativa: false,
      sessionId: sessionId ?? item.sessionId,
      heartbeatEm: null,
      disponivelEm: null,
      motivoFalha: input.estado === "falhou" ? item.motivoFalha : null,
      // D25: o dinheiro entra no dia que o RECONHECE.
      concluidoEm: new Date(agora).toISOString(),
    });
    return { ok: true, jaFechado: false, reabertoEFechado: true, estado: input.estado };
  }
  // D8: refechar o que este mesmo worker já fechou não é erro.
  if (item.estado === "concluida" || item.estado === "falhou") {
    return { ok: true, jaFechado: true, reabertoEFechado: false, estado: item.estado };
  }
  // D12: item cancelado pelo operador — a medição real SUBSTITUI a estimativa,
  // mas a decisão do operador não é revogada (o estado continua `cancelada`).
  if (item.estado === "cancelada") {
    loja_.fila.set(item.id, {
      ...item,
      custoUsd: input.custoUsd,
      custoEEstimativa: false,
      sessionId: sessionId ?? item.sessionId,
      concluidoEm: item.concluidoEm ?? new Date(agora).toISOString(),
    });
    return { ok: true, jaFechado: false, reabertoEFechado: false, estado: "cancelada" };
  }
  loja_.fila.set(item.id, {
    ...item,
    estado: input.estado,
    custoUsd: input.custoUsd,
    custoEEstimativa: false,
    sessionId: sessionId ?? item.sessionId,
    heartbeatEm: null,
    disponivelEm: null,
    concluidoEm: new Date(agora).toISOString(),
  });
  return { ok: true, jaFechado: false, reabertoEFechado: false, estado: input.estado };
}

/** Só para teste: muda o teto diário de uma conta (o de produção é 150 nas 3). */
export function ajustarTetoFixture(conta: Conta, tetoUsd: number): void {
  const estado = loja();
  const base = estado.base.get(conta);
  if (!base) return;
  estado.base.set(conta, { ...base, tetoUsd });
}

/** Só para teste: envelhece o último sinal de um item (simula worker mudo). */
export function envelhecerSinalFixture(id: string, minutos: number, agora = Date.now()): void {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return;
  estado.fila.set(id, { ...item, heartbeatEm: new Date(agora - minutos * MINUTO_MS).toISOString() });
}

/**
 * Só para teste: reescreve os campos de tempo/estado de um item — o equivalente
 * ao `insert` direto que os blocos SQL de prova usam para montar um retrato
 * (item pego 23h50 e fechado 00h10, item `falhou` com custo MEDIDO). Nenhum
 * caminho de produção chama isto.
 */
export function definirTemposFixture(
  id: string,
  patch: Partial<
    Pick<
      ItemFilaPrompt,
      | "estado"
      | "custoUsd"
      | "custoEEstimativa"
      | "pegoEm"
      | "concluidoEm"
      | "heartbeatEm"
      | "workerId"
      | "sessionId"
      | "tentativas"
    >
  >,
): void {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return;
  estado.fila.set(id, { ...item, ...patch });
}

/** Só para teste: encerra o castigo de um item devolvido (D19). */
export function vencerBackoffFixture(id: string, agora = Date.now()): void {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return;
  estado.fila.set(id, { ...item, disponivelEm: new Date(agora - 1000).toISOString() });
}

export { JANELA_HEARTBEAT_MS };

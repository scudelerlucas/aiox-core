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
  HistoricoMedido,
  ItemFilaPrompt,
  MotivoCancelamento,
  MotivoEnfileirar,
} from "@/core/prompts/tipos";
import {
  BACKOFF_POR_TENTATIVA_MIN,
  CONTAS,
  CUSTO_MAXIMO_POR_ITEM_USD,
  CUSTO_MINIMO_POR_ITEM_USD,
  JANELA_HEARTBEAT_MS,
  MAXIMO_EM_VOO_POR_CONTA,
  MAX_TENTATIVAS,
  POSTO_ESTIMATIVA,
  POSTO_OPERADOR,
  POSTO_POR_ORIGEM,
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  TETO_DIARIO_PADRAO_USD,
  bancoRecusaria,
  contaValida,
  custoEstimadoParaComplexidade,
  formatarUsd,
  headroomUsd,
  modeloParaComplexidade,
  montarMotivoDoPull,
  origemDoCusto,
  semSinal,
  semVagaEmVoo,
} from "@/core/prompts/tipos";
import { FIXTURE_CONSUMO, FIXTURE_FILA } from "@/lib/repositories/prompts-fila.fixture";

const LIMITE_PROMPT_RPC = 300;
const MINUTO_MS = 60_000;
/**
 * ALTO 2 (rodada 13): era 500 — o MESMO número do teto do dia, e por isso a
 * porta de fechamento recusava a medição real de uma sessão que custou mais
 * que o teto. Agora é o limite de SANIDADE por item, espelho de
 *  (0027 §0). Quem barra despacho é o
 * pull, não a porta que registra o que já aconteceu.
 */
const TETO_CUSTO_USD = CUSTO_MAXIMO_POR_ITEM_USD;

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
  /** P2 do Codex (PR #42, 23ª e 24ª rodadas): espelho de `sem_vaga` (manual) e `todas_sem_vaga` (automático). */
  esperaVaga: boolean;
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
  base: Map<
    Conta,
    {
      tetoUsd: number;
      publicadasUsd: number;
      medidoAteEm: string | null;
      /** D32a (rodada 7): quão velho é o número medido desta conta. */
      defasagemHoras: number | null;
      exigeMedicaoRecente: boolean;
      /** D32d: a faixa real dos últimos dias medidos, ao lado do teto. */
      historico: HistoricoMedido | null;
    }
  >;
  /**
   * D10: sessão publicada (`sessionId` → custo, `null` = publicada sem custo).
   * D34a (rodada 8): guarda também a CONTA dona — é o espelho de
   * `public.painel_sessao_dona`, e sem ele o fixture não consegue recusar a
   * sessão de OUTRA conta (a porta que fazia o mesmo dinheiro existir duas vezes).
   */
  sessoesPublicadas: Map<string, { conta: Conta; custoUsd: number | null }>;
  /**
   * D26 (rodada 6): quem pegou cada item por ÚLTIMO — o espelho da coluna
   * `ultimo_worker_id`. Mora fora de `ItemFilaPrompt` de propósito: é dado de
   * WORKER, e `ItemFilaPrompt` é o contrato que a TELA recebe da RPC de
   * listagem (que não devolve, e não precisa devolver, essa coluna).
   */
  ultimoDono: Map<string, string>;
  /**
   * P2 do Codex (PR #42, 10ª rodada): espelho de `parada_pendente_desde` — o
   * último sinal de vida (ms) de um item cancelado DURANTE a execução cujo
   * dono ainda não confirmou a parada fechando o item. Enquanto estiver na janela, o item
   * ocupa vaga em `emVooDe`. Fora de `ItemFilaPrompt` pelo mesmo motivo de
   * `ultimoDono`: é dado de worker, não da tela.
   */
  paradaPendente: Map<string, number>;
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
            {
              tetoUsd: c.tetoUsd,
              publicadasUsd: c.consumoHojeUsd,
              medidoAteEm: c.medidoAteEm,
              defasagemHoras: c.defasagemHoras ?? null,
              exigeMedicaoRecente: c.exigeMedicaoRecente === true,
              historico: c.historico ?? null,
            },
          ] as const,
      ),
    ),
    sessoesPublicadas: new Map<string, { conta: Conta; custoUsd: number | null }>(),
    ultimoDono: new Map<string, string>(),
    paradaPendente: new Map<string, number>(),
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

/**
 * D34a (rodada 8): a conta dona de uma sessão publicada — espelho de
 * `public.painel_sessao_dona`. `null` = sessão ainda não publicada, que é o
 * caso normal no heartbeat (a filha acabou de nascer) e passa.
 */
function donaDaSessao(sessionId: string): Conta | null {
  return loja().sessoesPublicadas.get(sessionId)?.conta ?? null;
}

/** MÉDIO 4 (rodada 8): a recusa de vínculo, em português, nas três portas. */
function recusaDeContaDaSessao(sessionId: string, contaDoItem: Conta): string | null {
  const dona = donaDaSessao(sessionId);
  if (dona === null || dona === contaDoItem) return null;
  return `Esta sessão é da conta ${dona} — não dá para vinculá-la a um item da conta ${contaDoItem}.`;
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
  // D34b (rodada 8): a dedup casa por IDENTIDADE DA SESSÃO — a conta dela não
  // entra na chave. Era a comparação de conta, no `left join lateral` do SQL,
  // que deixava o mesmo trabalho ser cobrado em duas contas.
  const publicada = loja().sessoesPublicadas.get(item.sessionId);
  if (publicada === undefined || publicada.custoUsd === null) return item.custoUsd;
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
/**
 * CRÍTICO (rodada 15): a MESMA definição de `reservadoDe` — item `pega` com
 * sinal vivo —, contada em vez de somada. Espelho de `painel_fila_em_voo`.
 * P2 do Codex (PR #42, 10ª rodada): mais o item cancelado cujo dono ainda
 * não confirmou a parada — a sessão filha pode estar rodando. A reserva de
 * dinheiro não ganha este ramo: o cancelamento já lançou a estimativa.
 */
function emVooDe(conta: Conta, agora: number): number {
  const pendentes = loja().paradaPendente;
  return itens().filter(
    (i) =>
      i.conta === conta &&
      ((i.estado === "pega" && !semSinal(i, agora)) ||
        (i.estado === "cancelada" &&
          pendentes.has(i.id) &&
          agora - (pendentes.get(i.id) as number) <= JANELA_HEARTBEAT_MS)),
  ).length;
}

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
      tetoUsd: base?.tetoUsd ?? TETO_DIARIO_PADRAO_USD,
      consumoHojeUsd: medidoDe(conta, agora),
      reservadoUsd: reservadoDe(conta, agora),
      naFilaUsd: naFilaDe(conta),
      estimativaUsd: estimativa.usd,
      estimativaItens: estimativa.itens,
      emEspera: emEsperaDe(conta, agora),
      medidoAteEm: base?.medidoAteEm ?? null,
      defasagemHoras: base?.defasagemHoras ?? null,
      exigeMedicaoRecente: base?.exigeMedicaoRecente === true,
      historico: base?.historico ?? null,
      // P2 do Codex (PR #42): o mesmo par que a RPC manda — a escolha de
      // conta passa a conhecer o limite de sessões em voo.
      emVoo: emVooDe(conta, agora),
      limiteEmVoo: MAXIMO_EM_VOO_POR_CONTA,
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

/**
 * MÉDIO 3 (rodada 13) · O ESPELHO DO LIVRO, no fixture.
 *
 * A RPC `fila_prompts_listar` passou a mandar, por item, a origem e o POSTO do
 * lançamento ATIVO da entidade canônica dele (migration 0028 §2) — é isso que
 * a tela usa para não oferecer o que o banco recusa. O fixture não tem
 * livro-razão; tem `sessoesPublicadas`, que é o mesmo fato em outra forma:
 * sessão vinculada que publicou custo É o lançamento vivo, com posto 40 (a
 * medição publicada pela rotina da conta). Sem sessão publicada, quem responde
 * é a coluna do próprio item.
 *
 * Espelhar é obrigação, não conveniência: o modo fixture é o que entra em
 * screenshot e o que o Chromium mede.
 */
function livroDoItemFixture(item: ItemFilaPrompt): Pick<
  ItemFilaPrompt,
  "livroOrigem" | "livroPrecedencia" | "livroLiquidoUsd"
> {
  if (item.sessionId !== null) {
    const publicada = loja().sessoesPublicadas.get(item.sessionId);
    if (publicada !== undefined && publicada.custoUsd !== null && publicada.custoUsd !== 0) {
      return { livroOrigem: "medido", livroPrecedencia: 40, livroLiquidoUsd: publicada.custoUsd };
    }
  }
  // D40: zero é AUSÊNCIA de medição — o banco não grava lançamento para ele
  // (`painel_caixa_lancar` sai cedo com alvo 0), e a listagem manda o livro
  // vazio. Tratar zero como lançamento dava posto 30 a um "medido-zero" e
  // sumia com o botão de ajuste que o SQL oferece (Minor do CodeRabbit, PR #42).
  if (item.custoUsd === null || item.custoUsd === 0) {
    return { livroOrigem: null, livroPrecedencia: null, livroLiquidoUsd: null };
  }
  const origem = item.custoOrigem ?? (item.custoEEstimativa ? "estimativa" : "medido");
  return {
    livroOrigem: origem,
    livroPrecedencia: POSTO_POR_ORIGEM[origem],
    livroLiquidoUsd: item.custoUsd,
  };
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
    .map((i) => ({
      ...i,
      ...livroDoItemFixture(i),
      prompt: i.prompt.slice(0, LIMITE_PROMPT_RPC),
    }));
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
  /**
   * A2 (rodada 11): O VEREDITO DO ROTEADOR, que era jogado fora.
   * `escolherConta` devolve `cabeHoje` já contando a recusa por medição velha
   * (D36) — e este arquivo o descartava para recalcular `cabeHoje` por conta
   * própria, com outra régua. Medido: com as três contas travadas por medição
   * velha, o roteador dizia `cabeHoje:false` e a loja respondia
   * `auto_maior_espaco` + `cabeHoje:true`. O SQL faz o contrário — quando a
   * conta veio do chooser, o veredito é o DELE (migration 0025 §2).
   */
  let autoCabeHoje = false;
  let autoTodasRecusadas = false;
  let autoPuladasSemVaga = 0;
  let autoTodasSemVaga = false;

  if (input.conta) {
    if (!contaValida(input.conta)) {
      // Varredura de generalização (rodada 14): a frase dizia "3 contas" desde
      // que a casa tinha 3, e a casa tem 4 desde 21/09 — número de contas em
      // texto literal é a mesma cópia à mão que a 0029 §1 tirou do SQL. Agora
      // ele vem de `CONTAS`, como a validação que o produziu.
      return { erro: `conta precisa ser uma das ${CONTAS.length} contas da casa.` };
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
    // B2 (rodada 11): `agora` é parâmetro desta função e não chegava a decisão
    // de tempo nenhuma — o roteador caía no default `Date.now()`, e um teste
    // que finge o relógio media outra coisa do que pediu.
    const escolha = escolherConta(consumos, input.complexidade, agora);
    if (escolha.conta === null) return { erro: escolha.motivo };
    conta = escolha.conta;
    manual = false;
    autoCabeHoje = escolha.cabeHoje;
    autoTodasRecusadas = escolha.todasRecusadas;
    autoPuladasSemVaga = escolha.puladasSemVaga;
    autoTodasSemVaga = escolha.todasSemVaga;
  }

  const c = consumos.find((x) => x.conta === conta) as ConsumoConta;
  const headroom = headroomUsd(c);
  /**
   * A1 (rodada 11) · A MESMA RÉGUA DOS DOIS LADOS.
   * Aqui era `custoEstimado <= headroom` — o headroom CRU, sem descontar a
   * fila parada. O SQL decide por ESPAÇO LIVRE (`v_espaco := v_headroom -
   * v_na_fila`, migration 0025 §2; e o veredito do chooser em 0019 §15).
   * Medido no navegador com as duas réguas convivendo: a tela dizia
   * "cabe hoje contando a fila parada — US$ 0,00 livres", uma frase que se
   * contradiz sozinha. D29 já tinha mandado o NÚMERO da frase ser o espaço
   * livre; faltava o VEREDITO vir do mesmo lugar.
   */
  const espacoLivre = headroom - c.naFilaUsd;
  const cabeNoEspaco = custoEstimado <= espacoLivre;
  const itensNaFrente = itens().filter((i) => i.conta === conta && i.estado === "na_fila").length;
  // D46 + D51 (pós-merge): a escolha MANUAL passa pela mesma trava de medição
  // que `fila_prompts_pegar_interno` aplica, e a recusa por medição velha tem
  // código próprio — `manual_nao_cabe_hoje` fala de espaço livre, e o problema
  // aqui não é dinheiro. Espelho de `fila_prompts_enfileirar` (migration 0025).
  // B2 (rodada 11): `agora`, nunca `Date.now()` — ver o comentário acima.
  const recusaPorMedicao = manual && bancoRecusaria(c, agora);
  const manualCabe = cabeNoEspaco && !recusaPorMedicao;
  // A2: no automático quem vereditou foi o ROTEADOR (ele já conta D36).
  const cabeHoje = manual ? manualCabe : autoCabeHoje;
  // P2 do Codex (PR #42, 8ª rodada): conta escolhida à mão no limite de voo.
  const manualSemVaga = manual && !recusaPorMedicao && semVagaEmVoo(c);
  const motivoCodigo: MotivoEnfileirar = manual
    ? manualSemVaga
      ? "manual_sem_vaga"
      : manualCabe
      ? "manual_cabe"
      : recusaPorMedicao
        ? "manual_medicao_velha"
        : "manual_nao_cabe_hoje"
    : // P2 do Codex (PR #42, 7ª rodada): TODAS as contas no limite de voo.
      autoTodasSemVaga && !autoTodasRecusadas
      ? "auto_sem_vaga"
      : autoCabeHoje
      ? autoPuladasSemVaga > 0
        ? "auto_maior_espaco_com_vaga"
        : "auto_maior_espaco"
      : // A4 (rodada 11): quando NENHUMA conta autoriza gasto, o problema não é
        // dinheiro — e `auto_nao_cabe_hoje` só sabe falar de dinheiro. Mesmo
        // remédio que `manual_medicao_velha` recebeu do outro lado.
        autoTodasRecusadas
        ? "auto_medicao_velha"
        : autoPuladasSemVaga > 0
          ? "auto_nao_cabe_hoje_com_vaga"
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
    // D46: a trava de medição também derruba o `cabe_hoje` da escolha manual —
    // o SQL faz `v_cabe_hoje := false` no mesmo caso.
    cabeHoje,
    headroomUsd: headroom,
    espacoLivreUsd: espacoLivre,
    custoEstimadoUsd: custoEstimado,
    naFilaUsd: c.naFilaUsd,
    itensNaFrente,
    esperaVaga: manual ? semVagaEmVoo(c) : autoTodasSemVaga,
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
  // P2 do Codex (PR #42, 10ª rodada): a vaga fica ocupada até o dono fechar
  // o item — espelho do gatilho `painel_fila_marca_parada_pendente` (0030 §1e').
  if (item.estado === "pega") {
    const ultimoSinal = Date.parse(item.heartbeatEm ?? item.pegoEm ?? "");
    if (!Number.isNaN(ultimoSinal)) estado.paradaPendente.set(id, ultimoSinal);
  }
  // MÉDIO 3 (rodada 13): o livro RECUSA a estimativa da casa (posto 10) quando
  // a entidade do item já guarda medição publicada (posto 40) — é o que
  // `fila_prompts_cancelar` devolve como `custo_lancado_usd = 0` com
  // `recusado_por_precedencia = true`. Sem isto o fixture continuava lançando
  // US$ 50 sobre um item cuja sessão já tinha publicado US$ 300.
  const livro = livroDoItemFixture(item);
  const livroAceitaEstimativa =
    livro.livroPrecedencia === null || livro.livroPrecedencia === undefined
      ? true
      : POSTO_ESTIMATIVA >= livro.livroPrecedencia;
  const lanca =
    motivoCancelamento !== "cancelado_nunca_pego" && item.custoUsd === null && livroAceitaEstimativa;
  const custoLancadoUsd = lanca ? Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD) : 0;

  estado.fila.set(id, {
    ...item,
    estado: "cancelada",
    heartbeatEm: null,
    disponivelEm: null,
    concluidoEm: new Date(agora).toISOString(),
    custoUsd: lanca ? custoLancadoUsd : item.custoUsd,
    custoEEstimativa: lanca ? true : item.custoEEstimativa,
    custoOrigem: lanca ? "estimativa" : item.custoOrigem,
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
    return { erro: `O custo precisa ser um número entre 0 e ${TETO_CUSTO_USD}.` };
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
  // MÉDIO 4 (rodada 8): a guarda olha a ORIGEM, não o VALOR — o mesmo que
  // `fila_prompts_ajustar_custo` faz no banco. Número que o OPERADOR digitou
  // continua sendo dele enquanto o dia está aberto (era porta de mão única: o
  // segundo ajuste era recusado com "este foi medido", culpando uma sessão que
  // nunca reportou nada). Medido igual a ZERO segue ajustável — é a sessão que
  // fechou sem conseguir ler o usage —, e por a guarda estar na origem, ajustar
  // para 0 deixou de ser a porta dos fundos que reabria tudo.
  const origem = origemDoCusto(item);
  if (origem === "medido") {
    return { erro: "Este custo foi medido pela sessão — não dá para corrigi-lo aqui." };
  }
  // D26 (rodada 6): sem o vínculo de sessão, o dia soma a estimativa do item
  // MAIS o custo real da sessão que rodou (o crítico mediu 200 num trabalho de
  // 80). A tela pode criar o vínculo aqui.
  const sess = sessionId === null || sessionId.trim().length === 0 ? null : sessionId.trim();
  if (sess !== null) {
    const outro = itens().find((i) => i.sessionId === sess && i.id !== id);
    if (outro) return { erro: "Esta sessão já está vinculada a outro item da fila." };
    const recusa = recusaDeContaDaSessao(sess, item.conta);
    if (recusa) return { erro: recusa };
  }
  // MÉDIO 3 (rodada 13): a MESMA guarda, olhando o LIVRO. A coluna do item
  // pode dizer `estimativa` enquanto a entidade dele já guarda a medição
  // publicada pela sessão — e é essa a recusa que o banco devolve
  // (`fila_prompts_ajustar_custo`, 0027 §10). P2 do Codex (PR #42, 3ª rodada):
  // como no banco, confere a entidade ATUAL e a da sessão PROPOSTA, depois das
  // checagens da sessão (outro item, outra conta) para elas manterem o motivo.
  const postosDoAjuste = [
    livroDoItemFixture(item),
    livroDoItemFixture({ ...item, sessionId: sess ?? item.sessionId }),
  ]
    .map((l) => l.livroPrecedencia)
    .filter((p): p is number => typeof p === "number");
  if (postosDoAjuste.some((posto) => POSTO_OPERADOR < posto)) {
    return { erro: "Este custo já foi medido pela sessão — não dá para corrigi-lo aqui." };
  }
  estado.fila.set(id, {
    ...item,
    custoUsd,
    custoEEstimativa: false,
    custoOrigem: "operador",
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
  agora: number = Date.now(),
): void {
  const estado = loja();
  const jaPublicada = estado.sessoesPublicadas.get(sessionId);
  // [Minor do CodeRabbit, rodada 10] A SESSÃO NÃO TROCA DE CONTA. Republicar
  // numa conta diferente descontava o custo antigo da conta NOVA e deixava o
  // valor preso na antiga — `publicadasUsd` saía inconsistente, e podia ficar
  // negativo. É a mesma lei que o D39 do livro-razão aplica no banco: a conta
  // é fixada no primeiro lançamento da entidade e ninguém remaneja. Hoje só
  // testes chamam esta função e todos reusam a mesma conta, então o alcance é
  // o setup de fixture — mas o espelho tem de espelhar.
  if (jaPublicada !== undefined && jaPublicada.conta !== conta) return;
  // P2 do Codex (PR #42, 6ª rodada): republicar com custo nulo ou zero NÃO
  // apaga a medição anterior. No banco, o gatilho `painel_frentes_sessoes_lancar`
  // trata zero/nulo como AUSÊNCIA de medição (D40) e não toca no livro — o
  // último número diferente de zero continua sendo o lançamento de posto 40.
  // O fixture sobrescrevia o mapa, esquecia o 40 e deixava cancelar/ajustar
  // passarem onde o banco recusa.
  const semMedicao = custoUsd === null || custoUsd === 0;
  if (semMedicao && jaPublicada !== undefined && jaPublicada.custoUsd !== null && jaPublicada.custoUsd !== 0) {
    return;
  }
  // P2 do Codex (PR #42, 17ª rodada): fora da faixa de sanidade não é medição
  // — espelho da guarda de `painel_frentes_sessoes_lancar` (0027 §7b).
  if (custoUsd !== null && (custoUsd < 0 || custoUsd > TETO_CUSTO_USD)) return;
  estado.sessoesPublicadas.set(sessionId, { conta, custoUsd });
  const base = estado.base.get(conta);
  if (!base) return;
  // A sessão publicada entra no "medido" das sessões, como a view do SQL.
  // Republicar com outro custo troca o valor, não soma duas vezes.
  const antes = jaPublicada?.custoUsd ?? 0;
  // P2 do Codex (PR #42, 17ª rodada): publicação com custo é MEDIÇÃO — renova
  // a idade da medição, como o SQL (`painel_fila_medido_ate` lê o livro). Sem
  // isto a trava de medição recente (a 4ª conta nasce com ela) nunca soltava no
  // fixture, e o caminho real de destravar não tinha como ser exercitado.
  const mediu = !semMedicao;
  estado.base.set(conta, {
    ...base,
    publicadasUsd: base.publicadasUsd - antes + (custoUsd ?? 0),
    ...(mediu ? { medidoAteEm: new Date(agora).toISOString(), defasagemHoras: null } : {}),
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
  /**
   * A3 (rodada 11): o pull foi RECUSADO porque a conta exige medição recente e
   * a medição está velha. Espelho de `recusado_por_medicao` em
   * `fila_prompts_pegar_interno` (migration 0019 §17).
   */
  recusadoPorMedicao: boolean;
  /** D32a: quão velho é o número medido desta conta (`null` = nunca mediu). */
  defasagemHoras: number | null;
  /**
   * CRÍTICO (rodada 15): quantas sessões desta conta estão em voo depois deste
   * disparo, e o limite. Espelho de `em_voo`/`limite_em_voo` em
   * `fila_prompts_pegar_interno` (migration 0030 §8). O headroom sozinho
   * anunciava US$ 1,00 de espaço com 40 sessões gastando dinheiro.
   */
  emVoo: number;
  limiteEmVoo: number;
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
      // P2 do Codex (PR #42): o livro é consultado ANTES de a coluna virar
      // estimativa. Se a sessão vinculada já publicou (posto 40), o SQL recusa
      // a estimativa da morte pelo posto (D53) e `mortos_usd` não anda — o
      // fixture somava a estimativa mesmo assim, e a frase do pull anunciava
      // um lançamento que o banco real não faz.
      const livroAntes = livroDoItemFixture(item);
      const livroAceitaEstimativa =
        livroAntes.livroPrecedencia === null || livroAntes.livroPrecedencia === undefined
          ? true
          : POSTO_ESTIMATIVA >= livroAntes.livroPrecedencia;
      estado.fila.set(item.id, {
        ...item,
        estado: "falhou",
        workerId: null,
        heartbeatEm: null,
        motivoFalha: `expirou ${item.tentativas} vezes sem fechamento`,
        // Conservador: quem sumiu provavelmente gastou. D20: marcado como estimativa.
        custoUsd: Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD),
        custoEEstimativa: true,
        // MÉDIO 4 (rodada 8): este número é da CASA — e por isso o operador
        // pode corrigi-lo quantas vezes precisar enquanto o dia está aberto.
        custoOrigem: "estimativa",
        concluidoEm: new Date(agora).toISOString(),
      });
      mortos.push(item.id);
      if (livroAceitaEstimativa) mortosUsd += Math.min(item.custoEstimadoUsd, TETO_CUSTO_USD);
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

  /**
   * A3 (rodada 11) · A PORTA DE RECUSA, E ELA VEM ANTES DE QUALQUER ESCRITA.
   *
   * O fixture já montava a frase certa — `montarMotivoDoPull` recebia
   * `defasagemHoras`/`exigeMedicaoRecente` e devolvia *"não autorizo contra
   * saldo de 37 h atrás: esta conta exige medição recente"* — e depois
   * ENTREGAVA O ITEM ASSIM MESMO. Não havia porta nenhuma: só a frase.
   * O SQL recusa de verdade, e recusa antes de expirar/devolver/matar nada
   * (migration 0019 §17, `if v_exigir and (v_defasagem is null or
   * v_defasagem > 12) then return …`). Por isso esta guarda está acima do
   * `expirar()`: recusar depois de já ter escrito na fila não é recusar.
   */
  const contaMedida = listarConsumoFixture(agora).find((x) => x.conta === conta);
  const baseAntes = estado.base.get(conta);
  const defasagemHoras = baseAntes?.defasagemHoras ?? null;
  if (contaMedida !== undefined && bancoRecusaria(contaMedida, agora)) {
    const tetoDeclarado = baseAntes?.tetoUsd ?? TETO_DIARIO_PADRAO_USD;
    const estimativaAgora = estimativaDe(conta, agora);
    return {
      item: null,
      devolvidos: 0,
      mortos: 0,
      mortosUsd: 0,
      pulados: 0,
      travados: 0,
      menorCustoFilaUsd: null,
      menorCustoElegivelAgoraUsd: null,
      emEspera: emEsperaDe(conta, agora),
      // BAIXO 5: o headroom nunca sai negativo de ramo nenhum do pull.
      headroomUsd: Math.max(
        0,
        tetoDeclarado - medidoDe(conta, agora) - reservadoDe(conta, agora),
      ),
      estimativaUsd: estimativaAgora.usd,
      estimativaItens: estimativaAgora.itens,
      recusadoPorMedicao: true,
      defasagemHoras,
      emVoo: emVooDe(conta, agora),
      limiteEmVoo: MAXIMO_EM_VOO_POR_CONTA,
      // D32c: a RECUSA é a frase inteira — a mesma função pura do SQL.
      motivo: montarMotivoDoPull({
        mortos: 0,
        mortosUsd: 0,
        custoEscolhidoUsd: null,
        headroomUsd: 0,
        menorDisponivelUsd: null,
        elegiveis: 0,
        emEspera: 0,
        menorEmEsperaUsd: null,
        voltaEmMin: null,
        devolvidos: 0,
        travados: 0,
        estimativaUsd: 0,
        estimativaItens: 0,
        defasagemHoras,
        exigeMedicaoRecente: true,
        emVoo: emVooDe(conta, agora),
        limiteEmVoo: MAXIMO_EM_VOO_POR_CONTA,
      }),
    };
  }

  const { devolvidos, mortos, mortosUsd } = expirar(conta, agora);

  const base = estado.base.get(conta);
  const teto = base?.tetoUsd ?? TETO_DIARIO_PADRAO_USD;
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
  /**
   * CRÍTICO 5 (rodada 14) + CRÍTICO (rodada 15): as paredes que o `.sql` tem e
   * este espelho não tinha. `headroom > 0` (dia sem espaço não despacha),
   * `custoEstimadoUsd >= CUSTO_MINIMO_POR_ITEM_USD` (o piso: `> 0` fechava o
   * número zero e deixava a classe aberta — com 0,0001 saíram 40 sessões contra
   * US$ 1,00 de espaço) e o TETO DE SESSÕES EM VOO por conta, que é a parede
   * que fecha o dano sem depender do valor da estimativa.
   */
  const emVooAntes = emVooDe(conta, agora);
  const noLimiteEmVoo = emVooAntes >= MAXIMO_EM_VOO_POR_CONTA;
  const cabe = (i: ItemFilaPrompt): boolean =>
    headroom > 0 &&
    i.custoEstimadoUsd <= headroom &&
    i.custoEstimadoUsd >= CUSTO_MINIMO_POR_ITEM_USD;
  const escolhido = noLimiteEmVoo ? null : (ordenados.find(cabe) ?? null);
  const naoCabem = disponiveis.filter((i) => noLimiteEmVoo || !cabe(i));
  const pulados = naoCabem.length;
  // CRÍTICO (rodada 15): `menorDisponivel` só olha item que PASSA DO PISO — é
  // ele que a frase "nada cabe agora: o mais barato custa X" nomeia. Item
  // abaixo do piso não é barato demais para o dia; é inválido para o
  // mecanismo, e tem oração própria.
  const acimaDoPiso = disponiveis.filter(
    (i) => i.custoEstimadoUsd >= CUSTO_MINIMO_POR_ITEM_USD,
  );
  const abaixoDoPiso = disponiveis.length - acimaDoPiso.length;
  const menorDisponivel =
    acimaDoPiso.length === 0 ? null : Math.min(...acimaDoPiso.map((i) => i.custoEstimadoUsd));
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
    // D32a/c (rodada 7): o fixture é a conta medida há pouco e sem trava — o
    // ramo de defasagem e o de recusa se provam no banco (T26/T27) e na função
    // pura (tests/unit/prompts-motivo-do-pull.test.ts).
    defasagemHoras: loja().base.get(conta)?.defasagemHoras ?? null,
    exigeMedicaoRecente: loja().base.get(conta)?.exigeMedicaoRecente === true,
    emVoo: emVooAntes,
    limiteEmVoo: MAXIMO_EM_VOO_POR_CONTA,
    abaixoDoPiso,
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
    recusadoPorMedicao: false,
    defasagemHoras,
    emVoo: emVooAntes + (escolhido === null ? 0 : 1),
    limiteEmVoo: MAXIMO_EM_VOO_POR_CONTA,
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
  // P2 do Codex (PR #42, 13ª rodada): ouvir `cancelado` NÃO libera a vaga — a
  // filha só é interrompida depois desta resposta. Quem libera é o fechamento
  // do dono (`fecharFixture`) ou a janela. Espelho do §10 da 0030.
  if (item.estado === "cancelada") return { ok: false, motivo: "cancelado" };
  if (item.workerId !== workerId) return { ok: false, motivo: "outro worker" };
  if (item.estado !== "pega") return { ok: false, motivo: `item esta ${item.estado}` };
  if (sessionId !== null) {
    const outro = itens().find((i) => i.sessionId === sessionId && i.id !== id);
    if (outro) return { erro: `sessão já vinculada ao item ${outro.id}` };
    // D34a (rodada 8): esta porta aceitava QUALQUER string de sessão.
    const recusa = recusaDeContaDaSessao(sessionId, item.conta);
    if (recusa) return { erro: recusa };
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
    return { erro: `custo_usd fora da faixa de sanidade (0 a ${TETO_CUSTO_USD}).` };
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
    // BAIXO 1 (rodada 8): nomeia quem PEGOU (o item morto guarda a memória da
    // posse) em vez de dizer "nenhum" justamente quando há um dono conhecido.
    return {
      erro: `Item pertence a outro worker (${item.workerId ?? ultimoDonoDe(item.id) ?? "ninguém pegou este item"}).`,
    };
  }
  if (sessionId !== null) {
    const outro = itens().find((i) => i.sessionId === sessionId && i.id !== item.id);
    if (outro) return { erro: `sessão já vinculada ao item ${outro.id}` };
    const recusa = recusaDeContaDaSessao(sessionId, item.conta);
    if (recusa) return { erro: recusa };
  }
  const agora = input.agora ?? Date.now();
  if (reabrir) {
    loja_.fila.set(item.id, {
      ...item,
      estado: input.estado,
      custoUsd: input.custoUsd,
      custoEEstimativa: false,
      // MÉDIO 4: quem fecha é a SESSÃO; a origem passa a dizer isso.
      custoOrigem: "medido",
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
    // P2 do Codex (PR #42, 21ª rodada): já medido pelo dono = já fechado. A
    // segunda chamada não troca o número nem relança — espelho da 0030.
    if (item.custoOrigem === "medido" && !item.custoEEstimativa && item.custoUsd !== null) {
      loja_.paradaPendente.delete(item.id);
      return { ok: true, jaFechado: true, reabertoEFechado: false, estado: "cancelada" };
    }
    loja_.fila.set(item.id, {
      ...item,
      custoUsd: input.custoUsd,
      custoEEstimativa: false,
      custoOrigem: "medido",
      sessionId: sessionId ?? item.sessionId,
      concluidoEm: item.concluidoEm ?? new Date(agora).toISOString(),
    });
    // P2 do Codex (PR #42, 11ª e 13ª rodadas): o dono que fecha o cancelado
    // confirma a parada — é o único ato que libera a vaga antes da janela.
    // Espelho do §1e'' da 0030.
    loja_.paradaPendente.delete(item.id);
    return { ok: true, jaFechado: false, reabertoEFechado: false, estado: "cancelada" };
  }
  loja_.fila.set(item.id, {
    ...item,
    estado: input.estado,
    custoUsd: input.custoUsd,
    custoEEstimativa: false,
    custoOrigem: "medido",
    sessionId: sessionId ?? item.sessionId,
    heartbeatEm: null,
    disponivelEm: null,
    concluidoEm: new Date(agora).toISOString(),
  });
  return { ok: true, jaFechado: false, reabertoEFechado: false, estado: input.estado };
}

/**
 * Só para teste: liga/desliga a trava de medição recente de uma conta (espelho
 * de `painel_teto_diario.exigir_medicao_recente`).
 *
 * Existe porque o fixture passou a nascer com a trava LIGADA na Alma Petra
 * (MÉDIO 2 da rodada 8: o estado em que o banco recusa 100% dos disparos
 * precisava entrar em screenshot). Os blocos que provam o PULL naquela conta
 * desligam a trava aqui — eles provam outra coisa, e provar duas ao mesmo
 * tempo esconderia as duas.
 */
export function definirExigirMedicaoFixture(conta: Conta, valor: boolean): void {
  const estado = loja();
  const base = estado.base.get(conta);
  if (!base) return;
  estado.base.set(conta, { ...base, exigeMedicaoRecente: valor });
}

/** Só para teste: muda o teto diário de uma conta (o de produção é 500 nas 3). */
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

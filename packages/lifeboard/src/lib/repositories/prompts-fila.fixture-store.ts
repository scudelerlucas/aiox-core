/**
 * OS-LIFEBOARD · P7 — store MUTÁVEL em memória do modo fixture da fila.
 *
 * Mesmo padrão (e mesmo motivo) de `tasks.fixture-store.ts`:
 * `prompts-fila.fixture.ts` é a semente read-only; este módulo é a EXCEÇÃO que
 * muta, para `/prompts` funcionar em dev/teste sem Supabase. `globalThis` (não
 * um `let` de módulo) porque o bundler do Next pode inlinar o módulo em chunks
 * diferentes para a Server Action e para a árvore de Server Components.
 *
 * O que o fixture ESPELHA do banco (rodada 3, para o teste provar a mesma
 * regra que o SQL aplica):
 *  · D1 posse — `pegarFixture(conta, workerId)` grava worker/heartbeat/tentativa;
 *    `fecharFixture` só aceita de quem pegou.
 *  · D2 expiração com fim — 45 min sem sinal: volta enquanto `tentativas <
 *    maxTentativas`, depois `falhou` com o custo estimado.
 *  · D3 elegibilidade por item — o pull escolhe o mais antigo que CABE e a
 *    admissão só recusa o que nunca caberia.
 *  · D7 cancelar — aceita `na_fila` E `pega`.
 *  · D8 paginação e idempotência do fechamento.
 *
 * O roteamento automático chama a MESMA função pura de produção
 * (`escolherConta`) — o fixture não reimplementa a regra, só o estado.
 */

import { escolherConta } from "@/core/prompts/roteador";
import type {
  Complexidade,
  Conta,
  ConsumoConta,
  EstadoFila,
  ItemFilaPrompt,
} from "@/core/prompts/tipos";
import {
  CONTAS,
  HEARTBEAT_LIMITE_MS,
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  contaValida,
  custoEstimadoParaComplexidade,
  formatarUsd,
  modeloParaComplexidade,
  semSinal,
} from "@/core/prompts/tipos";
import { FIXTURE_CONSUMO, FIXTURE_FILA } from "@/lib/repositories/prompts-fila.fixture";

const LIMITE_PROMPT_RPC = 300;

export type ResultadoFilaFixture =
  | { ok: true; id?: string; conta?: Conta; motivo?: string; cabeHoje?: boolean }
  | { erro: string };

interface EstadoFilaFixture {
  fila: Map<string, ItemFilaPrompt>;
  /** Só o gasto MEDIDO e o teto vivem aqui; reservado/naFila são DERIVADOS da fila. */
  base: Map<Conta, { tetoUsd: number; consumoHojeUsd: number; medidoAteEm: string | null }>;
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
            { tetoUsd: c.tetoUsd, consumoHojeUsd: c.consumoHojeUsd, medidoAteEm: c.medidoAteEm },
          ] as const,
      ),
    ),
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
    return {
      conta,
      tetoUsd: base?.tetoUsd ?? 150,
      consumoHojeUsd: base?.consumoHojeUsd ?? 0,
      reservadoUsd: reservadoDe(conta, agora),
      naFilaUsd: naFilaDe(conta),
      medidoAteEm: base?.medidoAteEm ?? null,
    };
  });
}

/** D8: mesma paginação e o MESMO truncamento em 300 caracteres da RPC. */
export function listarFilaFixture(limite = 50, antesDe: string | null = null): ItemFilaPrompt[] {
  const ordenada = itens()
    .filter((i) => (antesDe === null ? true : i.criadoEm < antesDe))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return ordenada.slice(0, Math.min(Math.max(limite, 1), 200)).map((i) => ({
    ...i,
    prompt: i.prompt.slice(0, LIMITE_PROMPT_RPC),
  }));
}

export function filaTemMaisFixture(limite = 50, antesDe: string | null = null): boolean {
  const total = itens().filter((i) => (antesDe === null ? true : i.criadoEm < antesDe)).length;
  return total > Math.min(Math.max(limite, 1), 200);
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
  let motivo: string;
  let cabeHoje: boolean;

  if (input.conta) {
    if (!contaValida(input.conta)) {
      return { erro: "conta precisa ser uma das 3 contas da casa." };
    }
    conta = input.conta;
    const c = consumos.find((x) => x.conta === conta) as ConsumoConta;
    // D3: a ÚNICA recusa de admissão — o item nunca caberia nesta conta.
    if (custoEstimado > c.tetoUsd) {
      return {
        erro:
          `Uma tarefa ${ROTULO_COMPLEXIDADE[input.complexidade]} custa cerca de ${formatarUsd(custoEstimado)} ` +
          `e o teto diário da conta ${ROTULO_CONTA[conta]} é ${formatarUsd(c.tetoUsd)} — nunca vai caber.`,
      };
    }
    const espaco = c.tetoUsd - c.consumoHojeUsd - c.reservadoUsd - c.naFilaUsd;
    cabeHoje = espaco >= custoEstimado;
    motivo = cabeHoje
      ? `conta escolhida à mão (${ROTULO_CONTA[conta]}), com ${formatarUsd(espaco)} livres.`
      : `conta escolhida à mão (${ROTULO_CONTA[conta]}): não cabe hoje (${formatarUsd(espaco)} livres) — ` +
        `roda quando houver espaço.`;
  } else {
    const escolha = escolherConta(consumos, input.complexidade);
    if (escolha.conta === null) return { erro: escolha.motivo };
    conta = escolha.conta;
    motivo = escolha.motivo;
    cabeHoje = escolha.cabeHoje;
  }

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
    criadoEm: new Date(agora).toISOString(),
    pegoEm: null,
    concluidoEm: null,
    heartbeatEm: null,
    workerId: null,
    tentativas: 0,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: input.criadoPor ?? null,
    taskId: input.taskId ?? null,
  });

  return { ok: true, id, conta, motivo, cabeHoje };
}

/** D7: cancela `na_fila` E `pega`. */
export function cancelarFixture(id: string, agora: number = Date.now()): ResultadoFilaFixture {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return { erro: "Item não encontrado." };
  if (item.estado !== "na_fila" && item.estado !== "pega") {
    return { erro: "Item já fechado (concluída, falhou ou cancelada) — não dá para cancelar." };
  }
  estado.fila.set(id, {
    ...item,
    estado: "cancelada",
    heartbeatEm: null,
    concluidoEm: new Date(agora).toISOString(),
    motivoFalha:
      item.estado === "pega" ? "cancelado pelo operador durante a execução" : item.motivoFalha,
  });
  return { ok: true };
}

// ── O worker, espelhado (D1/D2/D3) — usado pelos testes, nunca pela tela ─────

export interface ResultadoPegarFixture {
  item: ItemFilaPrompt | null;
  devolvidos: number;
  mortos: number;
  pulados: number;
  motivo: string | null;
}

/** Expira o que está mudo há mais de 45 min. Devolve os ids que voltaram. */
function expirar(conta: Conta, agora: number): { devolvidos: string[]; mortos: string[] } {
  const estado = loja();
  const devolvidos: string[] = [];
  const mortos: string[] = [];
  for (const item of itens()) {
    if (item.conta !== conta || item.estado !== "pega" || !semSinal(item, agora)) continue;
    if (item.tentativas < item.maxTentativas) {
      estado.fila.set(item.id, {
        ...item,
        estado: "na_fila",
        workerId: null,
        pegoEm: null,
        heartbeatEm: null,
      });
      devolvidos.push(item.id);
    } else {
      estado.fila.set(item.id, {
        ...item,
        estado: "falhou",
        workerId: null,
        heartbeatEm: null,
        motivoFalha: `expirou ${item.tentativas} vezes sem fechamento`,
        // Conservador: quem sumiu provavelmente gastou.
        custoUsd: item.custoEstimadoUsd,
        concluidoEm: new Date(agora).toISOString(),
      });
      mortos.push(item.id);
    }
  }
  return { devolvidos, mortos };
}

export function pegarFixture(
  conta: Conta,
  workerId: string,
  agora: number = Date.now(),
): ResultadoPegarFixture {
  const estado = loja();
  const { devolvidos, mortos } = expirar(conta, agora);

  const base = estado.base.get(conta);
  const teto = base?.tetoUsd ?? 150;
  const medido = base?.consumoHojeUsd ?? 0;
  const emExecucao = reservadoDe(conta, agora);

  const candidatos = itens()
    .filter((i) => i.conta === conta && i.estado === "na_fila" && !devolvidos.includes(i.id))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  let pulados = 0;
  let menorNaoCoube: number | null = null;
  for (const candidato of candidatos) {
    if (medido + emExecucao + candidato.custoEstimadoUsd <= teto) {
      const pego: ItemFilaPrompt = {
        ...candidato,
        estado: "pega",
        workerId,
        pegoEm: new Date(agora).toISOString(),
        heartbeatEm: new Date(agora).toISOString(),
        tentativas: candidato.tentativas + 1,
      };
      estado.fila.set(pego.id, pego);
      return { item: pego, devolvidos: devolvidos.length, mortos: mortos.length, pulados, motivo: null };
    }
    pulados += 1;
    if (menorNaoCoube === null || candidato.custoEstimadoUsd < menorNaoCoube) {
      menorNaoCoube = candidato.custoEstimadoUsd;
    }
  }

  return {
    item: null,
    devolvidos: devolvidos.length,
    mortos: mortos.length,
    pulados,
    motivo:
      menorNaoCoube === null
        ? "fila vazia para esta conta"
        : `nada cabe agora: o mais barato da fila custa ${formatarUsd(menorNaoCoube)} e só há ` +
          `${formatarUsd(teto - medido - emExecucao)} livres`,
  };
}

export type ResultadoHeartbeatFixture = { ok: true } | { ok: false; motivo: string };

export function heartbeatFixture(
  id: string,
  conta: Conta,
  workerId: string,
  sessionId: string | null = null,
  agora: number = Date.now(),
): ResultadoHeartbeatFixture {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item || item.conta !== conta) return { ok: false, motivo: "inexistente" };
  if (item.estado === "cancelada") return { ok: false, motivo: "cancelado" };
  if (item.workerId !== workerId) return { ok: false, motivo: "outro worker" };
  if (item.estado !== "pega") return { ok: false, motivo: `item esta ${item.estado}` };
  estado.fila.set(id, {
    ...item,
    heartbeatEm: new Date(agora).toISOString(),
    sessionId: sessionId ?? item.sessionId,
  });
  return { ok: true };
}

export type ResultadoFecharFixture = { ok: true; jaFechado: boolean } | { erro: string };

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
  if (input.custoUsd < 0 || input.custoUsd > 500) {
    return { erro: "custo_usd fora da faixa aceita (0 a 500)." };
  }
  if (item.estado === "na_fila" && item.workerId === null) {
    return { erro: "Item voltou para a fila (45 min sem sinal) — não pode ser fechado." };
  }
  if (item.workerId !== input.workerId) {
    return { erro: `Item pertence a outro worker (${item.workerId ?? "nenhum"}).` };
  }
  // D8: refechar o que este mesmo worker já fechou não é erro.
  if (item.estado === "concluida" || item.estado === "falhou") {
    return { ok: true, jaFechado: true };
  }
  if (item.estado === "cancelada") {
    return { erro: "Item foi cancelado pelo operador — não pode ser fechado." };
  }
  loja_.fila.set(item.id, {
    ...item,
    estado: input.estado,
    custoUsd: input.custoUsd,
    sessionId: input.sessionId ?? item.sessionId,
    heartbeatEm: null,
    concluidoEm: new Date(input.agora ?? Date.now()).toISOString(),
  });
  return { ok: true, jaFechado: false };
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
  estado.fila.set(id, { ...item, heartbeatEm: new Date(agora - minutos * 60_000).toISOString() });
}

export { HEARTBEAT_LIMITE_MS };

/**
 * OS-LIFEBOARD · P7 — store MUTÁVEL em memória do modo fixture da fila de
 * prompts. Mesmo padrão (e mesmo motivo) de `tasks.fixture-store.ts`:
 * `prompts-fila.fixture.ts` é a semente read-only; este módulo é a EXCEÇÃO
 * que muta, para `/prompts` funcionar em dev/teste sem Supabase.
 *
 * `globalThis` (não um `let` de módulo) pelo MESMO motivo documentado em
 * `tasks.fixture-store.ts`: o bundler do Next pode inlinar este módulo em
 * chunks diferentes para a Server Action e para a árvore de Server
 * Components — um `let` de módulo viraria duas cópias que nunca se veem.
 *
 * O roteamento automático (quando o formulário não escolhe conta) chama a
 * MESMA função pura de produção (`escolherConta`, `@/core/prompts/
 * roteador.ts`) — o fixture não reimplementa a regra, só o estado.
 *
 * Achado CRÍTICO #1 do crítico hostil (rodada de correção, 13/09/2026): o
 * fixture agora mantém `reservadoUsd` por conta (soma do `custoEstimadoUsd`
 * de tudo que está `na_fila`/`pega`) e recusa enfileirar (manual OU
 * automático) quando o HEADROOM (teto − medido − reservado) não cobre o
 * custo estimado da complexidade — mesma régua do trigger em SQL.
 *
 * Achado ALTO #1 (rodada 2, 13/09/2026): este arquivo sempre aceitou em
 * empate (recusa só quando `headroom < custoEstimado`, ou seja aceita
 * quando `headroom >= custoEstimado`) — era o TRIGGER em SQL que recusava
 * esse mesmo empate. Corrigido em `0011_lifeboard_v3_fila_ajustes_2.sql`
 * para o MESMO critério daqui — nada muda neste arquivo.
 */

import { escolherConta } from "@/core/prompts/roteador";
import type {
  Complexidade,
  Conta,
  ConsumoConta,
  ItemFilaPrompt,
} from "@/core/prompts/tipos";
import {
  CONTAS,
  contaValida,
  custoEstimadoParaComplexidade,
  modeloParaComplexidade,
} from "@/core/prompts/tipos";
import { FIXTURE_CONSUMO, FIXTURE_FILA } from "@/lib/repositories/prompts-fila.fixture";

export type ResultadoFilaFixture =
  | { ok: true; id?: string; conta?: Conta; motivo?: string }
  | { erro: string };

interface EstadoFilaFixture {
  fila: Map<string, ItemFilaPrompt>;
  consumo: Map<Conta, ConsumoConta>;
  contador: number;
}

function estadoNovo(): EstadoFilaFixture {
  return {
    fila: new Map(FIXTURE_FILA.map((item) => [item.id, { ...item }] as const)),
    consumo: new Map(FIXTURE_CONSUMO.map((c) => [c.conta, { ...c }] as const)),
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

export function listarFilaFixture(): ItemFilaPrompt[] {
  return [...loja().fila.values()]
    .map((i) => ({ ...i }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function listarConsumoFixture(): ConsumoConta[] {
  const estado = loja();
  return CONTAS.map((conta) => ({ ...(estado.consumo.get(conta) as ConsumoConta) }));
}

function novoId(): string {
  const estado = loja();
  estado.contador += 1;
  return `fila-fixture-novo-${estado.contador}`;
}

/** Soma `estimado` no `reservadoUsd` da conta (negativo para tirar da reserva ao cancelar/fechar). */
function ajustarReservado(conta: Conta, delta: number): void {
  const estado = loja();
  const atual = estado.consumo.get(conta);
  if (!atual) return;
  estado.consumo.set(conta, { ...atual, reservadoUsd: Math.max(0, atual.reservadoUsd + delta) });
}

export interface EnfileirarFixtureInput {
  prompt: string;
  complexidade: Complexidade;
  /** Vem como texto solto do formulário/RPC — validado aqui, não no chamador. */
  conta?: string | null;
  criadoPor?: string | null;
  taskId?: string | null;
}

export function enfileirarFixture(input: EnfileirarFixtureInput): ResultadoFilaFixture {
  const estado = loja();
  const prompt = input.prompt.trim();
  if (prompt.length === 0) return { erro: "O prompt não pode ficar vazio." };
  if (prompt.length > 20000) return { erro: "O prompt passou de 20000 caracteres." };

  const custoEstimado = custoEstimadoParaComplexidade(input.complexidade);

  let conta: Conta;
  let motivo: string;

  if (input.conta) {
    if (!contaValida(input.conta)) {
      return { erro: "conta precisa ser uma das 3 contas da casa." };
    }
    conta = input.conta;
    motivo = "conta escolhida manualmente no formulário";
    const c = estado.consumo.get(conta) as ConsumoConta;
    const headroom = c.tetoUsd - c.consumoHojeUsd - c.reservadoUsd;
    // Achado CRÍTICO #1: mesma régua do trigger — medido + reservado + este
    // item não pode bater o teto, não só "já bateu antes de somar nada".
    if (headroom < custoEstimado) {
      return {
        erro:
          `fila: conta ${conta} ficaria em US$ ${(c.consumoHojeUsd + c.reservadoUsd + custoEstimado).toFixed(2)} hoje ` +
          `(medido US$ ${c.consumoHojeUsd.toFixed(2)} + reservado US$ ${c.reservadoUsd.toFixed(2)} + este item US$ ${custoEstimado.toFixed(2)}) ` +
          `— teto US$ ${c.tetoUsd.toFixed(2)}`,
      };
    }
  } else {
    const consumos = Object.fromEntries(
      CONTAS.map((k) => [k, (estado.consumo.get(k) as ConsumoConta).consumoHojeUsd]),
    ) as Record<Conta, number>;
    const tetos = Object.fromEntries(
      CONTAS.map((k) => [k, (estado.consumo.get(k) as ConsumoConta).tetoUsd]),
    ) as Record<Conta, number>;
    const reservados = Object.fromEntries(
      CONTAS.map((k) => [k, (estado.consumo.get(k) as ConsumoConta).reservadoUsd]),
    ) as Record<Conta, number>;
    const escolha = escolherConta(consumos, tetos, input.complexidade, reservados);
    if (escolha.conta === null) {
      return { erro: `fila: ${escolha.motivo}` };
    }
    conta = escolha.conta;
    motivo = `roteamento automatico: ${escolha.motivo}`;
  }

  const id = novoId();
  estado.fila.set(id, {
    id,
    conta,
    prompt,
    complexidade: input.complexidade,
    custoEstimadoUsd: custoEstimado,
    modeloSugerido: modeloParaComplexidade(input.complexidade),
    estado: "na_fila",
    custoUsd: null,
    criadoEm: new Date().toISOString(),
    pegoEm: null,
    concluidoEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: input.criadoPor ?? null,
    taskId: input.taskId ?? null,
  });
  ajustarReservado(conta, custoEstimado);

  return { ok: true, id, conta, motivo };
}

export function cancelarFixture(id: string): ResultadoFilaFixture {
  const estado = loja();
  const item = estado.fila.get(id);
  if (!item) return { erro: "Item não encontrado (ou não está mais na fila)." };
  if (item.estado !== "na_fila") {
    return {
      erro: "Item não encontrado ou não está mais na fila (já foi pego, fechado ou cancelado).",
    };
  }
  estado.fila.set(id, { ...item, estado: "cancelada" });
  // Sai da reserva — o item cancelado não vai mais gastar nada.
  ajustarReservado(item.conta, -item.custoEstimadoUsd);
  return { ok: true };
}

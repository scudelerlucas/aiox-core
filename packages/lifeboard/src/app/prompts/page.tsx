import type { Metadata } from "next";
import Link from "next/link";

import { env } from "@/config/env";
import { PromptsClient } from "@/components/prompts/prompts-client";
import { FilaTabela } from "@/components/prompts/fila-tabela";
import type { ConsumoConta, ItemFilaPrompt } from "@/core/prompts/tipos";
import { getTasksRepository } from "@/lib/repositories/factory";
import { AGORA_FIXTURE } from "@/lib/repositories/prompts-fila.fixture";
import {
  filaTemMaisFixture,
  listarConsumoFixture,
  listarFilaFixture,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { listarTasksFixture } from "@/lib/repositories/tasks.fixture-store";
import { loadFilaPromptsState } from "@/lib/supabase/live-client";

/**
 * OS-LIFEBOARD · P7 — "poder promptar soluções pelo painel na conta que tem
 * mais tokens disponíveis para a complexidade da tarefa" (pedido do operador).
 * Arquitetura decidida pelo mapa `!4z` (hub, `docs/ops/LIFEBOARD-V3-4z-atomos-
 * e-gargalo-2026-09-13.md`): cota real não é mensurável (R1) → roteia pelo
 * espaço livre medido; um painel não abre sessão em outra conta (R2) → fila
 * PULL, a Routine diária de cada conta é que pega.
 *
 * Server Component, `force-dynamic`, leitura protegida por `try/catch` (uma
 * falha de rede vira frase em português, nunca HTTP 500 — B11 da régua de
 * UI/UX). O acesso à rota já é protegido pelo middleware global.
 *
 * D8 (rodada 3): a fila vem paginada. `?limite=` cresce de 50 em 50 pelo link
 * "mostrar mais" — pagina sem estado de cliente e sem perder o que já está na
 * tela (o contrário de trocar de página, que esconderia os itens novos).
 */
export const metadata: Metadata = {
  title: "Prompts · ALMA PETRA",
  description: "Enfileirar prompts para a conta com mais espaço hoje, sem estourar o teto diário.",
};

export const dynamic = "force-dynamic";

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 200;

function limiteDe(valor: string | string[] | undefined): number {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  const n = Number.parseInt(bruto ?? "", 10);
  if (!Number.isFinite(n)) return LIMITE_PADRAO;
  return Math.min(Math.max(n, 1), LIMITE_MAXIMO);
}

interface EstadoDaPagina {
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
  tarefas: { id: string; title: string }[];
  temMais: boolean;
  /** Em modo fixture é a âncora da semente — screenshot igual em qualquer dia. */
  agora: number;
}

async function carregarEstado(limite: number): Promise<EstadoDaPagina> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    const [filaState, tasks] = await Promise.all([
      loadFilaPromptsState(limite),
      getTasksRepository().listAll(),
    ]);
    return {
      fila: filaState.fila,
      consumo: filaState.consumo,
      tarefas: tasks.map((t) => ({ id: t.id, title: t.title })),
      temMais: filaState.temMais,
      agora: Date.now(),
    };
  }
  return {
    fila: listarFilaFixture(limite),
    consumo: listarConsumoFixture(AGORA_FIXTURE),
    tarefas: listarTasksFixture().map((t) => ({ id: t.id, title: t.title })),
    temMais: filaTemMaisFixture(limite),
    agora: AGORA_FIXTURE,
  };
}

export default async function PaginaPrompts({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const params = (await searchParams) ?? {};
  const limite = limiteDe(params.limite);

  let estado: EstadoDaPagina;
  try {
    estado = await carregarEstado(limite);
  } catch (erro) {
    console.error("[prompts] falha ao ler a fila:", erro);
    return <NaoConsegui />;
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-bone-50">Prompts</h1>
      <p className="mt-1 max-w-[600px] text-sm text-bone-300">
        Enfileire um prompt e ele vai para a conta com mais espaço livre hoje — a Routine diária de
        cada conta pega o que é dela e só roda o que cabe no teto do dia. O que não cabe hoje fica
        na fila e roda quando houver espaço.
      </p>

      <div className="mt-6">
        <PromptsClient consumo={estado.consumo} tarefas={estado.tarefas} agora={estado.agora} />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-bone-50">Fila</h2>
      <FilaTabela
        itens={estado.fila}
        agora={estado.agora}
        temMais={estado.temMais}
        limiteAtual={limite}
      />
    </main>
  );
}

function NaoConsegui(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">Prompts</h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui ler a fila agora — tente de novo em alguns minutos.
      </div>
      <Link
        href="/prompts"
        prefetch={false}
        className="mt-5 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
      >
        tentar de novo
      </Link>
    </main>
  );
}

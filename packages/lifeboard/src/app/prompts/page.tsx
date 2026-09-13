import type { Metadata } from "next";
import Link from "next/link";

import { env } from "@/config/env";
import { PromptsClient } from "@/components/prompts/prompts-client";
import { FilaTabela } from "@/components/prompts/fila-tabela";
import type { ConsumoConta, ItemFilaPrompt } from "@/core/prompts/tipos";
import { getTasksRepository } from "@/lib/repositories/factory";
import {
  listarConsumoFixture,
  listarFilaFixture,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { listarTasksFixture } from "@/lib/repositories/tasks.fixture-store";
import { loadFilaPromptsState } from "@/lib/supabase/live-client";

/**
 * OS-LIFEBOARD · P7 — "poder promptar soluções pelo painel na conta que tem
 * mais tokens disponíveis para a complexidade da tarefa" (pedido do
 * operador). Arquitetura decidida pelo mapa `!4z` (hub,
 * `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md`): cota real não é
 * mensurável (R1) → roteia pelo consumo do dia; um painel não abre sessão em
 * outra conta (R2) → fila PULL, a Routine diária de cada conta é que pega.
 *
 * Mesmo padrão de `/frentes` e `/tarefa/[id]`: Server Component,
 * `force-dynamic`, leitura protegida por `try/catch` (uma falha de rede vira
 * frase em português, nunca HTTP 500 — B11 da régua de UI/UX). O acesso à
 * rota já é protegido pelo middleware global (login Google + allowlist) —
 * nenhum gate adicional aqui.
 */
export const metadata: Metadata = {
  title: "Prompts · ALMA PETRA",
  description: "Enfileirar prompts para a conta com menos gasto hoje, sem estourar o teto diário.",
};

export const dynamic = "force-dynamic";

async function carregarEstado(): Promise<{
  fila: ItemFilaPrompt[];
  consumo: ConsumoConta[];
  tarefas: { id: string; title: string }[];
}> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    const [filaState, tasks] = await Promise.all([
      loadFilaPromptsState(),
      getTasksRepository().listAll(),
    ]);
    return {
      fila: filaState.fila,
      consumo: filaState.consumo,
      tarefas: tasks.map((t) => ({ id: t.id, title: t.title })),
    };
  }
  return {
    fila: listarFilaFixture(),
    consumo: listarConsumoFixture(),
    tarefas: listarTasksFixture().map((t) => ({ id: t.id, title: t.title })),
  };
}

export default async function PaginaPrompts(): Promise<JSX.Element> {
  let fila: ItemFilaPrompt[];
  let consumo: ConsumoConta[];
  let tarefas: { id: string; title: string }[];
  try {
    const estado = await carregarEstado();
    fila = estado.fila;
    consumo = estado.consumo;
    tarefas = estado.tarefas;
  } catch (erro) {
    console.error("[prompts] falha ao ler a fila:", erro);
    return <NaoConsegui />;
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-bone-50">Prompts</h1>
      <p className="mt-1 max-w-[560px] text-sm text-bone-300">
        Enfileire um prompt e ele vai para a conta do dia com menos gasto — a Routine diária de
        cada conta pega o que é dela. Nenhuma conta que já bateu o teto de hoje aceita item novo.
      </p>

      <div className="mt-6">
        <PromptsClient consumo={consumo} tarefas={tarefas} />
      </div>

      <h2 className="mt-8 text-sm font-semibold text-bone-50">Fila</h2>
      <FilaTabela itens={fila} agora={Date.now()} />
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

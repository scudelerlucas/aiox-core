"use server";

/**
 * OS-LIFEBOARD · P7 — server actions da fila de prompts (`/prompts`).
 *
 * Mesmo contrato de `src/app/tarefa/actions.ts`: cada ação valida em
 * português ANTES de gastar uma chamada de rede/RPC (régua de UI/UX —
 * "erro em português no campo, nunca JSON"), despacha para o modo certo
 * (`mutar()` decide live × fixture uma vez só) e nunca lança — sempre
 * `{ erro }` ou `{ ok: true, ... }`.
 */

import { revalidatePath } from "next/cache";

import { env } from "@/config/env";
import { complexidadeValida, type Complexidade } from "@/core/prompts/tipos";
import {
  cancelarFixture,
  enfileirarFixture,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { cancelarPromptFila, enfileirarPrompt } from "@/lib/supabase/live-client";

export type EstadoAcaoPrompt = {
  erro?: string;
  ok?: true;
  id?: string;
  conta?: string;
  motivo?: string;
};

function revalidar(): void {
  revalidatePath("/prompts");
}

function textoOu(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
}

function textoOuNulo(form: FormData, campo: string): string | null {
  const v = textoOu(form, campo).trim();
  return v.length > 0 ? v : null;
}

type ResultadoMutar =
  | { ok: true; id?: string; conta?: string; motivo?: string }
  | { erro: string };

async function mutarEnfileirar(input: {
  prompt: string;
  complexidade: Complexidade;
  conta: string | null;
  criadoPor: string | null;
  taskId: string | null;
}): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return enfileirarPrompt({
      prompt: input.prompt,
      complexidade: input.complexidade,
      conta: input.conta,
      criado_por: input.criadoPor,
      task_id: input.taskId,
    });
  }
  return enfileirarFixture({
    prompt: input.prompt,
    complexidade: input.complexidade,
    conta: input.conta,
    criadoPor: input.criadoPor,
    taskId: input.taskId,
  });
}

async function mutarCancelar(id: string): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return cancelarPromptFila(id);
  }
  return cancelarFixture(id);
}

// ═══════════════════════════════════════════════════════════ novo_prompt ═
export async function novoPromptAction(
  _estado: EstadoAcaoPrompt,
  form: FormData,
): Promise<EstadoAcaoPrompt> {
  const prompt = textoOu(form, "prompt");
  const complexidade = textoOu(form, "complexidade");
  const conta = textoOuNulo(form, "conta");
  const criadoPor = textoOuNulo(form, "criado_por");
  const taskId = textoOuNulo(form, "task_id");

  if (prompt.trim().length === 0) {
    return { erro: "Escreva o prompt antes de enviar." };
  }
  if (prompt.trim().length > 20000) {
    return { erro: "O prompt passou de 20000 caracteres — encurte antes de enviar." };
  }
  if (!complexidadeValida(complexidade)) {
    return { erro: "complexidade precisa ser uma de: baixa, média, alta, máxima." };
  }

  const r = await mutarEnfileirar({
    prompt: prompt.trim(),
    complexidade,
    conta,
    criadoPor,
    taskId,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidar();
  return { ok: true, id: r.id, conta: r.conta, motivo: r.motivo };
}

// ══════════════════════════════════════════════════════════ cancelar ═════
export async function cancelarPromptAction(
  _estado: EstadoAcaoPrompt,
  form: FormData,
): Promise<EstadoAcaoPrompt> {
  const id = textoOu(form, "id");
  if (id.length === 0) return { erro: "Item não identificado." };

  const r = await mutarCancelar(id);
  if ("erro" in r) return { erro: r.erro };
  revalidar();
  return { ok: true };
}

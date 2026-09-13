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
import { CONTAS, ROTULO_CONTA, complexidadeValida, type Complexidade } from "@/core/prompts/tipos";
import {
  cancelarFixture,
  enfileirarFixture,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { cancelarPromptFila, enfileirarPrompt } from "@/lib/supabase/live-client";
import { createSupabaseUserClient } from "@/lib/supabase/user-server";

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

/**
 * Achado BAIXO #9 (crítico hostil, rodada 2): a recusa que vinha do trigger
 * (via `traduzirErroFila`, código `check_violation`) ou do fixture-store
 * chegava À TELA verbatim — jargão interno ("medido"/"reservado"/"este
 * item") + o E-MAIL CRU da conta ("fila: conta lucasscudeler@gmail.com
 * ficaria em US$ ... — teto US$ ..."). O operador não devia precisar saber
 * qual e-mail é qual conta. Mapeia para o rótulo (Lucas/Pandora/Alma Petra) e
 * reduz para a frase que interessa; o texto INTEIRO (o de dentro) sempre vai
 * para `console.error` — nunca se perde, só não aparece na tela.
 */
function formatarRecusaFila(erroBruto: string): string {
  console.error(`[prompts] recusa da fila (bruto): ${erroBruto}`);

  const conta = CONTAS.find((c) => erroBruto.includes(c));
  const estimado = erroBruto.match(/este item US\$\s*([\d.,]+)\)/)?.[1];
  const teto = erroBruto.match(/teto US\$\s*([\d.,]+)\s*\.?$/)?.[1];

  if (conta && estimado && teto) {
    return `A conta ${ROTULO_CONTA[conta]} não tem US$ ${estimado} livres hoje (teto US$ ${teto}).`;
  }
  // Formato que não bate (ex.: recusa do roteamento automático, sem conta
  // específica) atravessa como está — não tem e-mail cru para mapear.
  return erroBruto;
}

function textoOu(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
}

function textoOuNulo(form: FormData, campo: string): string | null {
  const v = textoOu(form, campo).trim();
  return v.length > 0 ? v : null;
}

/**
 * Achado MÉDIO #14 (crítico hostil, rodada de correção 13/09/2026):
 * `criado_por` nunca era gravado (o formulário não tem — nem deveria ter —
 * um campo para o operador se identificar; era só um parâmetro morto). Lido
 * do lado do SERVIDOR, na sessão logada — mesmo utilitário que `/frentes`
 * usa (`createSupabaseUserClient`, cookies da sessão Google do middleware).
 * Sem sessão (modo fixture local, ou um soluço de rede lendo o cookie):
 * `null` — nunca falha a ação por causa disto.
 */
async function emailDaSessao(): Promise<string | null> {
  try {
    const supabase = await createSupabaseUserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
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

  // Achado MÉDIO #14: `criado_por` vem da sessão (server-side), nunca de um
  // campo do formulário — o operador não digita quem ele é.
  const criadoPor = await emailDaSessao();

  const r = await mutarEnfileirar({
    prompt: prompt.trim(),
    complexidade,
    conta,
    criadoPor,
    taskId,
  });
  // Achado BAIXO #9: só a recusa da RPC/fixture (jargão + e-mail cru) passa
  // pelo formatador — os `erro` de validação acima já estão em português
  // simples e nunca citam uma conta.
  if ("erro" in r) return { erro: formatarRecusaFila(r.erro) };
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

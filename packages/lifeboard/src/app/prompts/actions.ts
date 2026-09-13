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
  /** D3: entrou na fila mas não cabe no teto de hoje — roda quando houver espaço. */
  cabeHoje?: boolean;
};

function revalidar(): void {
  revalidatePath("/prompts");
}

/**
 * D3/D9 (rodada 3): depois da mudança de admissão, a fila só recusa UMA coisa
 * — o item que nunca caberia (custo estimado maior que o teto da conta). A
 * mensagem do trigger já nasce em português e já traz a complexidade por
 * extenso ("uma tarefa máxima"); o que sobra aqui é (a) tirar o prefixo
 * técnico `fila: `, (b) trocar qualquer e-mail cru pelo rótulo da conta
 * (Lucas/Pandora/Alma Petra — o operador não precisa saber qual e-mail é
 * qual) e (c) pôr a vírgula decimal no lugar do ponto. O texto INTEIRO sempre
 * vai para `console.error` — nunca se perde, só não aparece na tela.
 */
function formatarRecusaFila(erroBruto: string): string {
  console.error(`[prompts] recusa da fila (bruto): ${erroBruto}`);

  let texto = erroBruto.replace(/^fila:\s*/, "");
  for (const conta of CONTAS) {
    texto = texto.split(conta).join(ROTULO_CONTA[conta]);
  }
  // "US$ 120.00" -> "US$ 120,00" (só onde é dinheiro, nunca no resto do texto).
  texto = texto.replace(/US\$\s*(\d+)\.(\d{2})\b/g, "US$ $1,$2");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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
  | { ok: true; id?: string; conta?: string; motivo?: string; cabeHoje?: boolean }
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
  return { ok: true, id: r.id, conta: r.conta, motivo: r.motivo, cabeHoje: r.cabeHoje !== false };
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

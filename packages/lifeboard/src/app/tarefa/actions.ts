"use server";

/**
 * OS-LIFEBOARD · P6 — Server actions da página da tarefa.
 *
 * Uma função por operação de `lifeboard_mutate` (contrato em
 * `supabase/migrations/0006_lifeboard_v3_escrita.sql`). Cada uma:
 *  1. lê os campos do `FormData` (nunca confia no formato — tudo é `string | null`);
 *  2. valida em português, com a MESMA régua do banco (`atomosDeclaradosValidos`,
 *     `pesoValido`, `FAIXAS_ESFORCO_CUSTO`) — pega o erro ANTES de gastar uma
 *     chamada de rede, mas nunca reimplementa o que o CHECK/gatilho já garante;
 *  3. despacha para o modo certo — RPC live (`mutateLifeboard`) ou o store em
 *     memória do fixture (`tasks.fixture-store`) — e nunca lança: sempre
 *     devolve `{ erro }` ou `{ ok: true, id? }`, o par que `useFormState` espera;
 *  4. em sucesso, revalida as 3 rotas que podem ter mudado.
 *
 * Nenhuma ação chama a RPC em modo fixture, e nenhuma toca o store em modo
 * live — `env.LIFEBOARD_DATA_MODE` decide uma vez, no topo de `mutar()`.
 */

import { revalidatePath } from "next/cache";

import { env } from "@/config/env";
import { mutateLifeboard } from "@/lib/supabase/live-client";
import {
  arestaAddFixture,
  arestaDelFixture,
  atomosSetFixture,
  estimativaSetFixture,
  goalSetFixture,
  notaAddFixture,
  notaDelFixture,
  parentSetFixture,
  statusSetFixture,
  subtarefaAddFixture,
} from "@/lib/repositories/tasks.fixture-store";
import { atomosDeclaradosValidos, pesoValido } from "@/core/prioritize/tipos-v3";
import type { AssimetriaDeclarada, EdgeTipo, TaskStatus } from "@/types/canonical";

export type EstadoAcaoTarefa = { erro?: string; ok?: true; id?: string };

const TIPOS_DE_ARESTA: readonly EdgeTipo[] = [
  "predecessor",
  "correlacao",
  "sinergia",
  "obsolescencia",
];
const STATUS_VALIDOS: readonly TaskStatus[] = ["open", "in_progress", "blocked", "done"];

// ── ALTO #3/#5 (crítico 13/09) — limites que a coluna/JSON do banco impõem,
// checados aqui em português ANTES da chamada de rede (mesma disciplina do
// resto deste arquivo: nunca reimplementar o CHECK, só adiantar o erro).
/** `tasks.estimativa_dias` é `numeric(6,2)` — acima disso o Postgres rejeita com "numeric field overflow". */
const ESTIMATIVA_DIAS_MAXIMA = 9999.99;
/** `task_notes.texto` (migration 0008): teto de tamanho para não caber payload de 2 MB numa nota. */
const NOTA_TEXTO_MAX = 10_000;
/** `task_edges.nota` (migration 0008). */
const ARESTA_NOTA_MAX = 2_000;
/** `pg_column_size(assimetria) < 2048` (migration 0008) — teto de bytes, não de chaves; medido em JSON. */
const ASSIMETRIA_BYTES_MAX = 2_048;

function estimativaValidaOuErro(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) {
    return "A duração (estimativa em dias) precisa ser um número maior que zero.";
  }
  if (n > ESTIMATIVA_DIAS_MAXIMA) {
    return `A duração não pode passar de ${ESTIMATIVA_DIAS_MAXIMA} dias.`;
  }
  return null;
}

function revalidar(taskId: string): void {
  revalidatePath("/");
  revalidatePath(`/tarefa/${taskId}`);
  revalidatePath("/linha-do-tempo");
}

function textoOu(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
}

function textoOuNulo(form: FormData, campo: string): string | null {
  const v = textoOu(form, campo).trim();
  return v.length > 0 ? v : null;
}

/** Dispatcher único: live chama a RPC secret-gated; fixture, o store em memória. */
type ResultadoMutar = { ok: true; id?: string } | { erro: string };

async function mutar(op: string, payload: Record<string, unknown>): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return mutateLifeboard(op, payload);
  }
  switch (op) {
    case "nota_add":
      return notaAddFixture(
        payload.task_id as string,
        payload.texto as string,
        (payload.autor as string | null) ?? null,
      );
    case "nota_del":
      return notaDelFixture(payload.id as string);
    case "subtarefa_add":
      return subtarefaAddFixture(
        payload.parent_id as string,
        payload.title as string,
        (payload.estimativa_dias as number | null) ?? null,
      );
    case "parent_set":
      return parentSetFixture(payload.task_id as string, (payload.parent_id as string | null) ?? null);
    case "goal_set":
      return goalSetFixture(payload.task_id as string, payload.is_goal as boolean);
    case "atomos_set":
      return atomosSetFixture(
        payload.task_id as string,
        (payload.assimetria as AssimetriaDeclarada | null) ?? null,
      );
    case "estimativa_set":
      return estimativaSetFixture(
        payload.task_id as string,
        (payload.estimativa_dias as number | null) ?? null,
      );
    case "status_set":
      return statusSetFixture(payload.task_id as string, payload.status as TaskStatus);
    case "aresta_add":
      return arestaAddFixture(
        payload.origem as string,
        payload.destino as string,
        payload.tipo as EdgeTipo,
        (payload.peso as number | undefined) ?? 1,
        (payload.nota as string | null) ?? null,
      );
    case "aresta_del":
      return arestaDelFixture(payload.id as string);
    default:
      return { erro: `Operação desconhecida: ${op}.` };
  }
}

// ═══════════════════════════════════════════════════════════════ nota_add ═
export async function notaAddAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  const texto = textoOu(form, "texto");
  const autor = textoOuNulo(form, "autor");

  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (texto.trim().length === 0) return { erro: "Escreva algo antes de salvar a nota." };
  if (texto.length > NOTA_TEXTO_MAX) {
    return { erro: `A nota não pode passar de ${NOTA_TEXTO_MAX} caracteres.` };
  }

  const r = await mutar("nota_add", { task_id: taskId, texto, autor });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true, id: r.id };
}

// ═══════════════════════════════════════════════════════════════ nota_del ═
export async function notaDelAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const id = textoOu(form, "id");
  const taskId = textoOu(form, "task_id");
  if (id.length === 0) return { erro: "Nota não identificada." };

  const r = await mutar("nota_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════ subtarefa_add ═
export async function subtarefaAddAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const parentId = textoOu(form, "parent_id");
  const title = textoOu(form, "title");
  const estimativaBruta = textoOu(form, "estimativa_dias").trim();

  if (parentId.length === 0) return { erro: "Tarefa mãe não identificada." };
  if (title.trim().length === 0) return { erro: "O título da subtarefa não pode ficar vazio." };

  let estimativaDias: number | null = null;
  if (estimativaBruta.length > 0) {
    const n = Number(estimativaBruta);
    const erro = estimativaValidaOuErro(n);
    if (erro) return { erro };
    estimativaDias = n;
  }

  const r = await mutar("subtarefa_add", {
    parent_id: parentId,
    title,
    estimativa_dias: estimativaDias,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidar(parentId);
  return { ok: true, id: r.id };
}

// ═══════════════════════════════════════════════════════════════ parent_set ═
export async function parentSetAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  const parentId = textoOuNulo(form, "parent_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (parentId === taskId) return { erro: "Uma tarefa não pode ser mãe de si mesma." };

  const r = await mutar("parent_set", { task_id: taskId, parent_id: parentId });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════ goal_set ═
export async function goalSetAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  const isGoal = textoOu(form, "is_goal") === "true";
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const r = await mutar("goal_set", { task_id: taskId, is_goal: isGoal });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ atomos_set ═
export async function atomosSetAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const limpar = textoOu(form, "limpar") === "true";
  if (limpar) {
    const r = await mutar("atomos_set", { task_id: taskId, assimetria: null });
    if ("erro" in r) return { erro: r.erro };
    revalidar(taskId);
    return { ok: true };
  }

  const opcionalidade = Number(textoOu(form, "opcionalidade"));
  const esforco = Number(textoOu(form, "esforco"));
  const custo = Number(textoOu(form, "custo"));
  const candidato = { opcionalidade, esforco, custo };
  if (!atomosDeclaradosValidos(candidato)) {
    return {
      erro:
        "Átomos inválidos: opcionalidade precisa ser 1, 2 ou 3; esforço e custo precisam ser 1, 2, 3 ou 5.",
    };
  }
  // ALTO #5 (crítico 13/09) — defesa em profundidade: esta ação só monta 3
  // chaves numéricas, então nunca produz os 2 MB do achado sozinha, mas o
  // teto do banco (`pg_column_size(assimetria) < 2048`) é checado aqui
  // também para nunca gastar a chamada de rede à toa.
  if (new TextEncoder().encode(JSON.stringify(candidato)).length >= ASSIMETRIA_BYTES_MAX) {
    return { erro: "Os átomos declarados ficaram grandes demais para salvar." };
  }

  const r = await mutar("atomos_set", { task_id: taskId, assimetria: candidato });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════ estimativa_set ═
export async function estimativaSetAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const bruta = textoOu(form, "estimativa_dias").trim();
  let estimativaDias: number | null = null;
  if (bruta.length > 0) {
    const n = Number(bruta);
    if (!Number.isFinite(n) || n <= 0 || n < 0.25) {
      return { erro: "A duração precisa ser um número de pelo menos 0,25 dia." };
    }
    if (n > ESTIMATIVA_DIAS_MAXIMA) {
      return { erro: `A duração não pode passar de ${ESTIMATIVA_DIAS_MAXIMA} dias.` };
    }
    estimativaDias = n;
  }

  const r = await mutar("estimativa_set", { task_id: taskId, estimativa_dias: estimativaDias });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ status_set ═
export async function statusSetAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(form, "task_id");
  const status = textoOu(form, "status");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (!STATUS_VALIDOS.includes(status as TaskStatus)) {
    return { erro: "status precisa ser um de: aberta, em progresso, bloqueada, concluída." };
  }

  const r = await mutar("status_set", { task_id: taskId, status });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ aresta_add ═
export async function arestaAddAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const origem = textoOu(form, "origem");
  const destino = textoOu(form, "destino");
  const tipo = textoOu(form, "tipo") as EdgeTipo;
  const nota = textoOuNulo(form, "nota");
  const pesoBruto = textoOu(form, "peso").trim();

  if (origem.length === 0 || destino.length === 0) {
    return { erro: "Escolha a tarefa de destino da relação." };
  }
  if (origem === destino) {
    return { erro: "A tarefa de origem e a tarefa de destino não podem ser a mesma." };
  }
  if (!TIPOS_DE_ARESTA.includes(tipo)) {
    return { erro: "O tipo de relação precisa ser um de: predecessor, correlação, sinergia, obsolescência." };
  }
  let peso = 1;
  if (pesoBruto.length > 0) {
    peso = Number(pesoBruto);
    if (!pesoValido(peso)) return { erro: "O desconto precisa ser um número entre 0 e 1." };
  }
  if (nota !== null && nota.length > ARESTA_NOTA_MAX) {
    return { erro: `A nota da relação não pode passar de ${ARESTA_NOTA_MAX} caracteres.` };
  }

  const r = await mutar("aresta_add", { origem, destino, tipo, peso, nota });
  if ("erro" in r) return { erro: r.erro };
  revalidar(origem);
  revalidar(destino);
  return { ok: true, id: r.id };
}

// ══════════════════════════════════════════════════════════════ aresta_del ═
export async function arestaDelAction(
  _estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  const id = textoOu(form, "id");
  const taskId = textoOu(form, "task_id");
  if (id.length === 0) return { erro: "Aresta não identificada." };

  const r = await mutar("aresta_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

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
 *  3. despacha por `mutar` (`@/app/tarefa/despachante`) e nunca lança: sempre
 *     devolve `{ erro }` ou `{ ok: true, id? }`, o par que `useFormState` espera;
 *  4. em sucesso, revalida as 3 rotas que podem ter mudado.
 *
 * [Achado MAIOR, CodeRabbit + rodada 10] Este módulo é `"use server"`, então
 * TUDO que ele exporta vira uma Server Action pública, chamável pela rede por
 * qualquer cliente autenticado. Por isso o despachante `mutar` foi movido para
 * `@/app/tarefa/despachante`, que não é `"use server"`: exportado daqui, ele
 * era uma porta dos fundos que pulava a porta de escrita inteira.
 *
 * **A regra que fica: este arquivo exporta APENAS `escreverTarefaAction`.**
 * Qualquer export novo aqui é um endpoint novo na internet — pense duas vezes.
 */

import { revalidatePath } from "next/cache";

import {
  ehOperacaoDeEscrita,
  type CamposDeEscrita,
  type EstadoAcaoTarefa,
  type PedidoDeEscrita,
} from "@/app/tarefa/pedido";

import { mutar } from "@/app/tarefa/despachante";
import { dataOriginalValidaOuErro } from "@/lib/fuso";
import {
  atomosDeclaradosValidos,
  AUTOR_MAXIMO,
  DURACAO_MINIMA_DIAS,
  pesoValido,
  TITULO_MAXIMO,
} from "@/core/prioritize/tipos-v3";
import type { EdgeTipo, TaskStatus } from "@/types/canonical";

export type { EstadoAcaoTarefa } from "@/app/tarefa/pedido";

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

/**
 * [BAIXO #10, crítico 13/09, rodada 2] ÚNICA régua de duração mínima — antes
 * `subtarefa_add` só exigia `> 0` (aceitava `0.1`) enquanto `estimativa_set`
 * exigia `>= 0.25`; as duas portas de entrada para o MESMO campo aplicavam
 * leis diferentes. As duas chamam esta função agora; `DURACAO_MINIMA_DIAS`
 * vem de `tipos-v3.ts` — mesmo valor usado pela migration 0010.
 */
function estimativaValidaOuErro(n: number): string | null {
  if (!Number.isFinite(n) || n < DURACAO_MINIMA_DIAS) {
    // Vírgula decimal (pt-BR), não o ponto do `toString()` do JS — mesmo
    // formato que a mensagem já tinha antes desta função existir.
    const minimoFormatado = String(DURACAO_MINIMA_DIAS).replace(".", ",");
    return `A duração (estimativa em dias) precisa ser um número de pelo menos ${minimoFormatado} dia.`;
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

function textoOu(campos: CamposDeEscrita, campo: string): string {
  const v = campos[campo];
  return typeof v === "string" ? v : "";
}

function textoOuNulo(campos: CamposDeEscrita, campo: string): string | null {
  const v = textoOu(campos, campo).trim();
  return v.length > 0 ? v : null;
}

// ═══════════════════════════════════════════════════════════════ nota_add ═
async function notaAdd(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const texto = textoOu(campos, "texto");
  const autor = textoOuNulo(campos, "autor");

  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (texto.trim().length === 0) return { erro: "Escreva algo antes de salvar a nota." };
  if (texto.length > NOTA_TEXTO_MAX) {
    return { erro: `A nota não pode passar de ${NOTA_TEXTO_MAX} caracteres.` };
  }
  // [ALTO #2, crítico 13/09, rodada 2] `autor` sem teto aceitava 1 MB.
  if (autor !== null && autor.length > AUTOR_MAXIMO) {
    return { erro: `O nome do autor não pode passar de ${AUTOR_MAXIMO} caracteres.` };
  }

  // [MÉDIO #4, rodada 7] só o DESFAZER manda `criado_em`; uma nota nova não
  // manda nada e o banco usa `now()`, como sempre.
  const criadoEmBruto = textoOuNulo(campos, "criado_em");
  let criadoEm: string | null = null;
  if (criadoEmBruto !== null) {
    const v = dataOriginalValidaOuErro(criadoEmBruto);
    if ("erro" in v) return { erro: v.erro };
    criadoEm = v.iso;
  }

  const r = await mutar("nota_add", { task_id: taskId, texto, autor, criado_em: criadoEm });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true, id: r.id };
}

// ═══════════════════════════════════════════════════════════════ nota_del ═
async function notaDel(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const id = textoOu(campos, "id");
  const taskId = textoOu(campos, "task_id");
  if (id.length === 0) return { erro: "Nota não identificada." };

  const r = await mutar("nota_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════ subtarefa_add ═
async function subtarefaAdd(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const parentId = textoOu(campos, "parent_id");
  const title = textoOu(campos, "title");
  const estimativaBruta = textoOu(campos, "estimativa_dias").trim();

  if (parentId.length === 0) return { erro: "Tarefa mãe não identificada." };
  if (title.trim().length === 0) return { erro: "O título da subtarefa não pode ficar vazio." };
  // [ALTO #2, crítico 13/09, rodada 2] `title` sem teto aceitava 3 MB.
  if (title.length > TITULO_MAXIMO) {
    return { erro: `O título não pode passar de ${TITULO_MAXIMO} caracteres.` };
  }

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
async function parentSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const parentId = textoOuNulo(campos, "parent_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (parentId === taskId) return { erro: "Uma tarefa não pode ser mãe de si mesma." };

  const r = await mutar("parent_set", { task_id: taskId, parent_id: parentId });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════ goal_set ═
async function goalSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const isGoal = textoOu(campos, "is_goal") === "true";
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const r = await mutar("goal_set", { task_id: taskId, is_goal: isGoal });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ atomos_set ═
async function atomosSet(campos: CamposDeEscrita, limpar: boolean): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  if (limpar) {
    const r = await mutar("atomos_set", { task_id: taskId, assimetria: null });
    if ("erro" in r) return { erro: r.erro };
    revalidar(taskId);
    return { ok: true };
  }

  const opcionalidade = Number(textoOu(campos, "opcionalidade"));
  const esforco = Number(textoOu(campos, "esforco"));
  const custo = Number(textoOu(campos, "custo"));
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
async function estimativaSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const bruta = textoOu(campos, "estimativa_dias").trim();
  let estimativaDias: number | null = null;
  if (bruta.length > 0) {
    const n = Number(bruta);
    // [BAIXO #10, rodada 2] mesma função de `subtarefaAddAction` — uma só régua.
    const erro = estimativaValidaOuErro(n);
    if (erro) return { erro };
    estimativaDias = n;
  }

  const r = await mutar("estimativa_set", { task_id: taskId, estimativa_dias: estimativaDias });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ status_set ═
async function statusSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const status = textoOu(campos, "status");
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
async function arestaAdd(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const origem = textoOu(campos, "origem");
  const destino = textoOu(campos, "destino");
  const tipo = textoOu(campos, "tipo") as EdgeTipo;
  const nota = textoOuNulo(campos, "nota");
  const pesoBruto = textoOu(campos, "peso").trim();

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

  // [MÉDIO #4, rodada 7] mesma régua da nota — só o desfazer preenche.
  const criadoEmBruto = textoOuNulo(campos, "criado_em");
  let criadoEm: string | null = null;
  if (criadoEmBruto !== null) {
    const v = dataOriginalValidaOuErro(criadoEmBruto);
    if ("erro" in v) return { erro: v.erro };
    criadoEm = v.iso;
  }

  const r = await mutar("aresta_add", {
    origem,
    destino,
    tipo,
    peso,
    nota,
    criado_em: criadoEm,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidar(origem);
  revalidar(destino);
  return { ok: true, id: r.id };
}

// ══════════════════════════════════════════════════════════════ aresta_del ═
async function arestaDel(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const id = textoOu(campos, "id");
  const taskId = textoOu(campos, "task_id");
  if (id.length === 0) return { erro: "Aresta não identificada." };

  const r = await mutar("aresta_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════ a PORTA do servidor ═
/**
 * [ALTO #1, rodada 9] A ÚNICA função de escrita que o cliente consegue
 * chamar. As dez funções acima deixaram de ser exportadas: quem quiser
 * gravar tem de trazer um `PedidoDeEscrita`, e um `PedidoDeEscrita` só
 * nasce dentro de `porta-de-escrita.ts` (o selo é um `unique symbol`
 * ambiente e não exportado — ver `pedido.ts`).
 *
 * Consequências que a rodada 8 não tinha:
 *  - `<form action={zerarDuracaoDireto}>` (forma M6) entrega um `FormData`;
 *    `FormData` não é `PedidoDeEscrita` → não compila;
 *  - um 2º hook despachando cru (forma M8) não tem o que despachar: a porta
 *    não devolve `disparar`, e a ação não aceita nada além do pedido selado;
 *  - a `op` viaja DENTRO do pedido, então o servidor sabe qual escrita está
 *    executando — não é mais uma string que um handler de cliente "declara".
 *
 * Nunca lança: devolve `{ erro }` em português ou `{ ok: true, id? }`.
 */
export async function escreverTarefaAction(
  _estado: EstadoAcaoTarefa,
  pedido: PedidoDeEscrita,
): Promise<EstadoAcaoTarefa> {
  // O pedido cruza a fronteira serializado: o selo é só do compilador, e o
  // servidor nunca confia no formato de nada que chega do cliente.
  const op: unknown = (pedido as { op?: unknown } | null)?.op;
  const brutos: unknown = (pedido as { campos?: unknown } | null)?.campos;
  if (!ehOperacaoDeEscrita(op)) return { erro: "Operação desconhecida." };
  const campos: CamposDeEscrita =
    typeof brutos === "object" && brutos !== null
      ? Object.fromEntries(
          Object.entries(brutos as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "string" ? v : "",
          ]),
        )
      : {};

  switch (op) {
    case "nota_criar":
    case "nota_desfazer":
      return notaAdd(campos);
    case "nota_excluir":
      return notaDel(campos);
    case "subtarefa_criar":
      return subtarefaAdd(campos);
    case "relacao_criar":
    case "relacao_desfazer_exclusao":
      return arestaAdd(campos);
    case "relacao_excluir":
    case "relacao_desfazer_criacao":
      return arestaDel(campos);
    case "status":
      return statusSet(campos);
    case "mae":
      return parentSet(campos);
    case "meta":
      return goalSet(campos);
    case "duracao":
      return estimativaSet(campos);
    case "atomos_salvar":
      return atomosSet(campos, false);
    case "atomos_limpar":
      return atomosSet(campos, true);
  }
}

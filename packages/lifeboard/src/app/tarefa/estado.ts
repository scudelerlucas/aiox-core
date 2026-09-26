/**
 * OS-LIFEBOARD · P6 — A LEITURA DA PÁGINA DA TAREFA, EM UM LUGAR SÓ.
 *
 * [ALTO #1, rodada 17] Esta função morava dentro de `[id]/page.tsx`. Ela saiu
 * de lá **sem mudar de conteúdo** porque a guarda de navegador passou a
 * precisar da MESMA leitura para tirar a fotografia do estado antes e depois
 * de cada escrita (ver `tests/navegador/guarda-p6.mjs`, família `P`).
 *
 * Que seja a mesma função importa: se a fotografia viesse de um caminho de
 * leitura próprio, uma sabotagem poderia estragar o que a página lê e deixar a
 * fotografia intacta — a guarda mediria a hipótese outra vez, não o produto.
 * Aqui os dois leem pela mesma porta.
 */

import "server-only";

import { env } from "@/config/env";
import { getSourcesRepository, getTasksRepository } from "@/lib/repositories/factory";
import {
  listarEdgesFixture,
  listarNotesFixture,
  listarTasksFixture,
} from "@/lib/repositories/tasks.fixture-store";
import type { Source, Task, TaskEdge, TaskNote } from "@/types/canonical";

export interface EstadoDaTarefa {
  tasks: Task[];
  edges: TaskEdge[];
  notes: TaskNote[];
  sources: Source[];
}

export async function carregarEstado(): Promise<EstadoDaTarefa> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    const tasksRepo = getTasksRepository();
    const [tasks, edges, notes, sources] = await Promise.all([
      tasksRepo.listAll(),
      tasksRepo.listEdges(),
      tasksRepo.listNotes(),
      getSourcesRepository().listAll(),
    ]);
    return { tasks, edges, notes, sources };
  }
  return {
    tasks: listarTasksFixture(),
    edges: listarEdgesFixture(),
    notes: listarNotesFixture(),
    sources: await getSourcesRepository().listAll(),
  };
}

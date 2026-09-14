/**
 * OS-LIFEBOARD — Repositório LIVE de tasks (Supabase, server-only).
 *
 * Implementa a MESMA `TasksRepository` do fixture (arch §5.2: troca mecânica),
 * backed pela RPC secret-gated `lifeboard_load` (via `loadLifeboardState`). O
 * dashboard e `GET /api/today` não sabem se estão em fixture ou live — só o
 * `factory.ts` decide.
 */

import "server-only";

import { loadLifeboardState } from "@/lib/supabase/live-client";
import type { TasksRepository } from "@/lib/repositories/tasks.fixture";
import type { Task, TaskEdge, TaskNote } from "@/types/canonical";

export class SupabaseTasksRepository implements TasksRepository {
  async listAll(): Promise<Task[]> {
    const { tasks } = await loadLifeboardState();
    return tasks;
  }

  async listEdges(): Promise<TaskEdge[]> {
    const { edges } = await loadLifeboardState();
    return edges;
  }

  async listNotes(): Promise<TaskNote[]> {
    const { notes } = await loadLifeboardState();
    return notes;
  }
}

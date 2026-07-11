/**
 * OS-LIFEBOARD — Factory de repositórios (o flip fixture ↔ live).
 *
 * Ponto ÚNICO que decide a origem dos dados a partir de `env.LIFEBOARD_DATA_MODE`
 * (arch §5.2). Rotas (`/api/today`, `/api/sources`, `/api/health`) e a `page.tsx`
 * obtêm os repositórios daqui — nunca instanciam `FixtureX`/`SupabaseX` direto.
 * Trocar de fixture (dev/test) para live (produção) = mudar a env, zero código.
 *
 * server-only: importa os repositórios Supabase (que carregam credenciais). Não
 * deve ser importado de Client Components.
 */

import "server-only";

import { env } from "@/config/env";
import {
  FixtureSourcesRepository,
  type SourcesRepository,
} from "@/lib/repositories/sources.fixture";
import { SupabaseSourcesRepository } from "@/lib/repositories/sources.supabase";
import {
  FixtureTasksRepository,
  type TasksRepository,
} from "@/lib/repositories/tasks.fixture";
import { SupabaseTasksRepository } from "@/lib/repositories/tasks.supabase";

export function getTasksRepository(): TasksRepository {
  return env.LIFEBOARD_DATA_MODE === "live"
    ? new SupabaseTasksRepository()
    : new FixtureTasksRepository();
}

export function getSourcesRepository(): SourcesRepository {
  return env.LIFEBOARD_DATA_MODE === "live"
    ? new SupabaseSourcesRepository()
    : new FixtureSourcesRepository();
}

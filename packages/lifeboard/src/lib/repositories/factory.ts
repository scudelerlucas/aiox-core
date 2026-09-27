/**
 * OS-LIFEBOARD — Factory de repositórios (o flip fixture ↔ live).
 *
 * Ponto ÚNICO que decide a origem dos dados a partir de `env.LIFEBOARD_DATA_MODE`
 * (arch §5.2). Rotas (`/api/today`, `/api/sources`, `/api/health`) e a `page.tsx`
 * obtêm os repositórios daqui — nunca instanciam `FixtureX`/`SupabaseX` direto.
 * Trocar de fixture (dev/test) para live (produção) = mudar a env, zero código.
 *
 * Desde 25/09/2026 (Tarefa Codex 01) o par devolvido une ao grafo as frentes —
 * mudanças, branches e conversas de `painel_frentes_*` — materializadas como
 * tarefas ligadas (`@/lib/frentes/no-grafo`). É o mesmo caminho de leitura de
 * sempre; `LIFEBOARD_FRENTES_NO_GRAFO=off` devolve os repositórios puros.
 *
 * server-only: importa os repositórios Supabase (que carregam credenciais). Não
 * deve ser importado de Client Components.
 */

import "server-only";

import * as React from "react";

import { env } from "@/config/env";
import { criarRepositoriosComFrentes, type RepositoriosBase } from "@/lib/frentes/no-grafo";
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

function repositoriosBase(): RepositoriosBase {
  return env.LIFEBOARD_DATA_MODE === "live"
    ? { tasks: new SupabaseTasksRepository(), sources: new SupabaseSourcesRepository() }
    : { tasks: new FixtureTasksRepository(), sources: new FixtureSourcesRepository() };
}

/**
 * `React.cache` só existe no React que o Next empacota (canary/react-server);
 * no `react` puro que o Vitest carrega ele é `undefined` — `live-client.ts` já
 * tropeçou nisso e por isso é stubado em vários testes. Aqui a ausência vira
 * passagem direta em vez de quebrar o import.
 */
type MemoPorRequest = <T>(fn: () => T) => () => T;
const memoPorRequest: MemoPorRequest = (fn) => {
  const cache = (React as unknown as { cache?: MemoPorRequest }).cache;
  return typeof cache === "function" ? cache(fn) : fn;
};

/**
 * Um par por request: a home pede tarefas e fontes em duas chamadas, e as
 * frentes são lidas UMA vez para as duas. Fora do Next cada chamada monta o
 * próprio par (duas leituras, nenhum erro).
 */
const parComFrentes = memoPorRequest((): RepositoriosBase =>
  criarRepositoriosComFrentes(repositoriosBase()),
);

export function getTasksRepository(): TasksRepository {
  return env.FRENTES_NO_GRAFO ? parComFrentes().tasks : repositoriosBase().tasks;
}

export function getSourcesRepository(): SourcesRepository {
  return env.FRENTES_NO_GRAFO ? parComFrentes().sources : repositoriosBase().sources;
}

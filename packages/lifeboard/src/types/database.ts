/**
 * OS-LIFEBOARD — Tipos do banco Supabase (espelho de `supabase/migrations/0001_init.sql`).
 *
 * Gerado MANUALMENTE nesta rodada (não há conexão com o Supabase real —
 * `supabase gen types` roda só após a migration ser aplicada de verdade).
 * Mantém os nomes de coluna em snake_case do Postgres nas linhas `Row`.
 * O mapeamento para camelCase (`Source`, `Task`, ...) vive em `@/types/canonical`
 * (architecture.md §5.1); este arquivo é a fronteira crua com o Postgres.
 *
 * Ao aplicar a migration de verdade, substituir por:
 *   supabase gen types typescript --project-id hciiilopyivjaekaxfqp > src/types/database.ts
 * e conferir que o resultado bate com este espelho.
 */

export type SourceKind =
  | "calendar"
  | "gmail"
  | "drive"
  | "notes"
  | "claude_chat";

export type AuthMode = "api" | "manual";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";

/** priority_hierarq jsonb {s1,s2,s3} — insumo do motor HIERARQ (camada O). */
export interface HierarqScore {
  s1: number;
  s2: number;
  s3: number;
}

// ---------------------------------------------------------------------------
// Row / Insert / Update por tabela
// ---------------------------------------------------------------------------

export interface SourcesRow {
  id: string; // uuid, default gen_random_uuid()
  kind: SourceKind; // check in ('calendar','gmail','drive','notes','claude_chat')
  label: string | null;
  auth_mode: AuthMode; // check in ('api','manual')
  last_sync_at: string | null; // timestamptz (ISO)
  owner: string; // uuid, default auth.uid()
  created_at: string; // timestamptz, default now()
}

export type SourcesInsert = {
  id?: string;
  kind: SourceKind;
  label?: string | null;
  auth_mode: AuthMode;
  last_sync_at?: string | null;
  owner?: string;
  created_at?: string;
};

export type SourcesUpdate = Partial<SourcesInsert>;

export interface ProjectsRow {
  id: string; // uuid
  source_id: string; // uuid, FK → sources.id (on delete cascade)
  external_ref: string | null; // parte de uq_projects_source_extref
  title: string | null;
  status: string | null;
  updated_at: string; // timestamptz, touch trigger
  owner: string; // uuid, default auth.uid()
  created_at: string; // timestamptz, default now()
}

export type ProjectsInsert = {
  id?: string;
  source_id: string;
  external_ref?: string | null;
  title?: string | null;
  status?: string | null;
  updated_at?: string;
  owner?: string;
  created_at?: string;
};

export type ProjectsUpdate = Partial<ProjectsInsert>;

export interface TasksRow {
  id: string; // uuid
  project_id: string | null; // uuid, FK → projects.id (on delete cascade)
  title: string | null;
  notes: string | null;
  due_date: string | null; // timestamptz (indexado)
  status: TaskStatus; // default 'open', check in (...)
  priority_hierarq: HierarqScore; // jsonb, default {s1:1,s2:1,s3:1}
  predecessor_ids: string[]; // uuid[], default '{}'
  successor_ids: string[]; // uuid[], default '{}'
  source_id: string | null; // uuid, FK → sources.id (on delete cascade)
  external_ref: string | null; // parte de uq_tasks_source_extref
  updated_at: string; // timestamptz, touch trigger
  owner: string; // uuid, default auth.uid()
  created_at: string; // timestamptz, default now()
}

export type TasksInsert = {
  id?: string;
  project_id?: string | null;
  title?: string | null;
  notes?: string | null;
  due_date?: string | null;
  status?: TaskStatus;
  priority_hierarq?: HierarqScore;
  predecessor_ids?: string[];
  successor_ids?: string[];
  source_id?: string | null;
  external_ref?: string | null;
  updated_at?: string;
  owner?: string;
  created_at?: string;
};

export type TasksUpdate = Partial<TasksInsert>;

export interface SyncLogRow {
  id: string; // uuid
  source_id: string; // uuid, FK → sources.id (on delete cascade)
  run_at: string; // timestamptz, default now()
  items_ingested: number; // int, default 0
  ok: boolean; // default false
  error: string | null;
  owner: string; // uuid, default auth.uid()
  created_at: string; // timestamptz, default now()
}

export type SyncLogInsert = {
  id?: string;
  source_id: string;
  run_at?: string;
  items_ingested?: number;
  ok?: boolean;
  error?: string | null;
  owner?: string;
  created_at?: string;
};

export type SyncLogUpdate = Partial<SyncLogInsert>;

// ---------------------------------------------------------------------------
// Estrutura `Database` no formato esperado pelo supabase-js
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: SourcesRow;
        Insert: SourcesInsert;
        Update: SourcesUpdate;
      };
      projects: {
        Row: ProjectsRow;
        Insert: ProjectsInsert;
        Update: ProjectsUpdate;
      };
      tasks: {
        Row: TasksRow;
        Insert: TasksInsert;
        Update: TasksUpdate;
      };
      sync_log: {
        Row: SyncLogRow;
        Insert: SyncLogInsert;
        Update: SyncLogUpdate;
      };
    };
    Views: Record<never, never>;
    Functions: {
      /** trigger fn; sem invocação direta pelo cliente (documentada p/ completude). */
      lifeboard_check_task_dag: {
        Args: Record<never, never>;
        Returns: unknown;
      };
    };
    Enums: Record<never, never>;
  };
}

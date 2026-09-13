import type { EstadoPr } from "@/lib/frentes/types";
import type { SourceKind, TaskStatus } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P5 — Contrato server → client da Linha do Tempo (Gantt).
 *
 * Tipo PLANO e SERIALIZÁVEL (só string/number/boolean/array), no mesmo espírito
 * de `GrafoV3Props` (`@/types/grafo-v3`): o servidor (`app/linha-do-tempo/page.tsx`)
 * calcula tudo com `montarLinhaDoTempo` (`core/timeline/linha-do-tempo.ts`,
 * server-only) e desce este objeto pronto para o Client Component
 * `LinhaDoTempoView`. Datas são strings ISO de calendário (`AAAA-MM-DD`), nunca
 * `Date` (não serializa por padrão como prop de Client Component).
 *
 * Fonte da regra de montagem: hub,
 * `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md` §7–§8, e o pedido
 * original do operador ("Gantt com predecessores e sucessores").
 */

/** Uma linha do grupo "Assuntos" — um PR/frente de `painel_frentes_prs`. */
export interface LinhaDoTempoAssuntoRow {
  kind: "assunto";
  /** `${repo}#${numero}` — estável e único no quadro. */
  id: string;
  titulo: string;
  repo: string;
  /** ISO `AAAA-MM-DD`. `criado_em` (ou `atualizado_em` na falta dela). */
  inicio: string;
  /** ISO `AAAA-MM-DD`. `mergeado_em`, ou hoje se ainda aberto, ou `fechado_em`. */
  fim: string;
  /** `true` quando o assunto ainda está aberto (barra termina "em aberto", em hoje). */
  aberto: boolean;
  estado: EstadoPr;
  url: string;
  /**
   * P5b (achado MÉDIO #13): `criado_em`/`mergeado_em`/`fechado_em`/`atualizado_em`
   * que não parseiam como data (`"abc"` vindo torto do banco) — nunca vira
   * silenciosamente "hoje". `inicio`/`fim` caem para `hoje` só para o tipo não
   * quebrar; a tela nunca desenha barra, só o aviso "data inválida".
   */
  dataInvalida: boolean;
  /**
   * P5b (achado ALTO #8): `fim < inicio` de verdade (`mergeado_em < criado_em`)
   * — nunca vira `Math.max(4, negativo)` fingindo uma barra de 4px. Row
   * marcada, sem barra.
   */
  datasInconsistentes: boolean;
  /** P5b (achado ALTO #8): `inicio === fim` (PR do mesmo dia) — losango, nunca 4px. */
  marco: boolean;
}

/** Uma linha do grupo "Tarefas" — uma `Task`, com a janela do CPM quando houver. */
export interface LinhaDoTempoTarefaRow {
  kind: "tarefa";
  id: string;
  titulo: string;
  /** ISO `AAAA-MM-DD`. */
  inicio: string;
  /** ISO `AAAA-MM-DD`. Fim "duro": `ef` do CPM, ou `inicio + estimativaDias` fora dele. */
  fim: string;
  /**
   * ISO `AAAA-MM-DD`. Igual a `fim` quando a tarefa está fora do CPM ou tem folga
   * zero; senão é `inicio-do-CPM + lf` — a extensão tênue de folga desenhada
   * depois de `fim`.
   */
  fimComFolga: string;
  /** `true` quando o id está em `ResultadoCPM.critico` (folga zero até o goal). */
  critico: boolean;
  /** Folga em dias (`JanelaCPM.folga`). 0 para tarefa fora do subgrafo do goal. */
  folga: number;
  /** `true` quando a tarefa não tem `estimativaDias` válida (dentro ou fora do CPM). */
  semDuracao: boolean;
  /** Ids de predecessoras (união de 3 fontes — mesma regra do CPM). */
  predecessores: string[];
  /** Ids de sucessoras (união de 3 fontes — mesma regra do CPM). */
  sucessores: string[];
  /** Score de assimetria (`ScoreAssimetria.valor`), quando declarado. */
  score?: number;
  /** Fonte da tarefa — mesma cor do grafo (`corDaFonte`), para o olho ligar as duas telas. */
  fonteKind: SourceKind;
  status: TaskStatus;
  /**
   * `true` quando a tarefa não é ancestral do goal do CPM (fora do caminho
   * crítico por construção, nunca por folga) — a barra nasce de `iniciadoEm`
   * (ou hoje) + `estimativaDias`, sem `es/ef/ls/lf`.
   */
  foraDoCpm: boolean;
  /**
   * P5b (achado ALTO #4/#8) — flags que MUDAM o desenho, não só o `title`:
   * `marco` (duração zero → losango), `semBarra` (tarefa `done` fora do CPM
   * sem `iniciadoEm`/data nenhuma → nada ou um ponto em `pontoConcluidoEm`),
   * `datasInconsistentes` (fim < início → erro, sem barra), `atrasada`
   * (`dueDate` no passado e não `done` → contorno vermelho + marcador em
   * `dueDate`). Fonte: hub, `docs/ops/LIFEBOARD-V3-4z-atomos-e-gargalo-2026-09-13.md` §7–§8.
   */
  marco: boolean;
  datasInconsistentes: boolean;
  /** `true` quando a tarefa é `done`, fora do CPM: nunca ganha barra fabricada — só o ponto (ou nada). */
  semBarra: boolean;
  /** ISO `AAAA-MM-DD` do ponto "concluída", quando `semBarra` e há data válida (`updatedAt`); `null` = nada a desenhar. */
  pontoConcluidoEm: string | null;
  /** `true` quando `dueDate` já passou e a tarefa não está `done`. */
  atrasada: boolean;
  /** ISO `AAAA-MM-DD` de `dueDate`, quando válida; `null` senão. Usado para o marcador de atraso. */
  dueDate: string | null;
}

export type LinhaDoTempoRow = LinhaDoTempoAssuntoRow | LinhaDoTempoTarefaRow;

export interface LinhaDoTempoGrupo {
  titulo: "Assuntos" | "Tarefas";
  linhas: LinhaDoTempoRow[];
}

export interface LinhaDoTempoProps {
  /** ISO `AAAA-MM-DD` usado como dia 0 do CPM — a linha vertical "hoje". */
  hoje: string;
  grupos: LinhaDoTempoGrupo[];
  goalId: string | null;
  /** Duração total do caminho crítico, em dias (`ResultadoCPM.duracaoTotal`). */
  duracaoTotal: number;
}

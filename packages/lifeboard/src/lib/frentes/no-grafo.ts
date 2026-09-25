/**
 * FRENTES NO GRAFO — a junção, no mesmo caminho que hoje carrega o grafo.
 *
 * `getTasksRepository()`/`getSourcesRepository()` (factory) passam a devolver
 * estes dois repositórios, que unem o que vem do banco (`tasks`, `task_edges`,
 * `sources`) ao que a materialização pura (`materializar.ts`) tira das frentes.
 * Nada é gravado de volta: `painel_*` são só leitura, `tasks` não recebe linha
 * nenhuma — a união acontece na leitura, a cada carregamento.
 *
 * Três cuidados, todos por causa de erro medido em produção:
 *  • a leitura das frentes vai na identidade de quem está logado (RLS). Quando
 *    não há gente logada (`/api/health` batido pelo vigia, por exemplo) ou a
 *    RLS não libera a conta, a leitura falha — e o grafo NÃO pode cair junto:
 *    a falha vira um aviso no log e o painel segue só com o que `tasks` tem
 *    (`/api/health` continua `degraded`, nunca `down`);
 *  • se algum dia essas tarefas forem gravadas em `tasks` (a chave
 *    `(source_id, external_ref)` já é única lá), a linha do banco vence a
 *    materializada — sem cartão em dobro e com as arestas seguindo o id real;
 *  • a fonte de cada tarefa é a linha real de `sources` quando ela existe; se
 *    não existe, entra uma fonte "virtual" com o id determinístico de sempre e
 *    o frescor lido de `painel_frentes_sync` — o filtro por fonte e o
 *    `/api/health` enxergam GitHub e conversas sem migration nenhuma.
 */

import "server-only";

import {
  idDaFontePadrao,
  materializarFrentes,
  type Materializacao,
} from "@/lib/frentes/materializar";
import { getFrentesRepository } from "@/lib/frentes/repository";
import type { DadosFrentes } from "@/lib/frentes/types";
import type { SourcesRepository } from "@/lib/repositories/sources.fixture";
import type { TasksRepository } from "@/lib/repositories/tasks.fixture";
import type { Source, SourceKind, Task, TaskEdge } from "@/types/canonical";

/** O que o grafo lê, já unido. */
export interface GrafoUnido {
  tasks: Task[];
  edges: TaskEdge[];
  sources: Source[];
}

/**
 * União PURA: base (banco) + frentes materializadas. Quem já está em `tasks`
 * pela mesma chave `(sourceId, externalRef)` vence; as arestas das frentes são
 * remapeadas para o id vencedor e só entram se as duas pontas existem.
 */
export function unirFrentesAoGrafo(
  base: GrafoUnido,
  dados: DadosFrentes,
  agora: number,
): GrafoUnido {
  const fontePorKind = new Map<SourceKind, Source>();
  for (const s of base.sources) {
    if (!fontePorKind.has(s.kind)) fontePorKind.set(s.kind, s);
  }
  const idDaFonte = (kind: SourceKind): string =>
    fontePorKind.get(kind)?.id ?? idDaFontePadrao(kind);

  const frentes: Materializacao = materializarFrentes(dados, { agora, idDaFonte });

  // Fontes que faltam no banco entram virtuais, com o frescor das frentes.
  const sources = [...base.sources];
  for (const f of frentes.fontes) {
    if (fontePorKind.has(f.kind)) continue;
    sources.push({
      id: idDaFonte(f.kind),
      kind: f.kind,
      label: f.label,
      authMode: "api",
      lastSyncAt: f.lastSyncAt,
    });
  }

  // Tarefas: a linha do banco vence a materializada pela mesma chave lógica.
  const idPorChave = new Map<string, string>();
  for (const t of base.tasks) idPorChave.set(`${t.sourceId}|${t.externalRef}`, t.id);
  const mapaId = new Map<string, string>(); // id materializado → id final
  const tasks = [...base.tasks];
  for (const t of frentes.tasks) {
    const existente = idPorChave.get(`${t.sourceId}|${t.externalRef}`);
    if (existente) {
      mapaId.set(t.id, existente);
      continue;
    }
    mapaId.set(t.id, t.id);
    tasks.push(t);
  }

  // Arestas: remapeia as pontas; só entra o que liga duas tarefas presentes e
  // ainda não está declarado no banco.
  const ids = new Set(tasks.map((t) => t.id));
  const declaradas = new Set(base.edges.map((e) => `${e.origem}|${e.destino}|${e.tipo}`));
  const edges = [...base.edges];
  const porId = new Map(tasks.map((t) => [t.id, t] as const));
  for (const e of frentes.edges) {
    const origem = mapaId.get(e.origem) ?? e.origem;
    const destino = mapaId.get(e.destino) ?? e.destino;
    if (origem === destino || !ids.has(origem) || !ids.has(destino)) continue;
    const chave = `${origem}|${destino}|${e.tipo}`;
    if (declaradas.has(chave)) continue;
    declaradas.add(chave);
    edges.push({ ...e, origem, destino });
    // A tarefa que veio do banco não tem os arrays das frentes: espelha aqui,
    // sem mexer no objeto original do repositório base.
    const de = porId.get(origem);
    const para = porId.get(destino);
    if (de && !de.successorIds.includes(destino)) {
      porId.set(origem, { ...de, successorIds: [...de.successorIds, destino] });
    }
    if (para && !para.predecessorIds.includes(origem)) {
      porId.set(destino, { ...para, predecessorIds: [...para.predecessorIds, origem] });
    }
  }
  // Arrays dos materializados apontavam para ids materializados: remapeia.
  const remapeia = (lista: string[]): string[] =>
    [...new Set(lista.map((id) => mapaId.get(id) ?? id).filter((id) => ids.has(id)))].sort();
  const tasksFinais = tasks.map((t) => {
    const atual = porId.get(t.id) ?? t;
    return {
      ...atual,
      predecessorIds: remapeia(atual.predecessorIds),
      successorIds: remapeia(atual.successorIds),
    };
  });

  return { tasks: tasksFinais, edges, sources };
}

/** Os dois repositórios base que a junção envolve. */
export interface RepositoriosBase {
  tasks: TasksRepository;
  sources: SourcesRepository;
}

/** Como ler as frentes — injetável para o teste não precisar de Supabase. */
export type LeitorDeFrentes = () => Promise<DadosFrentes>;

/**
 * Cria o par (tarefas, fontes) que devolve o grafo unido. A leitura acontece UMA
 * vez por par, na primeira chamada, e é compartilhada pelos dois repositórios.
 */
export function criarRepositoriosComFrentes(
  base: RepositoriosBase,
  lerFrentes: LeitorDeFrentes = () => getFrentesRepository().carregar(),
  agora: () => number = Date.now,
): RepositoriosBase {
  let promessa: Promise<GrafoUnido> | null = null;

  const carregar = (): Promise<GrafoUnido> => {
    if (promessa) return promessa;
    promessa = (async () => {
      const [tasks, edges, sources] = await Promise.all([
        base.tasks.listAll(),
        base.tasks.listEdges(),
        base.sources.listAll(),
      ]);
      const grafo: GrafoUnido = { tasks, edges, sources };
      let dados: DadosFrentes;
      try {
        dados = await lerFrentes();
      } catch (erro) {
        // Frentes indisponíveis (sem login, RLS fechada, rede) não derrubam o
        // grafo: segue só com o que `tasks` tem, e o log diz por quê.
        console.warn("[frentes-no-grafo] não deu para ler as frentes; grafo segue sem elas:", erro);
        return grafo;
      }
      return unirFrentesAoGrafo(grafo, dados, agora());
    })();
    return promessa;
  };

  const tasks: TasksRepository = {
    async listAll() {
      return (await carregar()).tasks;
    },
    async listEdges() {
      return (await carregar()).edges;
    },
    listNotes() {
      return base.tasks.listNotes();
    },
  };

  const sources: SourcesRepository = {
    async listAll() {
      return (await carregar()).sources;
    },
    listSyncLogs() {
      return base.sources.listSyncLogs();
    },
  };

  return { tasks, sources };
}

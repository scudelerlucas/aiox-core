/**
 * OS-LIFEBOARD · P4 — GET /api/grafo-bruto  (achado ALTO 1 da rodada 13)
 *
 * O DADO CRU do grafo do dia, por um caminho que **não passa pelo componente
 * que desenha**: as tarefas com as duas listas de precedência, as arestas
 * declaradas como o repositório as entrega, e o resultado do CPM (quem está no
 * caminho crítico, qual é o goal, quanto dura).
 *
 * Existe para que uma medição externa possa DERIVAR o universo de arestas que
 * o canvas deve desenhar — em vez de perguntar ao canvas o que ele acha que
 * devia desenhar. Até a rodada 12 as duas coisas saíam da mesma variável do
 * mesmo `useMemo`, e um erro acima dela era publicado como "o dado" e depois
 * confirmado pelo desenho.
 *
 * Leitura pura, sem efeito nenhum. Mesmo estilo de `GET /api/today`: tipos Web
 * padrão, sem acoplar a `next/server`.
 */

import { montarGrafoDoDia } from "@/core/prioritize/grafo-do-dia";
import { getTasksRepository } from "@/lib/repositories/factory";

export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(): Promise<Response> {
  try {
    const repo = getTasksRepository();
    const [tasks, edges] = await Promise.all([repo.listAll(), repo.listEdges()]);
    const { goalId, cpm } = montarGrafoDoDia(tasks, edges);

    return jsonResponse({
      tarefas: tasks.map((t) => ({
        id: t.id,
        titulo: t.title,
        predecessorIds: t.predecessorIds,
        successorIds: t.successorIds,
        status: t.status,
      })),
      arestas: edges.map((e) => ({
        id: e.id,
        origem: e.origem,
        destino: e.destino,
        tipo: e.tipo,
        peso: e.peso,
      })),
      critico: [...cpm.critico],
      emCiclo: [...cpm.emCiclo],
      goalId,
      duracaoTotal: cpm.duracaoTotal,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: "grafo_bruto_failed",
          message: `Falha ao ler o grafo do dia: ${
            error instanceof Error ? error.message : "desconhecido"
          }`,
          timestamp: new Date().toISOString(),
        },
      },
      500,
    );
  }
}

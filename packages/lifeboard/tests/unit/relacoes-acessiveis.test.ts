import { describe, expect, it } from "vitest";

import {
  camadaBaseDeAresta,
  CAMADAS_TODAS,
  CAMADA_LABEL,
  construirArestasVisuais,
  relacoesAcessiveisDaTarefa,
} from "@/lib/camadas-do-grafo";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 — achado ALTO 3 do crítico hostil da rodada 10:
 * *"teclado e leitor de tela alcançam 1 das 5 camadas"*.
 *
 * Era verdade. A lista acessível do grafo lia `predecessorIds` e
 * `successorIds` da tarefa — as duas listas que só conhecem a SUCESSÃO — e
 * correlação, sinergia, obsolescência e caminho crítico não existiam ali.
 * Quem não usa mouse recebia 1/5 do grafo, e nenhuma guarda dizia isso porque
 * nenhuma comparava as duas superfícies.
 *
 * Este é o teste BARATO da mesma lei (a cara é a guarda no navegador, §10, que
 * casa aresta por aresta o que o canvas desenha com o que a lista diz). Aqui o
 * universo é `CAMADAS_TODAS`: uma camada nova entra sozinha, e se ela não
 * chegar à lista acessível o teste fica vermelho sem ninguém editar nada.
 */
function tarefa(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    projectId: "p",
    title: `título de ${id}`,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: { s1: 1, s2: 1, s3: 1 },
    predecessorIds: [],
    successorIds: [],
    sourceId: "s",
    externalRef: id,
    updatedAt: "2026-09-22T00:00:00.000Z",
    ...extra,
  };
}

function aresta(o: Partial<TaskEdge> & Pick<TaskEdge, "origem" | "destino" | "tipo">): TaskEdge {
  return {
    id: `${o.origem}->${o.destino}`,
    peso: 1,
    nota: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    ...o,
  };
}

/** Um grafo em que a tarefa "meio" toca TODAS as camadas de uma vez. */
const TAREFAS = [
  tarefa("antes", { successorIds: ["meio"] }),
  tarefa("meio", { predecessorIds: ["antes"], successorIds: ["depois"] }),
  tarefa("depois", { predecessorIds: ["meio"] }),
  tarefa("parceira"),
  tarefa("sinergica"),
  tarefa("velha"),
  tarefa("sozinha"),
];
const ARESTAS: TaskEdge[] = [
  aresta({ origem: "meio", destino: "parceira", tipo: "correlacao" }),
  aresta({ origem: "meio", destino: "sinergica", tipo: "sinergia", peso: 0.4 }),
  aresta({ origem: "meio", destino: "velha", tipo: "obsolescencia" }),
];

const visuais = construirArestasVisuais({
  tasks: TAREFAS,
  edges: ARESTAS,
  criticoIds: ["antes", "meio", "depois"],
});

const tituloDe = (id: string): string => TAREFAS.find((t) => t.id === id)?.title ?? id;

describe("relacoesAcessiveisDaTarefa", () => {
  it("alcança TODAS as camadas de CAMADAS_TODAS, não só a sucessão", () => {
    const relacoes = relacoesAcessiveisDaTarefa({ taskId: "meio", arestas: visuais, tituloDe });
    const alcancadas = relacoes.map((r) => r.camada).sort();
    expect(alcancadas).toEqual([...CAMADAS_TODAS].sort());
  });

  it("nomeia a camada com o MESMO rótulo do painel e diz o título do outro lado", () => {
    const relacoes = relacoesAcessiveisDaTarefa({ taskId: "meio", arestas: visuais, tituloDe });
    for (const r of relacoes) {
      expect(r.rotulo).toBe(CAMADA_LABEL[r.camada]);
      expect(r.itens.length).toBeGreaterThan(0);
    }
    const porCamada = new Map(relacoes.map((r) => [r.camada, r.itens.join(" ")]));
    expect(porCamada.get("correlacao")).toContain("título de parceira");
    expect(porCamada.get("sinergia")).toContain("título de sinergica");
    expect(porCamada.get("obsolescencia")).toContain("título de velha");
    expect(porCamada.get("critico")).toContain("título de antes");
  });

  it("a sucessão diz a DIREÇÃO, que é a informação dela", () => {
    const relacoes = relacoesAcessiveisDaTarefa({ taskId: "meio", arestas: visuais, tituloDe });
    const sucessao = relacoes.find((r) => r.camada === "sucessao")?.itens ?? [];
    expect(sucessao).toContain("depende de título de antes");
    expect(sucessao).toContain("habilita título de depois");
  });

  it("tarefa sem nenhuma aresta devolve lista vazia — nunca uma camada inventada", () => {
    expect(relacoesAcessiveisDaTarefa({ taskId: "sozinha", arestas: visuais, tituloDe })).toEqual([]);
  });

  it("toda aresta do canvas aparece em ALGUMA das duas pontas (a régua da §10)", () => {
    expect(visuais.length).toBeGreaterThan(0);
    for (const a of visuais) {
      const base = camadaBaseDeAresta(a);
      const achou = [
        { eu: a.origem, outro: a.destino },
        { eu: a.destino, outro: a.origem },
      ].some(({ eu, outro }) =>
        relacoesAcessiveisDaTarefa({ taskId: eu, arestas: visuais, tituloDe }).some(
          (r) => r.camada === base && r.itens.join(" ").includes(tituloDe(outro)),
        ),
      );
      expect(achou, `aresta ${a.id} fora da lista acessível`).toBe(true);
    }
  });
});

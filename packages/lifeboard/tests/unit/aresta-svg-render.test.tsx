import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ArestaSvgGroup, type ArestaSvgSpec } from "@/components/graph/aresta-svg";
import {
  camadaBaseDeAresta,
  construirArestasVisuais,
  filtrarArestasPorCamada,
  type ArestaVisual,
} from "@/lib/camadas-do-grafo";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 — render test (item 4 da spec): `ArestaSvgGroup` é o MESMO
 * componente que `V3Edge` usa dentro do ReactFlow em produção — só que aqui
 * instanciado direto, com coordenadas fixas, porque um spike confirmou que
 * `renderToStaticMarkup` não hidrata nós/arestas do ReactFlow (o `react-flow__nodes`
 * fica vazio sem o efeito de `ResizeObserver`, que não roda fora do navegador).
 * Decisão registrada no cabeçalho de `aresta-svg.tsx`.
 */
function grupo(spec: ArestaSvgSpec): JSX.Element {
  return <ArestaSvgGroup path="M0,0 L100,100" midX={50} midY={50} endX={100} endY={100} spec={spec} />;
}

describe("ArestaSvgGroup — as 6 arestas no SVG", () => {
  it("uma aresta crítica por caminho crítico ganha exatamente 3 <path> e a classe de traço triplo", () => {
    const especCritica: ArestaSvgSpec = { id: "e1", camada: "sucessao", critica: true, destacadaPeloSelecionado: false };
    const html = renderToStaticMarkup(
      <svg>
        {grupo(especCritica)}
        {grupo({ ...especCritica, id: "e2" })}
      </svg>,
    );
    const grupos = html.match(/class="lb-edge lb-edge-sucessao lb-edge-critico-triplo"/g) ?? [];
    expect(grupos).toHaveLength(2); // "uma aresta triplo-vermelha por aresta crítica"
    const paths = html.match(/<path/g) ?? [];
    expect(paths).toHaveLength(6); // 3 <path> por grupo × 2 grupos
  });

  it("obsolescência desenha o ❌ no fim da aresta", () => {
    const spec: ArestaSvgSpec = { id: "e3", camada: "obsolescencia", critica: false, destacadaPeloSelecionado: false };
    const html = renderToStaticMarkup(<svg>{grupo(spec)}</svg>);
    expect(html).toContain("❌");
    expect(html).toContain("lb-edge-marca-obsolescencia");
    expect(html).toContain("#FF7A6B"); // aresta.obsolescencia
  });

  it("sinergia é pontilhada, roxa, e mostra o rótulo '50%'", () => {
    const spec: ArestaSvgSpec = {
      id: "e4",
      camada: "sinergia",
      critica: false,
      destacadaPeloSelecionado: false,
      pesoPercent: 50,
    };
    const html = renderToStaticMarkup(<svg>{grupo(spec)}</svg>);
    expect(html).toContain(">50%<");
    expect(html).toContain("#C58CFF"); // aresta.sinergia
    expect(html).toMatch(/stroke-dasharray="3 4"/);
  });

  it("correlação é pontilhada e SEM rótulo de %", () => {
    const spec: ArestaSvgSpec = { id: "e5", camada: "correlacao", critica: false, destacadaPeloSelecionado: false };
    const html = renderToStaticMarkup(<svg>{grupo(spec)}</svg>);
    expect(html).toMatch(/stroke-dasharray="4 5"/);
    expect(html).not.toContain("lb-edge-label-sinergia");
  });

  it("sucessão destacada pelo nó selecionado fica amarela (token aresta.predecessor)", () => {
    const spec: ArestaSvgSpec = { id: "e6", camada: "sucessao", critica: false, destacadaPeloSelecionado: true };
    const html = renderToStaticMarkup(<svg>{grupo(spec)}</svg>);
    expect(html).toContain("#F7CE73");
    expect(html).toContain("lb-edge-destacada");
  });
});

describe("filtrarArestasPorCamada + render — toggle remove a aresta do SVG", () => {
  function task(id: string, overrides: Partial<Task> = {}): Task {
    return {
      id,
      projectId: "p",
      title: id,
      notes: null,
      dueDate: null,
      status: "open",
      priorityHierarq: { s1: 1, s2: 1, s3: 1 },
      predecessorIds: [],
      successorIds: [],
      sourceId: "s",
      externalRef: id,
      updatedAt: "2026-09-13T00:00:00.000Z",
      ...overrides,
    };
  }
  const tasks = [task("A"), task("B")];
  const edges: TaskEdge[] = [
    { id: "e", origem: "A", destino: "B", tipo: "sinergia", peso: 0.5, nota: null, createdAt: "2026-09-13T00:00:00.000Z" },
  ];

  function renderCamadas(visuais: ArestaVisual[]): string {
    return renderToStaticMarkup(
      <svg>
        {visuais.map((v) => (
          <g key={v.id}>
            {grupo({
              id: v.id,
              camada: camadaBaseDeAresta(v),
              critica: false,
              destacadaPeloSelecionado: v.destacadaPeloSelecionado,
              pesoPercent: v.pesoPercent,
            })}
          </g>
        ))}
      </svg>,
    );
  }

  it("com 'sinergia' ativa, a aresta aparece no SVG (com o rótulo 50%)", () => {
    const visuais = construirArestasVisuais({ tasks, edges, criticoIds: [] });
    const visiveis = filtrarArestasPorCamada(visuais, new Set(["sinergia"]));
    expect(renderCamadas(visiveis)).toContain(">50%<");
  });

  it("desligando 'sinergia', o filtro puro já remove a aresta ANTES do render — SVG some com ela", () => {
    const visuais = construirArestasVisuais({ tasks, edges, criticoIds: [] });
    const visiveis = filtrarArestasPorCamada(visuais, new Set(["sucessao", "critico"]));
    expect(visiveis).toHaveLength(0);
    expect(renderCamadas(visiveis)).not.toContain("50%");
  });
});

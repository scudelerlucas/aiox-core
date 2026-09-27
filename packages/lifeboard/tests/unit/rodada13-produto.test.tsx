import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ArestaSvgGroup,
  OPACIDADE_DA_ARESTA_ESMAECIDA,
  type ArestaSvgSpec,
} from "@/components/graph/aresta-svg";
import {
  construirArestasVisuais,
  relacoesAcessiveisDaTarefa,
  type ArestaVisual,
} from "@/lib/camadas-do-grafo";
import {
  AFASTAMENTO_DO_ROTULO_MUNDO,
  caixaDoRotulo,
  colocarRotulos,
  segmentoCruzaRetangulo,
  type PedidoDeRotulo,
} from "@/lib/rotulo-da-aresta";
import { FIXTURE_EDGES, FIXTURE_TASKS } from "@/lib/repositories/tasks.fixture";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 rodada 13 — as quatro correções de PRODUTO desta rodada,
 * medidas onde elas moram (a guarda de navegador mede as mesmas quatro na
 * tela; isto aqui é o lado barato e determinístico).
 */

describe("MÉDIO 7 — a aresta esmaecida esmaece no `<g>`, onde o compositor vê", () => {
  const base: ArestaSvgSpec = {
    id: "e1",
    origem: "a",
    destino: "b",
    camada: "sucessao",
    critica: false,
    destacadaPeloSelecionado: false,
  };
  const html = (spec: ArestaSvgSpec): string =>
    renderToStaticMarkup(
      <svg>
        <ArestaSvgGroup path="M0,0 L100,100" midX={50} midY={50} endX={100} endY={100} spec={spec} />
      </svg>,
    );

  it("com as duas pontas fora do filtro, o grupo sai com opacidade — não com um `style` que ninguém aplica", () => {
    const saida = html({ ...base, esmaecida: true });
    expect(saida).toContain(`opacity="${String(OPACIDADE_DA_ARESTA_ESMAECIDA)}"`);
    expect(saida).toContain('data-esmaecida="true"');
  });

  it("sem filtro, nada de opacidade e nada de se declarar esmaecida", () => {
    const saida = html(base);
    expect(saida).not.toContain("opacity=");
    expect(saida).toContain('data-esmaecida="false"');
  });
});

describe("BAIXO 13 — o rótulo de sinergia sai de cima do próprio traço", () => {
  const traco = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
  ];
  const pedido: PedidoDeRotulo = { id: "s", pontos: traco, largura: 24, altura: 14 };

  it("sem afastamento, o texto cai EM CIMA da linha (o defeito que o crítico viu)", () => {
    const ponto = colocarRotulos([pedido], []).get("s")!;
    const caixa = caixaDoRotulo(ponto, 24, 14);
    expect(segmentoCruzaRetangulo(traco[0]!, traco[1]!, caixa)).toBe(true);
  });

  it("com afastamento e a própria aresta como obstáculo, o texto sai de lado e não encosta em traço nenhum", () => {
    const ponto = colocarRotulos([pedido], [], {
      arestas: [traco],
      deslocamento: AFASTAMENTO_DO_ROTULO_MUNDO,
    }).get("s")!;
    expect(ponto).not.toBeNull();
    const caixa = caixaDoRotulo(ponto, 24, 14);
    expect(segmentoCruzaRetangulo(traco[0]!, traco[1]!, caixa)).toBe(false);
    expect(Math.abs(ponto.y)).toBeGreaterThanOrEqual(AFASTAMENTO_DO_ROTULO_MUNDO);
  });

  it("o desvio vale para QUALQUER aresta, não só para a dona do rótulo", () => {
    // Uma vizinha passando exatamente onde o lado de cima do traço ficaria.
    const soNoLadoDeBaixo = colocarRotulos([pedido], [], {
      arestas: [traco],
      deslocamento: AFASTAMENTO_DO_ROTULO_MUNDO,
    }).get("s")!;
    const vizinha = [
      { x: 0, y: soNoLadoDeBaixo.y },
      { x: 400, y: soNoLadoDeBaixo.y },
    ];
    const ponto = colocarRotulos([pedido], [], {
      arestas: [traco, vizinha],
      deslocamento: AFASTAMENTO_DO_ROTULO_MUNDO,
    }).get("s")!;
    expect(ponto).not.toBeNull();
    const caixa = caixaDoRotulo(ponto, 24, 14);
    expect(segmentoCruzaRetangulo(vizinha[0]!, vizinha[1]!, caixa)).toBe(false);
  });
});

describe("MÉDIO 6 — a lista acessível obedece ao painel Camadas", () => {
  const tasks = FIXTURE_TASKS as readonly Task[];
  const edges = FIXTURE_EDGES as readonly TaskEdge[];
  const arestas: ArestaVisual[] = construirArestasVisuais({
    tasks,
    edges,
    criticoIds: ["task-setup", "task-build", "task-deploy"],
  });
  const tituloDe = (id: string): string => tasks.find((t) => t.id === id)?.title ?? id;

  it('com "Caminho crítico" desmarcada, a lista deixa de anunciar o caminho crítico', () => {
    const comCritico = relacoesAcessiveisDaTarefa({
      taskId: "task-build",
      arestas,
      tituloDe,
      camadasAtivas: ["sucessao", "critico"],
    });
    const semCritico = relacoesAcessiveisDaTarefa({
      taskId: "task-build",
      arestas,
      tituloDe,
      camadasAtivas: ["sucessao"],
    });
    expect(comCritico.map((r) => r.camada)).toContain("critico");
    expect(semCritico.map((r) => r.camada)).not.toContain("critico");
    // e a sucessão continua, porque uma sucessão crítica continua sendo sucessão
    expect(semCritico.map((r) => r.camada)).toContain("sucessao");
  });

  it("sem o parâmetro, o comportamento é o de sempre (todas as camadas)", () => {
    const relacoes = relacoesAcessiveisDaTarefa({ taskId: "task-build", arestas, tituloDe });
    expect(relacoes.map((r) => r.camada)).toContain("critico");
  });
});

describe("BAIXO 12 — o universo do fixture tem mais de um caso por classe", () => {
  it("cada camada declarada tem pelo menos DUAS arestas no dado", () => {
    for (const tipo of ["correlacao", "sinergia", "obsolescencia"] as const) {
      expect(FIXTURE_EDGES.filter((e) => e.tipo === tipo).length).toBeGreaterThanOrEqual(2);
    }
  });
});

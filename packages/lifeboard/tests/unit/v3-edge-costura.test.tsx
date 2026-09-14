import { renderToStaticMarkup } from "react-dom/server";
import { Position, ReactFlowProvider, type EdgeProps } from "reactflow";
import { describe, expect, it } from "vitest";

import { V3Edge, type V3EdgeData } from "@/components/graph/v3-edge";
import { tipografiaDoCartao } from "@/components/graph/tipografia-do-cartao";
import {
  posicaoDoGlifo,
  SEPARACAO_DA_TRIPLA_MUNDO,
  PISO_DE_TRACO_NA_TELA_PX,
} from "@/lib/geometria-da-aresta";
import type { Ponto } from "@/lib/layout-do-grafo";

/**
 * OS-LIFEBOARD · P4h — achado ALTO #3 do crítico hostil ROUND 8: **a costura
 * entre o módulo puro e o componente não tinha guarda.**
 *
 * A prova dele: trocar `posicaoDoGlifo(data.pontos)` pelo handle do ReactFlow
 * em `v3-edge.tsx:118` deixava `tsc` limpo, **1098/1098 testes verdes**,
 * eslint limpo e `next build` compilando — e no navegador devolvia o ALTO da
 * rodada 6 inteiro: 41 de 45 glifos fora do fim do próprio caminho (até
 * 12,09px), 9/9 no par (até 40,83px) e 12 pares empilhados a 0,00px — seta +
 * círculo + losango + ❌ no mesmo pixel.
 *
 * `tests/unit/geometria-da-aresta.test.ts` testava a FUNÇÃO; nada testava que
 * `V3Edge` a CHAMA. Aqui o componente é MONTADO (dentro do `ReactFlowProvider`,
 * como `altura-do-cartao.test.tsx` faz com `TaskNode`) e o que se mede é o SVG
 * que sai — nunca uma varredura de string no código-fonte.
 *
 * As outras costuras puro↔componente da P4 estão medidas no mesmo arquivo,
 * pelo mesmo método: o rótulo colocado por `rotulo-da-aresta.ts`, a régua de
 * fonte de `tipografia-do-cartao.ts`, a separação da tripla e o piso do traço
 * de `geometria-da-aresta.ts`.
 */

/** O handle do ReactFlow — o ponto ERRADO, de propósito longe do fim da rota. */
const HANDLE = { x: 900, y: 900 };

function props(data: V3EdgeData): EdgeProps<V3EdgeData> {
  return {
    id: data.id,
    source: data.origem,
    target: data.destino,
    sourceX: 0,
    sourceY: 0,
    targetX: HANDLE.x,
    targetY: HANDLE.y,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data,
    selected: false,
    animated: false,
    interactionWidth: 0,
    markerEnd: undefined,
    markerStart: undefined,
    style: undefined,
    sourceHandleId: "source-bottom",
    targetHandleId: "target-top",
  } as EdgeProps<V3EdgeData>;
}

function montar(data: V3EdgeData): string {
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <svg>
        <V3Edge {...props(data)} />
      </svg>
    </ReactFlowProvider>,
  );
}

const ROTA: Ponto[] = [
  { x: 10, y: 10 },
  { x: 10, y: 120 },
  { x: 260, y: 120 },
  { x: 260, y: 184 },
];

function arestaBase(over: Partial<V3EdgeData> = {}): V3EdgeData {
  return {
    id: "e1",
    origem: "a",
    destino: "b",
    camada: "sucessao",
    critica: false,
    destacadaPeloSelecionado: false,
    pontos: ROTA,
    ...over,
  };
}

describe("V3Edge — o componente CHAMA os módulos puros (achado ALTO #3)", () => {
  it("o glifo é desenhado no ÚLTIMO VÉRTICE da rota, nunca no handle do ReactFlow", () => {
    const html = montar(arestaBase());
    const fim = posicaoDoGlifo(ROTA);
    expect(fim.x).toBe(260);
    expect(fim.y).toBe(184);

    // A seta é um `<polygon>` de 3 pontos ancorados em (x, y).
    const pontos = /<polygon[^>]*class="lb-edge-glifo"[^>]*points="([^"]+)"/.exec(html)
      ?? /<polygon[^>]*points="([^"]+)"[^>]*class="lb-edge-glifo"/.exec(html);
    expect(pontos).not.toBeNull();
    const coords = pontos![1]!
      .split(/[ ,]+/)
      .map(Number);
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    const centroX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centroY = (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(centroX).toBeCloseTo(fim.x, 6);
    expect(centroY).toBeCloseTo(fim.y, 6);
    // O falsificador: com o handle de volta, o centro seria (900, 900).
    expect(Math.hypot(centroX - HANDLE.x, centroY - HANDLE.y)).toBeGreaterThan(100);
  });

  it("o ângulo do glifo vem do penúltimo→último segmento (aqui, para BAIXO)", () => {
    const html = montar(arestaBase());
    const fim = posicaoDoGlifo(ROTA);
    expect(fim.anguloGraus).toBeCloseTo(90, 6);
    expect(html).toContain(`rotate(${fim.anguloGraus} ${fim.x} ${fim.y})`);
  });

  it("o ❌ da obsolescência também ancora no fim da rota (é o glifo que sumia atrás do cartão)", () => {
    const html = montar(arestaBase({ camada: "obsolescencia" }));
    const fim = posicaoDoGlifo(ROTA);
    const meia = 6.5;
    expect(html).toContain(
      `d="M${fim.x - meia},${fim.y - meia} L${fim.x + meia},${fim.y + meia} M${fim.x - meia},${fim.y + meia} L${fim.x + meia},${fim.y - meia}"`,
    );
    expect(html).not.toContain(`${HANDLE.x},${HANDLE.y}`);
  });

  it("o `path` desenhado é a rota inteira de `data.pontos` — nunca uma curva da lib", () => {
    const html = montar(arestaBase());
    expect(html).toContain('d="M10,10 L10,120 L260,120 L260,184"');
  });

  it("o rótulo usa a âncora que `rotulo-da-aresta.ts` escolheu, não o meio do segmento", () => {
    const rotulo = { x: 77, y: 333 };
    const html = montar(
      arestaBase({ camada: "sinergia", pesoPercent: 35, rotulo }),
    );
    expect(html).toMatch(new RegExp(`<text[^>]*x="${rotulo.x}"[^>]*y="${rotulo.y}"`));
    expect(html).toContain("35%");
  });

  it("`rotulo: null` (sem lugar livre) não desenha texto nenhum", () => {
    const html = montar(
      arestaBase({ camada: "sinergia", pesoPercent: 35, rotulo: null }),
    );
    // O valor CONTINUA no rótulo acessível e no `<title>` (é a regra do
    // colocador: rótulo ilegível não é informação). O que não pode existir é
    // o `<text>` desenhado.
    expect(html).not.toMatch(/<text[^>]*lb-edge-label/);
    expect(html).toContain('aria-label="sinergia 35%"');
  });

  it("a fonte do rótulo é a da régua do cartão (piso de 12px de tela), não 12 fixo", () => {
    const html = montar(arestaBase({ camada: "sinergia", pesoPercent: 35, rotulo: { x: 5, y: 5 } }));
    // Sem `<ReactFlow>` montado o viewport do provider é zoom 1 — a régua
    // devolve a base de dado do modo cartão.
    expect(html).toContain(`font-size="${tipografiaDoCartao(1).dadoPx}"`);
  });

  it("a tripla do caminho crítico usa a separação em px de MUNDO do módulo puro", () => {
    const html = montar(arestaBase({ critica: true }));
    const caminhos = html.match(/<path/g) ?? [];
    expect(caminhos).toHaveLength(3);
    // As laterais saem deslocadas de ±SEPARACAO no eixo perpendicular — aqui
    // o percurso é mais largo que alto, então o deslocamento é em Y.
    expect(html).toContain(`translate(0,-${SEPARACAO_DA_TRIPLA_MUNDO})`);
    expect(html).toContain(`translate(0,${SEPARACAO_DA_TRIPLA_MUNDO})`);
  });

  it("o traço nunca fica abaixo do piso de 1px de TELA (zoom 1 → 1px de mundo)", () => {
    const html = montar(arestaBase());
    const larguras = [...html.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(larguras.length).toBeGreaterThan(0);
    for (const w of larguras) {
      expect(w).toBeGreaterThanOrEqual(PISO_DE_TRACO_NA_TELA_PX);
    }
  });
});

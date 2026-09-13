import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LinhaDoTempoView } from "@/components/timeline/linha-do-tempo";
import type { LinhaDoTempoProps } from "@/types/linha-do-tempo";

/**
 * OS-LIFEBOARD · P5 — render test (mesmo espírito de `aresta-svg-render.test.tsx`):
 * `renderToStaticMarkup` sob `environment: "node"` (vitest.config.ts) — sem DOM,
 * sem `localStorage`, efeitos nunca rodam. `LinhaDoTempoView` já guarda toda
 * leitura de `window`/`localStorage` atrás de `typeof window !== "undefined"`
 * dentro de try/catch — por isso renderiza igual num Client Component real.
 */
const HOJE = "2026-09-13";

function props(): LinhaDoTempoProps {
  return {
    hoje: HOJE,
    goalId: "G",
    duracaoTotal: 12,
    grupos: [
      {
        titulo: "Assuntos",
        linhas: [
          {
            kind: "assunto",
            id: "org/repo#1",
            titulo: "Um assunto aberto",
            repo: "org/repo",
            inicio: "2026-09-01",
            fim: HOJE,
            aberto: true,
            estado: "aberto",
            url: "https://github.com/org/repo/pull/1",
          },
        ],
      },
      {
        titulo: "Tarefas",
        linhas: [
          {
            kind: "tarefa",
            id: "A",
            titulo: "Tarefa A (crítica)",
            inicio: "2026-09-13",
            fim: "2026-09-16",
            fimComFolga: "2026-09-16",
            critico: true,
            folga: 0,
            semDuracao: false,
            predecessores: [],
            sucessores: ["B"],
            fonteKind: "calendar",
            status: "open",
            foraDoCpm: false,
          },
          {
            kind: "tarefa",
            id: "B",
            titulo: "Tarefa B (com folga)",
            inicio: "2026-09-16",
            fim: "2026-09-18",
            fimComFolga: "2026-09-21",
            critico: false,
            folga: 3,
            semDuracao: false,
            predecessores: ["A"],
            sucessores: [],
            fonteKind: "drive",
            status: "open",
            foraDoCpm: false,
          },
        ],
      },
    ],
  };
}

describe("LinhaDoTempoView — render", () => {
  it("marca a linha de HOJE", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain('data-timeline-hoje="true"');
    expect(html).toContain("lb-tl-hoje");
  });

  it("barra crítica ganha a classe do traço triplo", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("lb-tl-bar-critico");
  });

  it("desenha ao menos um conector de dependência (A → B)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("lb-tl-connector");
  });

  it("a tarefa com folga (B) ganha a extensão de folga (lb-tl-slack)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("lb-tl-slack");
  });

  it("assunto aberto vira link para a URL da mudança", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("https://github.com/org/repo/pull/1");
  });

  it("nunca lança com grupos vazios (sem tarefas nem assuntos)", () => {
    const vazio: LinhaDoTempoProps = { hoje: HOJE, goalId: null, duracaoTotal: 0, grupos: [
      { titulo: "Assuntos", linhas: [] },
      { titulo: "Tarefas", linhas: [] },
    ] };
    expect(() => renderToStaticMarkup(<LinhaDoTempoView {...vazio} />)).not.toThrow();
    expect(renderToStaticMarkup(<LinhaDoTempoView {...vazio} />)).toContain(
      "Nada para mostrar na linha do tempo ainda.",
    );
  });
});

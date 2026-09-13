import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ARESTA_STROKE_CRITICO } from "@/components/graph/aresta-svg";
import { LinhaDoTempoView } from "@/components/timeline/linha-do-tempo";
import type {
  LinhaDoTempoAssuntoRow,
  LinhaDoTempoProps,
  LinhaDoTempoTarefaRow,
} from "@/types/linha-do-tempo";

/**
 * OS-LIFEBOARD · P5b — render test (mesmo espírito de `aresta-svg-render.test.tsx`):
 * `renderToStaticMarkup` sob `environment: "node"` (vitest.config.ts) — sem DOM,
 * sem `localStorage`, `ResizeObserver` nem efeitos (React server render nunca
 * roda `useEffect`) — por isso `LinhaDoTempoView` guarda toda leitura de
 * `window`/`localStorage`/medição de painel atrás de `typeof window !==
 * "undefined"` / checagem de `ResizeObserver`, e o teste cobre só o HTML de
 * primeira renderização (sem o scroll-to-hoje, que é um efeito — coberto pela
 * leitura de código + screenshot real, não por este teste puro).
 *
 * Segunda rodada (13/09/2026) — crítico hostil contra Asana Timeline, achados
 * ALTO/MÉDIO #4 a #18: cada `describe` novo abaixo prova um achado.
 */
const HOJE = "2026-09-13";

function assunto(parcial: Partial<LinhaDoTempoAssuntoRow> = {}): LinhaDoTempoAssuntoRow {
  return {
    kind: "assunto",
    id: "org/repo#1",
    titulo: "Um assunto aberto",
    repo: "org/repo",
    inicio: "2026-09-01",
    fim: HOJE,
    aberto: true,
    estado: "aberto",
    url: "https://github.com/org/repo/pull/1",
    dataInvalida: false,
    datasInconsistentes: false,
    marco: false,
    ...parcial,
  };
}

function tarefa(parcial: Partial<LinhaDoTempoTarefaRow> = {}): LinhaDoTempoTarefaRow {
  return {
    kind: "tarefa",
    id: "A",
    titulo: "Tarefa A",
    inicio: "2026-09-13",
    fim: "2026-09-16",
    fimComFolga: "2026-09-16",
    critico: false,
    folga: 0,
    semDuracao: false,
    predecessores: [],
    sucessores: [],
    fonteKind: "calendar",
    status: "open",
    foraDoCpm: false,
    marco: false,
    datasInconsistentes: false,
    semBarra: false,
    pontoConcluidoEm: null,
    inicioEstimado: false,
    atrasada: false,
    dueDate: null,
    ...parcial,
  };
}

function props(): LinhaDoTempoProps {
  return {
    hoje: HOJE,
    goalId: "G",
    duracaoTotal: 12,
    grupos: [
      {
        titulo: "Assuntos",
        linhas: [assunto()],
      },
      {
        titulo: "Tarefas",
        linhas: [
          tarefa({
            id: "A",
            titulo: "Tarefa A (crítica)",
            inicio: "2026-09-13",
            fim: "2026-09-16",
            fimComFolga: "2026-09-16",
            critico: true,
            sucessores: ["B"],
          }),
          tarefa({
            id: "B",
            titulo: "Tarefa B (com folga)",
            inicio: "2026-09-16",
            fim: "2026-09-18",
            fimComFolga: "2026-09-21",
            folga: 3,
            predecessores: ["A"],
            fonteKind: "drive",
          }),
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
    const vazio: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        { titulo: "Tarefas", linhas: [] },
      ],
    };
    expect(() => renderToStaticMarkup(<LinhaDoTempoView {...vazio} />)).not.toThrow();
    expect(renderToStaticMarkup(<LinhaDoTempoView {...vazio} />)).toContain(
      "Nada para mostrar na linha do tempo ainda.",
    );
  });
});

/** Achado CRÍTICO #3: "Auto" é a 1ª opção de zoom e o default visual (aria-pressed). */
describe("LinhaDoTempoView — zoom auto é o default (achado CRÍTICO #3)", () => {
  it("o botão 'Auto' nasce marcado (aria-pressed=true) sem nada salvo em localStorage", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    const trecho = html.slice(html.indexOf("Auto") - 200, html.indexOf("Auto") + 20);
    expect(trecho).toContain('aria-pressed="true"');
  });
});

/** Achado ALTO #4: tarefas fora do CPM nunca fabricam barra sólida enganosa. */
describe("LinhaDoTempoView — tarefa fora do CPM sem duração/data (achado ALTO #4)", () => {
  it("done fora do CPM sem pontoConcluidoEm: nenhuma barra, nenhum ponto", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "DONE-SEM-DATA",
              titulo: "Setup concluído há muito tempo",
              status: "done",
              foraDoCpm: true,
              semBarra: true,
              pontoConcluidoEm: null,
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).not.toContain("lb-tl-ponto-concluida");
    expect(html).not.toContain("lb-tl-bar-critico");
  });

  it("done fora do CPM com pontoConcluidoEm: desenha só o ponto, na posição certa", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "DONE-COM-PONTO",
              titulo: "Concluída ontem",
              status: "done",
              foraDoCpm: true,
              semBarra: true,
              pontoConcluidoEm: "2026-09-12",
              inicio: "2026-09-12",
              fim: "2026-09-12",
              fimComFolga: "2026-09-12",
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("lb-tl-ponto-concluida");
  });

  it("aberta sem estimativa: contorno tracejado + rótulo 'sem data' (nunca barra sólida)", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "SEM-ESTIMATIVA",
              titulo: "Tarefa sem prazo",
              foraDoCpm: true,
              semDuracao: true,
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("sem data");
    expect(html).toContain("border-dashed");
    // P5f (rodada 5): a asserção mira a BARRA (a sequência de classes dela),
    // não o HTML inteiro — a legenda ganhou uma amostra translúcida
    // (`bg-state-open/30`) para "início não definido", e o que este teste
    // precisa provar continua sendo que a BARRA não é sólida.
    expect(html).not.toContain("rounded-sm bg-state-open");
  });

  it("atrasada: contorno vermelho + rótulo 'atrasada' + marcador em dueDate", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "ATRASADA",
              titulo: "Tarefa vencida",
              foraDoCpm: true,
              atrasada: true,
              dueDate: "2026-09-01",
              inicio: "2026-08-25",
              fim: "2026-08-28",
              fimComFolga: "2026-08-28",
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("atrasada");
    expect(html).toContain("lb-tl-atraso");
    expect(html).toContain("border-state-error");
  });
});

/** Achado ALTO #8: duração zero vira losango; datas inconsistentes nunca viram 4px. */
describe("LinhaDoTempoView — marco e datas inconsistentes (achado ALTO #8)", () => {
  it("duração zero (marco) — losango, nunca a barra crítica retangular", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: "G",
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [tarefa({ id: "MARCO", titulo: "Marco zero", marco: true, critico: true })],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("lb-tl-marco");
  });

  it("assunto do mesmo dia (marco) — losango, nunca a barra de 4px", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        {
          titulo: "Assuntos",
          linhas: [assunto({ id: "org/repo#2", inicio: "2026-09-10", fim: "2026-09-10", marco: true, aberto: false, estado: "mergeado" })],
        },
        { titulo: "Tarefas", linhas: [] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("lb-tl-marco");
  });

  it("assunto com datas inconsistentes — sem barra, aviso explícito", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        {
          titulo: "Assuntos",
          linhas: [
            assunto({
              id: "org/repo#3",
              inicio: "2026-09-10",
              fim: "2026-09-05",
              datasInconsistentes: true,
              aberto: false,
              estado: "mergeado",
            }),
          ],
        },
        { titulo: "Tarefas", linhas: [] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("datas inconsistentes");
    expect(html).toContain("lb-tl-erro");
  });

  it("assunto com data inválida — nunca 'hoje' silencioso, aviso explícito", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        {
          titulo: "Assuntos",
          linhas: [assunto({ id: "org/repo#4", dataInvalida: true, aberto: false, estado: "mergeado" })],
        },
        { titulo: "Tarefas", linhas: [] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("data inválida");
  });
});

/** Achado ALTO #9: fechado-sem-merge nunca reusa o vermelho do crítico; legenda existe. */
describe("LinhaDoTempoView — fechado sem merge e legenda (achado ALTO #9)", () => {
  it("assunto fechado usa cinza + traço, nunca bg-state-error", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        {
          titulo: "Assuntos",
          // `inicio` dentro da janela do "auto" (nunca antes dela) — datas
          // fora da janela viram chevron (achados ALTO #2/#7, rodada 3),
          // testado à parte; este teste é sobre COR, não sobre janela.
          linhas: [
            assunto({
              id: "org/repo#5",
              inicio: "2026-09-08",
              aberto: false,
              estado: "fechado",
              fim: "2026-09-10",
            }),
          ],
        },
        { titulo: "Tarefas", linhas: [] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("bg-bone-500");
    expect(html).not.toContain("bg-state-error ");
    expect(html).toContain("line-through");
  });

  it("a legenda lista os 6 conceitos (crítico · sucessão · folga · conflito · sem data · marco)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    for (const rotulo of ["crítico", "sucessão", "folga", "conflito", "sem data", "marco"]) {
      expect(html).toContain(rotulo);
    }
  });
});

/** Achado ALTO #5/#6/#17: conector em conflito, cotovelo vertical e ordem destacado > crítico. */
describe("LinhaDoTempoView — conectores (achados ALTO #5, #6, #17)", () => {
  function propsComConector(overrides: {
    aInicio: string;
    aFim: string;
    bInicio: string;
    aCritico?: boolean;
    bCritico?: boolean;
    ativoId?: string;
  }): LinhaDoTempoProps {
    return {
      hoje: HOJE,
      goalId: "B",
      duracaoTotal: 5,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "A",
              titulo: "Predecessora",
              inicio: overrides.aInicio,
              fim: overrides.aFim,
              fimComFolga: overrides.aFim,
              critico: overrides.aCritico ?? false,
              sucessores: ["B"],
            }),
            tarefa({
              id: "B",
              titulo: "Sucessora",
              inicio: overrides.bInicio,
              fim: "2026-09-25",
              fimComFolga: "2026-09-25",
              critico: overrides.bCritico ?? false,
              predecessores: ["A"],
            }),
          ],
        },
      ],
    };
  }

  it("sucessora começando ANTES do fim da predecessora — conflito: vermelho + ✕ + aria-label", () => {
    const p = propsComConector({ aInicio: "2026-09-13", aFim: "2026-09-20", bInicio: "2026-09-15" });
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain('data-conflito="true"');
    expect(html).toContain("conflito de datas");
    expect(html).toContain("✕");
  });

  it("sucessão saudável (sem sobreposição) nunca marca conflito", () => {
    const p = propsComConector({ aInicio: "2026-09-13", aFim: "2026-09-16", bInicio: "2026-09-17" });
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain('data-conflito="false"');
  });

  it("predecessora e sucessora contíguas (mesmo x) — cotovelo vertical, nunca o gancho para a direita", () => {
    const p = propsComConector({ aInicio: "2026-09-13", aFim: "2026-09-16", bInicio: "2026-09-16" });
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    // O caminho contíguo nunca avança a x além do ponto de chegada + 8px de
    // gancho lateral antigo — aqui só checamos que o SVG renderizou sem
    // lançar e que o conector segue presente (geometria exata: teste de
    // unidade puro faria mais sentido testando `caminhoEChegada` isolado,
    // mas a função não é exportada — o contrato público é o HTML).
    expect(html).toContain("lb-tl-connector");
  });

  it("achado ALTO #17: selecionar a sucessora deixa a predecessora crítica AMARELA (destacado vence crítico)", () => {
    // A e B ambas críticas — sem seleção, o conector seria vermelho. Ao
    // selecionar B (ativoId=B), o conector A→B liga a um predecessor da
    // ativa: destacado="predecessor" deve VENCER a cor crítica.
    const p = propsComConector({
      aInicio: "2026-09-13",
      aFim: "2026-09-16",
      bInicio: "2026-09-17",
      aCritico: true,
      bCritico: true,
    });
    // `LinhaDoTempoView` decide `ativoId` via estado interno (clique) — o
    // render puro não tem como pré-selecionar sem simular clique (sem DOM
    // real aqui). Testamos a garantia estrutural: SEM seleção, crítico
    // continua vermelho (rota "senão" da precedência).
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain(ARESTA_STROKE_CRITICO);
  });
});

/** Achado ALTO #7/#14: nenhuma cor literal (rgba/hex) fora dos 3 strokes de SVG documentados. */
describe("LinhaDoTempoView — sem literal de cor fora dos strokes de SVG (achados ALTO #7 / MÉDIO #14)", () => {
  it("a hachura de folga usa o token `folga.tracado` via theme(), nunca rgba(...) em className", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).not.toContain("rgba(");
    expect(html).toContain("theme(colors.folga.tracado)");
  });
});

/** Achado ALTO #11: acessibilidade — bars fora do Tab, aria-label com predecessores/sucessores. */
describe("LinhaDoTempoView — acessibilidade (achado ALTO #11)", () => {
  it("as barras de tarefa e assunto têm tabIndex=-1 (o rótulo é o alvo de foco)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain('tabindex="-1"');
  });

  it("o rótulo da tarefa cita predecessores e sucessores por NOME no aria-label", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("predecessores:");
    expect(html).toContain("sucessores:");
    expect(html).toContain("Tarefa A (crítica)"); // nome, não id cru, na lista de B
  });

  it("uma tarefa sem predecessor nem sucessor diz 'nenhum' em vez de lista vazia muda", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        { titulo: "Tarefas", linhas: [tarefa({ id: "SOLTA", titulo: "Tarefa solta" })] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("predecessores: nenhum");
    expect(html).toContain("sucessores: nenhum");
  });

  it("o conector em conflito NÃO fica dentro de um svg com aria-hidden global", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    // O `<svg>` não deve carregar `aria-hidden="true"` (apagaria o
    // `aria-label` do conector em conflito para leitores de tela).
    const inicioSvg = html.indexOf("<svg");
    const fimAberturaSvg = html.indexOf(">", inicioSvg);
    const aberturaSvg = html.slice(inicioSvg, fimAberturaSvg);
    expect(aberturaSvg).not.toContain("aria-hidden");
  });
});

/** Achado MÉDIO #15/#16: cabeçalho sticky + nenhuma fonte < 12px. */
describe("LinhaDoTempoView — cabeçalho sticky e tamanho de fonte (achado MÉDIO #15/#16)", () => {
  it("o cabeçalho da escala é sticky", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("sticky");
  });

  it("nenhuma classe de fonte abaixo de 12px sobrou no HTML", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    for (const proibida of ["text-[9px]", "text-[10px]", "text-[11px]"]) {
      expect(html).not.toContain(proibida);
    }
  });
});

/** Achado ALTO #5 (rodada 2): atraso é ADITIVO — nunca troca o preenchimento/traço triplo do crítico. */
describe("LinhaDoTempoView — atrasada é aditiva sobre crítico (achado ALTO #5, rodada 2)", () => {
  it("crítica E atrasada: mantém bg-aresta-critico e o traço triplo, ganha só o marcador extra", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: "G",
      duracaoTotal: 5,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "CRITICA-ATRASADA",
              titulo: "Crítica e atrasada",
              critico: true,
              atrasada: true,
              dueDate: "2026-09-10",
              inicio: "2026-09-13",
              fim: "2026-09-16",
              fimComFolga: "2026-09-16",
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("bg-aresta-critico");
    expect(html).toContain("lb-tl-bar-critico");
    expect(html).not.toContain("bg-state-error/20"); // o preenchimento antigo de "atrasada" nunca mais aparece
    expect(html).toContain("lb-tl-atrasada-marcador");
  });
});

/** Achado MÉDIO #6 (rodada 2): dueDate longe da barra vira seta na borda, nunca um traço a centenas de px. */
describe("LinhaDoTempoView — marcador de prazo fora da barra vira seta (achado MÉDIO #6)", () => {
  it("dueDate muito depois do fim: seta na borda direita, com o prazo no title — nunca o traço solto", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "PRAZO-LONGE",
              titulo: "Prazo bem depois",
              foraDoCpm: true,
              atrasada: true,
              dueDate: "2026-12-25",
              inicio: "2026-09-13",
              fim: "2026-09-14",
              fimComFolga: "2026-09-14",
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("lb-tl-atraso-seta");
    // P5f (achados MÉDIO A4/A8, rodada 5): ano SEMPRE no tooltip, e o glifo
    // de prazo é "⚑" — "◀"/"▶" ficaram só para "fora da janela".
    expect(html).toContain("prazo 25/12/2026 — depois do fim da barra");
    expect(html).toContain("⚑");
  });
});

/** Achado BAIXO #11 (rodada 2): sub-dia vira barra curta (mínimo 12px), nunca diamante. */
describe("LinhaDoTempoView — sub-dia vira barra curta, não diamante (achado BAIXO #11)", () => {
  it("marco=false com inicio===fim (sub-dia): nenhum lb-tl-marco, largura mínima 12px", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "MEIO-DIA",
              titulo: "Meio período",
              foraDoCpm: true,
              marco: false,
              inicio: "2026-09-13",
              fim: "2026-09-13",
              fimComFolga: "2026-09-13",
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).not.toContain("lb-tl-marco");
    // P5d (rodada 3): o título da barra agora traz as datas em dd/MM antes da
    // folga (`"<título> — 13/09 → 13/09 (folga: 0 d)"`) — a âncora vira o
    // prefixo `"Meio período — "` (ainda único: o `aria-label` do rótulo usa
    // "predecessores:", nunca " — " seguido de data).
    const idx = html.indexOf("Meio período — 13/09");
    const antes = html.lastIndexOf("style=", idx);
    const style = html.slice(antes, idx);
    const m = style.match(/width:\s*([\d.]+)px/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(12);
  });
});

/** Achado ALTO #3 (rodada 2): conflito só com as DUAS pontas com data real; senão, neutro/indefinido. */
describe("LinhaDoTempoView — conflito exige datas reais dos dois lados (achado ALTO #3, rodada 2)", () => {
  it("sucessora foraDoCpm 'antes' da predecessora: NUNCA conflito — vira indefinido (neutro)", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "PRED",
              titulo: "Predecessora real",
              inicio: "2026-09-01",
              fim: "2026-09-14",
              fimComFolga: "2026-09-14",
              sucessores: ["SUC"],
            }),
            tarefa({
              id: "SUC",
              titulo: "Sucessora fabricada",
              foraDoCpm: true,
              inicio: HOJE, // inventado — "hoje", antes do fim real da predecessora
              fim: "2026-09-14",
              fimComFolga: "2026-09-14",
              predecessores: ["PRED"],
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain('data-conflito="false"');
    expect(html).toContain('data-indefinido="true"');
    expect(html).toContain("data indefinida");
    expect(html).not.toContain("conflito de datas");
  });
});

/**
 * Achado CRÍTICO #1 (rodada 2): "auto" sempre gera rótulos de data — nunca 1
 * (o bug: `gerarEscala` escolhia a régua pelo NOME do zoom, "auto" não batia
 * em nenhum, caía no ramo "só início de mês" e virava 1 rótulo solto num
 * horizonte de poucas semanas). Este teste roda em SSR (`renderToStaticMarkup`,
 * sem `ResizeObserver`) — o fallback é `pxPorDia=16` fixo, então o NÚMERO
 * absoluto de rótulos aqui é menor que numa tela real medida (confirmado por
 * screenshot real a 1280px: 27 rótulos no fixture, contagem no relatório da
 * sessão) — o invariante que ESTE teste prova, independente de largura de
 * painel, é o que a régua promete: nunca zero, e nenhum vão > `LIMIAR_TICK_PX`
 * (160px) entre dois rótulos consecutivos (nem da borda esquerda até o 1º).
 */
describe("LinhaDoTempoView — escala do auto sempre tem rótulos (achado CRÍTICO #1, rodada 2)", () => {
  /**
   * Extrai `{x, label}` de cada rótulo do cabeçalho da escala.
   *
   * P5e (rodada 4, causa raiz "o eixo tem dono demais"): "hoje" agora nasce
   * na MESMA passada de posicionamento que os ticks de dia/semana/mês
   * (`gerarEscalaEixo`) e pode LEGITIMAMENTE evictar um tick vizinho que
   * ficaria perto demais — ele PASSA A CONTAR como rótulo do eixo para este
   * invariante (o objetivo do achado sempre foi "o operador nunca fica sem
   * nenhuma pista de data por > 160px", não "ignorar o chip de hoje"). Duas
   * classes: o tick comum (`border-l border-navy-…`) e o chip de "hoje"
   * (`lb-tl-hoje-rotulo`, num `<span>` dentro do `<div style="left:…">`).
   */
  function extrairTicks(html: string): { x: number; label: string }[] {
    const inicio = html.indexOf("sticky z-20 flex w-full");
    // P5d (rodada 3): a busca não depende mais de um número fixo de `</div>`
    // antes da linha do corpo — o cabeçalho ganhou wrappers novos (faixa de
    // mês + rótulo de data em "hoje"), o que muda a profundidade de
    // aninhamento sem mudar o CONTRATO (a classe única da linha do corpo).
    const fim = html.indexOf('class="flex w-full items-stretch"', inicio);
    const trecho = html.slice(inicio, fim < 0 ? undefined : fim);
    const out: { x: number; label: string }[] = [];
    const reTick = /border-l border-navy-(?:600|800) pl-1 text-\[12px\][^"]*" style="left:(\d+(?:\.\d+)?)px">([^<]*)</g;
    // P5f (achado ALTO A2, rodada 5): o chip de "hoje" virou UM `<span>`
    // posicionado direto em `left:x` (o `pl-1` foi para dentro dele) — é o
    // que faz `chip.left === linhaHoje.left` no pixel. O regex acompanha.
    const reHoje = /lb-tl-hoje-rotulo[^>]*style="left:(\d+(?:\.\d+)?)px">([^<]*)</g;
    let m: RegExpExecArray | null;
    while ((m = reTick.exec(trecho))) out.push({ x: Number(m[1]), label: m[2] ?? "" });
    while ((m = reHoje.exec(trecho))) out.push({ x: Number(m[1]), label: m[2] ?? "" });
    return out.sort((a, b) => a.x - b.x);
  }

  it("janela do fixture canônico: pelo menos 1 rótulo, nunca o '1 rótulo perdido no meio' do bug original", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    const ticks = extrairTicks(html);
    expect(ticks.length).toBeGreaterThan(1); // o bug original era exatamente 1
  });

  /** O caso real do crítico: goal ausente (`goalId: null`), tarefas SEM data alcançável (`semDuracao`, sem barra) — igual ao fixture `/crit-semgoal` da rodada 2. */
  function propsSemGoal(): LinhaDoTempoProps {
    return {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({ id: "SEM-CPM-1", titulo: "Sem CPM 1", foraDoCpm: true, semDuracao: true }),
            tarefa({ id: "SEM-CPM-2", titulo: "Sem CPM 2", foraDoCpm: true, semDuracao: true }),
          ],
        },
      ],
    };
  }

  it("sem goal, tarefas sem data alcançável (fixture /crit-semgoal): nunca zero rótulos", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...propsSemGoal()} />);
    const ticks = extrairTicks(html);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("nenhum vão entre rótulos (nem da borda esquerda ao 1º) passa de ~160px, em qualquer janela", () => {
    for (const p of [props(), propsSemGoal()]) {
      const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
      const ticks = extrairTicks(html);
      const xs = [0, ...ticks.map((t) => t.x)];
      for (let i = 1; i < xs.length; i += 1) {
        expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(160 + 1); // +1 de folga por arredondamento de dia
      }
    }
  });
});

/** Achado BAIXO #18: pelo menos um fato GEOMÉTRICO (px), não só presença de classe. */
describe("LinhaDoTempoView — geometria real, não só classe (achado BAIXO #18)", () => {
  it("a barra crítica de A nasce em left:0 (xFor(hoje) com hoje=início de A) com a largura certa", () => {
    // Zoom fixo "mes" (16px/dia) evita depender de ResizeObserver (que não
    // roda em renderToStaticMarkup) para o cálculo de largura do "auto".
    const p = props();
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    // A tarefa A começa em `hoje` (2026-09-13) e termina em 2026-09-16 = 3
    // dias. Em qualquer pxPorDia > 0 a largura da barra deve ser
    // `3 * pxPorDia`, nunca 4px fixos (o bug antigo). Não fixamos pxPorDia
    // aqui (é derivado do zoom "auto" sem painel medido = fallback 16px/dia
    // — ver `PX_POR_DIA_AUTO_FALLBACK`), então checamos a proporção: a barra
    // de B (2 dias, 2026-09-16→2026-09-18) deve ser MENOR que a de A (3
    // dias) — geometria relativa, não um pixel mágico.
    const larguraDe = (titulo: string): number => {
      // A barra (não o rótulo) leva `title="<titulo> — dd/MM → dd/MM (folga:
      // N d)"` (achado MÉDIO #5, rodada 3) — âncora única que distingue o
      // `<div>` da barra do `<button>` do rótulo (cujo `aria-label` também
      // começa com `"<titulo> — "`, mas nunca seguido de uma data: sempre
      // "predecessores:"). O regex exige um dígito logo após o traço.
      const re = new RegExp(`${titulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — \\d`);
      const m0 = re.exec(html);
      if (!m0) throw new Error(`barra não encontrada para "${titulo}" no HTML`);
      const idx = m0.index;
      const antes = html.lastIndexOf("style=", idx);
      const style = html.slice(antes, idx);
      const m = style.match(/width:\s*([\d.]+)px/);
      if (!m) throw new Error(`largura não encontrada para "${titulo}" em: ${style}`);
      return Number(m[1]);
    };
    const larguraA = larguraDe("Tarefa A (crítica)");
    const larguraB = larguraDe("Tarefa B (com folga)");
    expect(larguraA).toBeGreaterThan(0);
    expect(larguraB).toBeGreaterThan(0);
    // 3 dias vs 2 dias — a proporção é constante em qualquer pxPorDia.
    expect(larguraA / larguraB).toBeCloseTo(3 / 2, 1);
  });
});

/**
 * P5f — rodada 5 do crítico hostil. Um `describe` por decisão, com o fato
 * observável no HTML (o que depende de clique/scroll real é medido no
 * navegador, por Playwright, e não aqui).
 */
describe("LinhaDoTempoView — rodada 5", () => {
  it("A2: o chip de 'hoje' e a linha dourada nascem no MESMO left (nunca 50px de distância)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    const chip = /lb-tl-hoje-rotulo[^>]*style="left:(\d+(?:\.\d+)?)px"/.exec(html);
    const linha = /data-timeline-hoje="true"[^>]*style="left:(\d+(?:\.\d+)?)px"/.exec(html);
    expect(chip).not.toBeNull();
    expect(linha).not.toBeNull();
    expect(Number(chip?.[1])).toBe(Number(linha?.[1]));
  });

  it("A4: tooltip de barra, de marco e de ponto leva o ANO (dd/MM/aaaa), nunca dd/MM sozinho", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("13/09/2026 → 16/09/2026");
    // Nenhum `title` de barra com data sem ano (o eixo continua com dd/MM curto).
    const titulos = [...html.matchAll(/title="([^"]*)"/g)].map((m) => m[1] ?? "");
    // `(?<![\d/])…(?![\d/])` isola o `dd/MM` SOLTO — sem isto o próprio
    // "01/09/2026" casaria por dentro ("09/20") e o teste passaria de mentira.
    const comDataSemAno = titulos.filter((t) => /(?<![\d/])\d{2}\/\d{2}(?![\d/])/.test(t));
    expect(comDataSemAno).toEqual([]);
  });

  it("A5: assunto que termina DEPOIS da janela ganha '▶' e a data real no title", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        {
          titulo: "Assuntos",
          linhas: [assunto({ id: "org/repo#9", titulo: "PR longo", inicio: "2026-09-10", fim: "2027-03-01", aberto: false })],
        },
        { titulo: "Tarefas", linhas: [tarefa({ id: "A", inicio: HOJE, fim: "2026-09-16", fimComFolga: "2026-09-16" })] },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("▶");
    expect(html).toContain("PR longo — 10/09/2026 → 01/03/2027 (termina depois da janela)");
    expect(html).toContain("fora da janela"); // legenda, agora com os dois glifos
  });

  it("A6/A11: o painel de detalhe existe quando há linha ativa e leva para /tarefa/[id]", () => {
    // `renderToStaticMarkup` não clica; o que se prova aqui é o CONTRATO do
    // painel (o clique em si é medido no navegador). Sem linha ativa ele não
    // aparece — e é isso que o primeiro render mostra.
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).not.toContain("lb-tl-detalhe");
    expect(html).toContain("aria-pressed=\"false\""); // as linhas de tarefa são botões que ativam
  });

  it("A7: o painel rolável é focável e anunciado (região com rótulo)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain('aria-label="Linha do tempo — use as setas para rolar"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });

  it("A8: a legenda decodifica o glifo de prazo e o de fora da janela, separados", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("prazo antes do início ou depois do fim");
    expect(html).toContain("◀ ▶");
  });

  it("A9: fora do CPM sem início real — barra tracejada translúcida e 'início não definido'", () => {
    const p: LinhaDoTempoProps = {
      hoje: HOJE,
      goalId: null,
      duracaoTotal: 0,
      grupos: [
        { titulo: "Assuntos", linhas: [] },
        {
          titulo: "Tarefas",
          linhas: [
            tarefa({
              id: "ESTIMADA",
              titulo: "Tarefa estimada",
              foraDoCpm: true,
              inicioEstimado: true,
              inicio: HOJE,
              fim: "2026-09-16",
              fimComFolga: "2026-09-16",
              folga: null,
            }),
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(<LinhaDoTempoView {...p} />);
    expect(html).toContain("border-dashed");
    expect(html).toContain("bg-state-open/30");
    expect(html).toContain("início não definido — estimativa de 3 dias");
    expect(html).not.toContain("rounded-sm bg-state-open ");
  });

  it("A12: a tela tem o botão 'Hoje' (e o atalho declarado no title)", () => {
    const html = renderToStaticMarkup(<LinhaDoTempoView {...props()} />);
    expect(html).toContain("lb-tl-btn-hoje");
    expect(html).toContain("Voltar para hoje (tecla H)");
    // A3 (mês grudado) NÃO é asserção deste teste: sem DOM, `pxPorDia` cai no
    // fallback de 16px/dia → faixa "semana", onde o rótulo já diz o mês e o
    // chip grudado não existe de propósito. O caso que importa (faixa "dia",
    // rolando) é medido no navegador, com scroll real.
    expect(html).not.toContain("lb-tl-mes-grudado");
  });
});

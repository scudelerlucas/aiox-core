import { describe, expect, it } from "vitest";

import {
  ARESTA_STROKE,
  ARESTA_STROKE_CRITICO,
  ARESTA_STROKE_DESTACADA,
  FORMA_POR_CAMADA,
} from "@/components/graph/aresta-svg";
import {
  CAMADAS_TODAS,
  CAMADA_LABEL,
  construirArestasVisuais,
  relacoesAcessiveisDaTarefa,
  type CamadaGrafo,
} from "@/lib/camadas-do-grafo";
import { TIPOS_DE_BANDA } from "@/lib/geometria-da-aresta";
import {
  corNaFamilia,
  DIRECAO_POR_ROTULO,
  direcaoDoVerbo,
  FAMILIAS_DE_COR,
  FAMILIA_EXIGIDA_POR_PAPEL,
  familiasSeSobrepoem,
  FORMAS_DIRECIONAIS,
  hexParaHsl,
  type NomeDeFamilia,
} from "@/lib/promessa-do-grafo";
import type { Task, TaskEdge } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P4 rodada 15 — os achados ALTO 1 e ALTO 2 do crítico hostil,
 * que são o MESMO achado em dois assuntos: **a régua saía da coisa medida**.
 *
 * ALTO 1: as duas tabelas de cor (`aresta-svg.tsx` e `tailwind.config.ts`) são
 * as duas do produto — trocar as duas no mesmo ato (2 linhas, `#FF7A6B` →
 * `#5FE39A`) deixava os cinco portões verdes, `checar-contraste.mjs` imprimia
 * `ok 12,40:1` sobre o hex novo, e o caminho crítico ficava do mesmo verde da
 * sucessão. Pixels na cor do crítico na tela: **1661 → 832**.
 *
 * ALTO 2: `CAMADA_LABEL` alimentava o painel, a lista acessível e a guarda, e
 * o único teste comparava o rótulo da lista com `CAMADA_LABEL`. Trocar
 * "Sucessão" e "Correlação" de lugar passava em tudo e a lista para leitor de
 * tela passava a dizer "Correlação: habilita X" e "Sucessão: com Y".
 *
 * A âncora dos dois é `src/lib/promessa-do-grafo.ts`: a promessa em palavras
 * (família de cor; direção por NOME), que não é nenhuma das tabelas auditadas.
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

/** Um grafo em que "meio" toca TODAS as camadas de uma vez (inclusive a crítica). */
const TAREFAS: Task[] = [
  tarefa("antes", { successorIds: ["meio"] }),
  tarefa("meio", { predecessorIds: ["antes"], successorIds: ["depois"] }),
  tarefa("depois", { predecessorIds: ["meio"] }),
  tarefa("parceira"),
  tarefa("sinergica"),
  tarefa("velha"),
];
const ARESTAS: TaskEdge[] = [
  aresta({ origem: "meio", destino: "parceira", tipo: "correlacao" }),
  aresta({ origem: "meio", destino: "sinergica", tipo: "sinergia", peso: 0.5 }),
  aresta({ origem: "meio", destino: "velha", tipo: "obsolescencia" }),
];
const VISUAIS = construirArestasVisuais({
  tasks: TAREFAS,
  edges: ARESTAS,
  criticoIds: ["antes", "meio", "depois"],
});
const tituloDe = (id: string): string => TAREFAS.find((t) => t.id === id)?.title ?? id;

/** O hex que o grafo pinta para cada papel — a tabela que está sendo AUDITADA. */
const HEX_DO_PAPEL: Record<string, string> = {
  ...ARESTA_STROKE,
  critico: ARESTA_STROKE_CRITICO,
  destacada: ARESTA_STROKE_DESTACADA,
};

describe("a promessa de COR não sai da tabela de cores (ALTO 1)", () => {
  it("todo papel de TIPOS_DE_BANDA tem família declarada na promessa", () => {
    const semPromessa = TIPOS_DE_BANDA.filter(
      (p) => !(p in FAMILIA_EXIGIDA_POR_PAPEL),
    );
    expect(semPromessa).toEqual([]);
  });

  it("o caminho crítico é VERMELHO — dito por extenso, fora das duas tabelas", () => {
    expect(FAMILIA_EXIGIDA_POR_PAPEL.critico).toBe("vermelho");
    expect(corNaFamilia(ARESTA_STROKE_CRITICO, FAMILIAS_DE_COR.vermelho)).toBe(true);
    /* E não é verde: é este par que a sabotagem de 2 linhas quebra. */
    expect(corNaFamilia(ARESTA_STROKE_CRITICO, FAMILIAS_DE_COR.verde)).toBe(false);
  });

  it("cada papel pinta numa cor da família que a promessa exige dele", () => {
    const fora: string[] = [];
    for (const papel of TIPOS_DE_BANDA) {
      const nome = FAMILIA_EXIGIDA_POR_PAPEL[papel as keyof typeof FAMILIA_EXIGIDA_POR_PAPEL] as
        | NomeDeFamilia
        | undefined;
      const hex = HEX_DO_PAPEL[papel];
      if (nome === undefined || hex === undefined) {
        fora.push(`${papel}: sem família ou sem hex`);
        continue;
      }
      const familia = FAMILIAS_DE_COR[nome];
      if (!corNaFamilia(hex, familia)) {
        const hsl = hexParaHsl(hex);
        fora.push(
          `${papel}: a promessa diz "${familia.emPortugues}" e o grafo pinta ${hex} (matiz ${String(
            Math.round(hsl?.h ?? -1),
          )}°, sat ${String(hsl?.s.toFixed(2))}, lum ${String(hsl?.l.toFixed(2))})`,
        );
      }
    }
    expect(fora).toEqual([]);
  });

  it("as famílias são DISJUNTAS — senão dizer 'vermelho' não excluiria nada", () => {
    const nomes = Object.keys(FAMILIAS_DE_COR) as NomeDeFamilia[];
    const colididas: string[] = [];
    for (let i = 0; i < nomes.length; i += 1) {
      for (let j = i + 1; j < nomes.length; j += 1) {
        const a = nomes[i]!;
        const b = nomes[j]!;
        if (familiasSeSobrepoem(FAMILIAS_DE_COR[a], FAMILIAS_DE_COR[b])) colididas.push(`${a}×${b}`);
      }
    }
    expect(colididas).toEqual([]);
  });

  it("dois papéis nunca dividem a mesma família — cada um é distinguível por cor", () => {
    const porFamilia = new Map<string, string[]>();
    for (const papel of TIPOS_DE_BANDA) {
      const nome = FAMILIA_EXIGIDA_POR_PAPEL[papel as keyof typeof FAMILIA_EXIGIDA_POR_PAPEL];
      porFamilia.set(nome, [...(porFamilia.get(nome) ?? []), papel]);
    }
    const repetidas = [...porFamilia.entries()].filter(([, ps]) => ps.length > 1);
    expect(repetidas).toEqual([]);
  });
});

describe("a promessa de DIREÇÃO não sai da tabela de nomes (ALTO 2)", () => {
  it("os nomes do painel são exatamente os nomes que a promessa conhece", () => {
    const naTela = CAMADAS_TODAS.map((c) => CAMADA_LABEL[c]).sort();
    const naPromessa = Object.keys(DIRECAO_POR_ROTULO).sort();
    expect(naTela).toEqual(naPromessa);
  });

  it("o verbo de cada camada obedece à direção declarada para o NOME dela", () => {
    const relacoes = relacoesAcessiveisDaTarefa({ taskId: "meio", arestas: VISUAIS, tituloDe });
    expect(relacoes.length).toBe(CAMADAS_TODAS.length);
    const erros: string[] = [];
    for (const r of relacoes) {
      const declarada = DIRECAO_POR_ROTULO[r.rotulo as keyof typeof DIRECAO_POR_ROTULO];
      if (declarada === undefined) {
        erros.push(`a camada "${r.camada}" se chama "${r.rotulo}" e a promessa não conhece esse nome`);
        continue;
      }
      for (const item of r.itens) {
        const doVerbo = direcaoDoVerbo(item);
        if (doVerbo === null) {
          erros.push(`"${r.rotulo}: ${item}" abre com um verbo que a promessa não conhece`);
        } else if (doVerbo !== declarada) {
          erros.push(
            `"${r.rotulo}" é ${declarada} na promessa e o item "${item}" fala como ${doVerbo}`,
          );
        }
      }
    }
    expect(erros).toEqual([]);
  });

  it("o glifo de cada camada base obedece à mesma direção do nome dela", () => {
    const erros: string[] = [];
    for (const camada of CAMADAS_TODAS) {
      if (camada === "critico") continue;
      const base = camada as Exclude<CamadaGrafo, "critico">;
      const forma = FORMA_POR_CAMADA[base];
      const declarada = DIRECAO_POR_ROTULO[CAMADA_LABEL[camada] as keyof typeof DIRECAO_POR_ROTULO];
      const setaNaTela = (FORMAS_DIRECIONAIS as readonly string[]).includes(forma);
      if (declarada === "direcional" && !setaNaTela) {
        erros.push(`"${CAMADA_LABEL[camada]}" é direcional e o glifo dela é "${forma}" (não aponta)`);
      }
      if (declarada === "simetrica" && setaNaTela) {
        erros.push(`"${CAMADA_LABEL[camada]}" é simétrica e o glifo dela é "${forma}" (aponta)`);
      }
    }
    expect(erros).toEqual([]);
  });
});

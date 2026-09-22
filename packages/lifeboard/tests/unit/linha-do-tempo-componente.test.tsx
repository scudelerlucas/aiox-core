import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { montar, novaInstancia, reactFalso, soltarInstancia } from "./hooks-falsos";

/**
 * OS-LIFEBOARD · P5 — rodada 10. A GUARDA QUE TOCA O COMPONENTE.
 *
 * ## O buraco que este arquivo fecha (achado ALTO 2 do crítico)
 *
 * `linha-do-tempo-guarda-de-comportamento.test.ts` tem 641 linhas, diz no topo
 * que "mede a TELA" e importa **zero** módulos de `src/components/`. Ela
 * exercita funções puras de `src/core/timeline/` contra um navegador de
 * mentira escrito no próprio arquivo. As 2.691 linhas de
 * `src/components/timeline/linha-do-tempo.tsx` não tinham guarda nenhuma — e o
 * crítico provou com duas sabotagens de uma linha que passaram com
 * **1354/1354 verdes**:
 *
 * | # | a sabotagem | o que ela fazia na tela |
 * |---|---|---|
 * | S1 | `aplicarPlanoDaFolha(podeRolar ? plano : semRolagem(plano), …)` → `aplicarPlanoDaFolha(semRolagem(plano), …)` | a 390×844 a folha tapava **100%** do rótulo e da barra da linha tocada, em 3 de 3 casos |
 * | S2 | `border-l-2 border-gold-500` → `border-l-2 border-transparent` | a faixa do "Hoje", 1.134px de altura, passava a **0px visíveis** |
 *
 * ## A divisão de trabalho, declarada
 *
 * Aqui (Vitest, sem DOM) mede-se o que a ÁRVORE que o componente devolve
 * afirma: qual elemento existe, com que classe, com que texto. É onde S2 cai —
 * a faixa do "Hoje" é uma cor num `className`, e este arquivo resolve essa cor
 * em `tailwind.config.ts` e MEDE o contraste dela contra o canvas, em vez de
 * comparar strings (trocar `gold-500` por `gold-600` passaria numa comparação
 * de string e é a mesma classe de defeito).
 *
 * O que depende de LAYOUT — dois retângulos se sobrepondo, estilo computado,
 * rolagem de página — não tem como ser medido sem navegador, e não se finge
 * que tem: fica em `tests/navegador/guarda-p5.mjs`, que roda no Chromium
 * contra a rota real. É lá que S1 cai. Escrever aqui um terceiro simulador de
 * navegador para "cobrir" S1 seria repetir o ALTO 2 com outro nome.
 */

vi.mock("react", () => reactFalso);

import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import { montarLinhaDoTempo } from "@/core/timeline/linha-do-tempo";
import { desenhaBarraDeDuracao } from "@/core/timeline/periodo-da-tarefa";
import type { Pr } from "@/lib/frentes/types";
import type { HierarqScore, Source, Task } from "@/types/canonical";
import type { LinhaDoTempoProps, LinhaDoTempoTarefaRow } from "@/types/linha-do-tempo";

import { LinhaDoTempoView, PainelDetalheTarefa } from "@/components/timeline/linha-do-tempo";
import { componentes, nos, texto } from "./arvore-react";

const HOJE = "2026-09-21";

// ── as cores, resolvidas do tema e MEDIDAS (nunca comparadas como string) ────

/** `{ "gold-500": "#E0AE4A", … }` — a mesma leitura de `scripts/checar-contraste.mjs`. */
function tokensDoTema(): Record<string, string> {
  const fonte = readFileSync(new URL("../../tailwind.config.ts", import.meta.url), "utf8");
  const mapa: Record<string, string> = {};
  let grupo: string | null = null;
  for (const linha of fonte.split("\n")) {
    const g = /^\s{8}(\w+): \{/.exec(linha);
    if (g?.[1]) grupo = g[1];
    const c = /^\s{10}"?([\w-]+)"?:\s*"(#[0-9A-Fa-f]{6})"/.exec(linha);
    if (c?.[1] && c[2] && grupo) mapa[`${grupo}-${c[1]}`] = c[2];
  }
  return mapa;
}

const TEMA = tokensDoTema();

function luminancia(hex: string): number {
  const canal = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0);
}

function razaoDeContraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
}

/**
 * A razão de contraste da cor de borda declarada em `className` contra o
 * canvas do painel. `border-transparent` (a sabotagem S2) não resolve num
 * token do tema e devolve `0` — "invisível", que é exatamente o que ela é.
 */
function contrasteDaBorda(className: string, fundo: string): number {
  for (const classe of className.split(/\s+/)) {
    const m = /^border-(?:[lrtb]-)?([a-zA-Z]+-[\w-]+)$/.exec(classe);
    const hex = m?.[1] ? TEMA[m[1]] : undefined;
    if (hex) return razaoDeContraste(hex, fundo);
  }
  return 0;
}

// ── o quadro ────────────────────────────────────────────────────────────────

function tarefa(input: {
  id: string;
  predecessorIds?: string[];
  successorIds?: string[];
  estimativaDias?: number | null;
  isGoal?: boolean;
}): Task {
  const hierarq: HierarqScore = { s1: 1, s2: 1, s3: 1 };
  return {
    id: input.id,
    projectId: "p",
    title: input.id,
    notes: null,
    dueDate: null,
    status: "open",
    priorityHierarq: hierarq,
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: "src-calendar",
    externalRef: input.id,
    updatedAt: "2026-09-10T12:00:00.000Z",
    estimativaDias: input.estimativaDias === undefined ? 2 : input.estimativaDias,
    iniciadoEm: null,
    parentId: null,
    isGoal: input.isGoal ?? false,
    assimetria: null,
  };
}

const FONTES: Source[] = [
  { id: "src-calendar", kind: "calendar", label: "Agenda", authMode: "api", lastSyncAt: null },
];

function assunto(numero: number, titulo: string, criadoEm: string): Pr {
  return {
    repo: "org/repo",
    numero,
    estado: "aberto",
    titulo,
    branch: "b",
    rascunho: false,
    url: `https://github.com/org/repo/pull/${numero}`,
    criado_em: criadoEm,
    atualizado_em: criadoEm,
    fechado_em: null,
    mergeado_em: null,
    checks: null,
  };
}

/**
 * O quadro de prova: "SEM-DURACAO" é a forma exata de "Revisar PR do time" na
 * fixture (dentro do CPM, sem `iniciadoEm` e sem `estimativaDias`), e
 * "MEIO-DIA" é a de "Revisar testes do motor HIERARQ" (`estimativaDias: 0,5`).
 */
function props(): LinhaDoTempoProps {
  const tarefas = [
    tarefa({ id: "META", predecessorIds: ["SEM-DURACAO"], isGoal: true }),
    tarefa({ id: "SEM-DURACAO", estimativaDias: null, successorIds: ["META"] }),
    tarefa({ id: "MEIO-DIA", estimativaDias: 0.5 }),
  ];
  const cpm = caminhoCritico(tarefas, [], HOJE);
  return montarLinhaDoTempo(
    tarefas,
    [],
    [
      assunto(2, "Assunto de setembro", "2026-09-18T12:00:00.000Z"),
      assunto(1, "Assunto de agosto", "2026-08-02T12:00:00.000Z"),
    ],
    FONTES,
    cpm,
    HOJE,
  );
}

function tarefaPorId(p: LinhaDoTempoProps, id: string): LinhaDoTempoTarefaRow {
  const grupo = p.grupos.find((g) => g.titulo === "Tarefas");
  const achada = grupo?.linhas.find((l) => l.kind === "tarefa" && l.id === id);
  if (!achada || achada.kind !== "tarefa") throw new Error(`sem a tarefa ${id} no quadro`);
  return achada;
}

/** Toda data `dd/MM/aaaa` que aparece num texto. */
function datasDitas(t: string): string[] {
  return [...t.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0]);
}

function arvoreDaTela(): ReturnType<typeof LinhaDoTempoView> {
  return montar(novaInstancia(), LinhaDoTempoView, props());
}

beforeEach(() => {
  soltarInstancia();
});

// ── S2 · a faixa do "Hoje" existe e é VISÍVEL ───────────────────────────────

/** As classes das faixas `.lb-tl-hoje` — a do cabeçalho e a do corpo do painel. */
function faixasDoHoje(): string[] {
  return nos(arvoreDaTela())
    .map((n) => String((n.props as { className?: string }).className ?? ""))
    .filter((c) => c.split(/\s+/).includes("lb-tl-hoje"));
}

describe("S2 · a faixa vertical do 'Hoje' (o componente, não o fonte)", () => {
  it("as duas faixas do 'Hoje' (cabeçalho e corpo) estão na árvore que o componente devolve", () => {
    expect(faixasDoHoje()).toHaveLength(2);
  });

  it("a cor de cada faixa resolve no tema e mede ≥ 3:1 contra o canvas — `border-transparent` mede 0", () => {
    const canvas = TEMA["navy-950"];
    expect(canvas).toBeDefined();
    const classes = faixasDoHoje();
    expect(classes.length).toBeGreaterThan(0);
    for (const classe of classes) {
      // 3:1 é a régua de elemento não-textual da casa (WCAG 1.4.11), a mesma
      // de `scripts/checar-contraste.mjs` para borda e ícone. Medir a COR, e
      // não comparar a string, é o que faz este teste pegar também a troca
      // silenciosa por um token escuro, não só por `transparent`.
      expect(contrasteDaBorda(classe, canvas as string)).toBeGreaterThanOrEqual(3);
    }
  });

  it("cada faixa tem largura de traço declarada (`border-l-2`) — faixa de 0px não é faixa", () => {
    const classes = faixasDoHoje();
    expect(classes.length).toBeGreaterThan(0);
    for (const classe of classes) expect(/\bborder-l-[1-9]\b/.test(classe)).toBe(true);
  });
});

// ── CRÍTICO 1 · a gaveta nunca inventa um intervalo de datas ────────────────

describe("CRÍTICO 1 · a gaveta de uma tarefa sem duração estimada", () => {
  it("não imprime NENHUMA data quando nem o início nem a duração foram registrados", () => {
    const p = props();
    const linha = tarefaPorId(p, "MEIO-DIA"); // fora do CPM, sem `iniciadoEm`
    const semNada: LinhaDoTempoTarefaRow = { ...linha, semDuracao: true, estimativaDias: null };
    const arvore = montar(novaInstancia(), PainelDetalheTarefa, {
      linha: semNada,
      onFechar: () => undefined,
    });
    expect(datasDitas(texto(arvore))).toHaveLength(0);
  });

  it("dentro do CPM e sem duração: diz o início previsto e NUNCA o fim de placeholder", () => {
    const p = props();
    const linha = tarefaPorId(p, "SEM-DURACAO");
    // O quadro tem de reproduzir o caso do crítico, senão o teste não vale.
    expect(linha.semDuracao).toBe(true);
    expect(linha.foraDoCpm).toBe(false);
    expect(linha.estimativaDias).toBeNull();
    // O fim é `hoje + DURACAO_PLACEHOLDER` — um número que ninguém digitou.
    expect(linha.fim).not.toBe(linha.inicio);

    const arvore = montar(novaInstancia(), PainelDetalheTarefa, {
      linha,
      onFechar: () => undefined,
    });
    const dito = texto(arvore);
    const [dia, mes, ano] = [linha.fim.slice(8), linha.fim.slice(5, 7), linha.fim.slice(0, 4)];
    expect(dito).not.toContain(`${dia}/${mes}/${ano}`);
    expect(datasDitas(dito)).toHaveLength(1); // só o início previsto
  });

  /**
   * Rodada 11 (achado MÉDIO 3): a tarefa sem duração DEIXOU DE TER BARRA — o
   * desenho não pode afirmar um comprimento que ninguém estimou. O invariante
   * que este teste guarda continua o mesmo ("as duas superfícies dizem a
   * mesma coisa"), só que agora ele cobre os dois casos: quando há barra, é o
   * `title` dela; quando não há, é o `title` do RÓTULO, que passa a ser a
   * única superfície da linha no quadro. O que nunca pode acontecer é a linha
   * ficar sem NENHUMA superfície dizendo o período.
   */
  it("a gaveta e a superfície da linha dizem a MESMA coisa sobre o período", () => {
    const p = props();
    for (const id of ["SEM-DURACAO", "MEIO-DIA", "META"]) {
      const linha = tarefaPorId(p, id);
      const gaveta = texto(
        montar(novaInstancia(), PainelDetalheTarefa, { linha, onFechar: () => undefined }),
      );
      const periodoNaGaveta = gaveta.slice(gaveta.indexOf("Período:") + "Período:".length);
      const trecho = periodoNaGaveta.split("Folga:")[0]?.trim() ?? "";
      expect(trecho.length).toBeGreaterThan(0);

      const temBarra = desenhaBarraDeDuracao(linha);
      const alvo = temBarra ? "BarraTarefa" : "RotuloLinha";
      // O `title` nasce DENTRO do componente — a árvore da tela só carrega o
      // elemento e as props. Monta-se com as props que a tela dá e lê-se o
      // `title` que ele devolve de verdade.
      const elemento = componentes(arvoreDaTela(), alvo).find((b) => {
        const chave = temBarra ? b.props.row : b.props.linha;
        return (chave as { id?: string } | undefined)?.id === linha.id;
      });
      expect(elemento).toBeDefined();
      const titulos = nos(
        montar(
          novaInstancia(),
          elemento?.type as (q: Record<string, unknown>) => unknown,
          elemento?.props as Record<string, unknown>,
        ) as never,
      )
        .map((n) => String((n.props as { title?: string }).title ?? ""))
        .filter((t) => t.startsWith(`${linha.titulo} —`));
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos[0]).toContain(trecho);
    }
  });

  /** A outra metade do MÉDIO 3: sem dado suficiente, nada é desenhado na grade. */
  it("tarefa sem início ou sem duração não desenha barra nenhuma", () => {
    const p = props();
    for (const linha of p.grupos.flatMap((g) => g.linhas)) {
      if (linha.kind !== "tarefa" || linha.semBarra) continue;
      const barra = componentes(arvoreDaTela(), "BarraTarefa").find(
        (b) => (b.props.row as { id?: string } | undefined)?.id === linha.id,
      );
      if (!barra) continue;
      const saida = montar(
        novaInstancia(),
        barra.type as (q: Record<string, unknown>) => unknown,
        barra.props as Record<string, unknown>,
      );
      if (desenhaBarraDeDuracao(linha)) {
        expect(saida).not.toBeNull();
      } else {
        expect(saida).toBeNull();
      }
    }
  });
});

// ── ALTO 3 · "estimativa" só cita número digitado ───────────────────────────

describe("ALTO 3 · a estimativa que a tela cita é a que alguém digitou", () => {
  it("0,5 dia de estimativa sai '0,5', nunca arredondada para '1 dia'", () => {
    const p = props();
    const linha = tarefaPorId(p, "MEIO-DIA");
    expect(linha.estimativaDias).toBe(0.5);
    expect(linha.inicioEstimado).toBe(true);
    const dito = texto(
      montar(novaInstancia(), PainelDetalheTarefa, { linha, onFechar: () => undefined }),
    );
    expect(dito).toContain("0,5");
    expect(dito).not.toContain("estimativa de 1 dia");
  });

  it("a tela nunca cita um número de dias que não venha de `estimativaDias`", () => {
    const p = props();
    for (const linha of p.grupos.flatMap((g) => g.linhas)) {
      if (linha.kind !== "tarefa") continue;
      const dito = texto(
        montar(novaInstancia(), PainelDetalheTarefa, { linha, onFechar: () => undefined }),
      );
      const citados = [...dito.matchAll(/(?:estimativa|duração) de ([\d,]+) dias?/g)].map((m) =>
        Number(String(m[1]).replace(",", ".")),
      );
      for (const n of citados) expect(n).toBe(linha.estimativaDias);
    }
  });
});

// ── MÉDIO 5 · a ordem vertical chega à tela ─────────────────────────────────

describe("MÉDIO 5 · a ordem das linhas que o componente desenha", () => {
  it("os assuntos saem em ordem de data de início, e o componente mantém essa ordem", () => {
    const p = props();
    const assuntos = p.grupos
      .find((g) => g.titulo === "Assuntos")
      ?.linhas.filter((l) => l.kind === "assunto");
    expect(assuntos?.map((a) => a.inicio)).toEqual(["2026-08-02", "2026-09-18"]);

    // A ordem em que o componente POSICIONA as barras de assunto — a `top` de
    // cada uma é `indice * ROW_H`, então a ordem dos elementos É a ordem
    // vertical na tela.
    const barras = componentes(arvoreDaTela(), "BarraAssunto");
    expect(barras.map((b) => (b.props.row as { titulo: string }).titulo)).toEqual([
      "Assunto de agosto",
      "Assunto de setembro",
    ]);
    const tops = barras.map((b) => Number(b.props.top));
    expect(tops).toEqual([...tops].sort((x, y) => x - y));
  });
});

// ── ALTO 1 (rodada 13) · A LEI DA ALTURA DA LINHA, COMO CÓDIGO ──────────────

/**
 * A coluna de rótulos e o canvas são DUAS PILHAS INDEPENDENTES. Elas só se
 * alinham porque `ROW_H = 42` (que posiciona as barras) e `h-[42px]` (a caixa
 * do rótulo) são dois números escritos à mão com o mesmo valor. A lei que os
 * amarra estava escrita num COMENTÁRIO do componente — *"subir para 44
 * desalinharia rótulo e barra"* — e comentário não é portão: o crítico trocou
 * o 42 por 44 e os cinco portões ficaram verdes, com a linha 20 a mais de uma
 * linha inteira de distância do nome dela.
 *
 * Aqui a lei vira código, lendo as DUAS pontas da árvore que o componente
 * devolve (nenhuma constante importada, nenhum `grep` de fonte):
 *   · a altura da linha de CABEÇALHO de grupo, que usa `ROW_H` em `style`;
 *   · a altura da caixa do RÓTULO, que é a classe `h-[Npx]` do botão.
 * Elas têm de ser o mesmo número, e as barras têm de nascer dentro da faixa da
 * própria linha — o que amarra também a ORIGEM da pilha, não só o passo.
 */

/**
 * O `h-[Npx]` do botão de rótulo (a altura da caixa da coluna esquerda). O
 * botão mora DENTRO de `<RotuloLinha>`, que é um componente — a árvore da tela
 * traz o elemento, não o que ele devolve; então cada um é chamado aqui, com as
 * props que a tela lhe deu (mesmo truque de `arvore-react.ts`).
 */
function alturaDaCaixaDoRotulo(): number {
  const botoes = componentes(arvoreDaTela(), "RotuloLinha")
    .map((r) => (r.type as (p: Record<string, unknown>) => { props: Record<string, unknown> })(r.props))
    .filter((b) => typeof b.props["data-lb-linha"] === "string");
  expect(botoes.length).toBeGreaterThan(0);
  const alturas = new Set<number>();
  for (const b of botoes) {
    const m = /\bh-\[(\d+)px\]/.exec(String((b.props as { className?: string }).className ?? ""));
    if (!m?.[1]) throw new Error("botão de rótulo sem altura declarada em `h-[Npx]`");
    alturas.add(Number(m[1]));
  }
  expect([...alturas]).toHaveLength(1);
  return [...alturas][0] as number;
}

/** A altura em `style` do cabeçalho de grupo — é `ROW_H` direto do componente. */
function alturaDaLinhaDoCanvas(): number {
  const cabecalhos = nos(arvoreDaTela()).filter((n) => {
    const st = (n.props as { style?: { height?: unknown } }).style;
    return (
      n.type === "div" &&
      typeof st?.height === "number" &&
      String((n.props as { className?: string }).className ?? "").includes("uppercase")
    );
  });
  expect(cabecalhos.length).toBeGreaterThan(0);
  const alturas = new Set(
    cabecalhos.map((c) => Number((c.props as { style: { height: number } }).style.height)),
  );
  expect([...alturas]).toHaveLength(1);
  return [...alturas][0] as number;
}

/** A ordem em que a tela empilha as linhas: cabeçalho de grupo + linhas dele. */
function indicePorChave(p: LinhaDoTempoProps): Map<string, number> {
  const mapa = new Map<string, number>();
  let i = 0;
  for (const grupo of p.grupos) {
    i += 1; // o cabeçalho do grupo ocupa uma linha inteira
    for (const linha of grupo.linhas) {
      mapa.set(`${linha.kind}-${linha.id}`, i);
      i += 1;
    }
  }
  return mapa;
}

describe("ALTO 1 · a altura da linha é UM número, não dois iguais por sorte", () => {
  it("a faixa do canvas e a caixa do rótulo medem o mesmo — comentário não é portão", () => {
    expect(alturaDaLinhaDoCanvas()).toBe(alturaDaCaixaDoRotulo());
  });

  it("toda barra nasce dentro da faixa da PRÓPRIA linha (mesmo passo, mesma origem)", () => {
    const quadro = props();
    const indices = indicePorChave(quadro);
    const passo = alturaDaCaixaDoRotulo();
    const arvore = arvoreDaTela();
    const desenhos = [...componentes(arvore, "BarraAssunto"), ...componentes(arvore, "BarraTarefa")];
    /* Casar zero não pode ser sucesso: o quadro tem linhas, e cada uma tem de
       ter chegado aqui com a sua chave. */
    expect(desenhos.length).toBe(indices.size);

    const sobras = new Set<number>();
    for (const d of desenhos) {
      const chave = String((d.props as { chave?: string }).chave ?? "");
      const top = Number((d.props as { top?: number }).top);
      const i = indices.get(chave);
      expect(i, `desenho sem rótulo correspondente: ${chave}`).toBeTypeOf("number");
      sobras.add(top - (i ?? 0) * passo);
    }
    /* Um passo diferente (ROW_H = 44 contra `h-[42px]`) espalha a sobra; uma
       origem deslocada (`(i + 1) * ROW_H`) empurra a sobra para fora da faixa. */
    expect([...sobras]).toHaveLength(1);
    const sobra = [...sobras][0] as number;
    expect(sobra).toBeGreaterThanOrEqual(0);
    expect(sobra).toBeLessThan(passo);
  });
});

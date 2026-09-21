import { describe, expect, it } from "vitest";

import { caminhoCritico } from "@/core/prioritize/caminho-critico";
import {
  ALTURA_MINIMA_DA_FOLHA_PX,
  aplicarPlanoDaFolha,
  alturaMaximaDaFolha,
  FAIXA_MINIMA_DA_LINHA_PX,
  MARGEM_ANEL_PX,
  planoDaFolhaInferior,
} from "@/core/timeline/folha-inferior";
import {
  colunasSemMes,
  faixaSuperiorDaTela,
  gerarEscalaEixo,
  larguraAproximada,
  rotulosNaJanela,
} from "@/core/timeline/eixo-rotulos";
import { montarLinhaDoTempo } from "@/core/timeline/linha-do-tempo";
import {
  aplicarTransformDoCabecalho,
  aoRedimensionar,
  rolarESincronizar,
} from "@/core/timeline/sincronizacao-painel";
import type { Pr } from "@/lib/frentes/types";
import type { HierarqScore, Source, Task, TaskStatus } from "@/types/canonical";

/**
 * OS-LIFEBOARD · P5 — rodada 10. A GUARDA DA P5, por COMPORTAMENTO.
 *
 * ## Por que esta guarda substitui a anterior
 *
 * Até a rodada 9 a guarda do painel era uma ANÁLISE SINTÁTICA do componente
 * (`tests/unit/analise-de-fonte.ts`): ela lia a árvore do `.tsx` e procurava
 * escrita em `.scrollLeft`, escrita por colchete, `el.scrollTo(...)`, escrita
 * de estilo e retorno descartado. O crítico hostil da rodada 9 mediu o que ela
 * pegava das 14 sabotagens dele: **3**.
 *
 * A rodada 10 refez a conta com 14 sabotagens derivadas das PROMESSAS da tela
 * (as cinco da tabela abaixo) e mediu, uma a uma, contra a `main` da rodada 9:
 * a guarda sintática **não pegou nenhuma delas**. Duas passaram inteiras pela
 * suíte antiga sem acender nada (inverter a ordem dos grupos; congelar o
 * rótulo do chip do período) e outras duas nem eram expressáveis, porque a
 * promessa não existia (o teto de altura da folha e a âncora de fechamento).
 * Nenhuma das 14 tem a FORMA que a guarda procurava: trocar a ordem dos
 * grupos, desligar o recorte da janela ou devolver o destino no lugar do lido
 * de volta são todas sintaticamente irrepreensíveis.
 *
 * Ler a FORMA do código é medir o autor, não a tela. Esta guarda mede a TELA:
 * monta um modelo mínimo do navegador (um painel que CLAMPA o `scrollLeft`
 * como o Chrome, uma página que satura o `scrollY` no máximo rolável) e faz as
 * FUNÇÕES DE PRODUÇÃO rodarem nele. Toda asserção abaixo é um número em pixels
 * ou uma ordem de linhas — nunca um trecho de código.
 *
 * ## As cinco promessas da P5, e o que cada uma exige em número
 *
 * | # | promessa | o que se mede |
 * |---|---|---|
 * | A | assuntos antes de tarefas, tarefas em ordem de início | a ordem dos grupos e das linhas montadas |
 * | B | a faixa do período fica no topo, sempre nomeando o que se vê | o chip é empurrado, nunca tapa o mês, e diz o período da borda |
 * | C | só entra na tela o rótulo que CABE inteiro | nenhum rótulo cruza a borda direita nem a esquerda |
 * | D | o eixo e as barras rolam juntos | `translateX` do cabeçalho == −`scrollLeft` que o painel DE FATO assumiu |
 * | E | a folha abre sem tapar a linha tocada e fecha sem mexer a página | px da linha debaixo da folha == 0; Δ do conteúdo ao fechar == 0 |
 *
 * As 14 sabotagens da tabela do relatório desta rodada saem daqui: cada `it`
 * abaixo é a asserção que fica VERMELHA quando a sabotagem correspondente é
 * aplicada ao código de produção.
 */

// ── modelo do navegador ──────────────────────────────────────────────────────

/**
 * Um painel que rola como o Chrome: escrever além do máximo GUARDA o máximo, e
 * não dispara evento nenhum. É a única regra do navegador que a promessa D
 * precisa — e é exatamente a que a rodada 6 não tinha em conta.
 */
class PainelDeMentira {
  private valor = 0;
  constructor(
    readonly scrollWidth: number,
    readonly clientWidth: number,
  ) {}
  get scrollLeft(): number {
    return this.valor;
  }
  set scrollLeft(v: number) {
    this.valor = Math.min(Math.max(0, v), Math.max(0, this.scrollWidth - this.clientWidth));
  }
}

/** O cabeçalho da escala — só o que se escreve nele. */
function cabecalhoDeMentira(): { style: { transform: string } } {
  return { style: { transform: "" } };
}

/** `translateX(-123.4px)` → `-123.4`; `NaN` quando ninguém escreveu nada. */
function transformEmPx(alvo: { style: { transform: string } }): number {
  const m = /translateX\((-?[\d.]+)px\)/.exec(alvo.style.transform);
  return m ? Number.parseFloat(m[1]!) : Number.NaN;
}

const ROW_H = 42;
const TOPO_DA_PRIMEIRA_LINHA = 393;
const RODAPE_PX = 64;
const LINHAS_NA_PAGINA = 25;

/** A página do celular: `scrollBy` satura no máximo rolável, como o navegador. */
class PaginaDeMentira {
  espacador = 0;
  scrollY = 0;
  constructor(
    readonly innerWidth: number,
    public innerHeight: number,
  ) {}
  get alturaBase(): number {
    return TOPO_DA_PRIMEIRA_LINHA + LINHAS_NA_PAGINA * ROW_H + RODAPE_PX;
  }
  get alturaDoDocumento(): number {
    return this.alturaBase + this.espacador;
  }
  get maxScroll(): number {
    return Math.max(0, this.alturaDoDocumento - this.innerHeight);
  }
  irPara(y: number): void {
    this.scrollY = Math.min(Math.max(0, y), this.maxScroll);
  }
  rolarPor(px: number): void {
    this.irPara(this.scrollY + px);
  }
  /** O navegador re-clampa sozinho quando o documento encolhe. É aqui que nascia o salto de 139px. */
  assentar(): void {
    this.scrollY = Math.min(this.scrollY, this.maxScroll);
  }
  linha(indice: number): { top: number; bottom: number } {
    const doc = TOPO_DA_PRIMEIRA_LINHA + indice * ROW_H;
    return { top: doc - this.scrollY, bottom: doc + ROW_H - this.scrollY };
  }
  espacadorDeMentira(): { style: { height: string } } {
    // O espaçador é um elemento à parte: escrever nele muda a altura do
    // documento e faz o navegador re-clampar o `scrollY` — é essa cadeia que
    // produzia (e agora não produz mais) o salto de 139px ao fechar.
    const ler = (): string => `${this.espacador}px`;
    const escrever = (v: string): void => {
      this.espacador = Number.parseFloat(v) || 0;
      this.assentar();
    };
    return {
      style: {
        get height(): string {
          return ler();
        },
        set height(v: string) {
          escrever(v);
        },
      },
    };
  }
}

/** A folha inferior com a altura que ela TERIA — o teto entra depois, pelo plano. */
function folhaDeMentira(p: PaginaDeMentira, alturaDesejada: number): {
  rect: { top: number; left: number; width: number; height: number; bottom: number };
  estilo: { style: { maxHeight: string } };
  altura: number;
} {
  const estado = { maxHeight: "" };
  const altura = alturaDesejada;
  return {
    rect: {
      top: p.innerHeight - altura,
      left: 0,
      width: p.innerWidth,
      height: altura,
      bottom: p.innerHeight,
    },
    estilo: { style: estado },
    altura,
  };
}

/**
 * Abre a folha na linha `indice` com a página no fim (o pior caso) e devolve o
 * que o OPERADOR veria: px da linha tocada debaixo da folha, px que a folha
 * ocupa, faixa de linha do tempo que sobra e o Δ do conteúdo ao fechar.
 */
function abrirEFecharAFolha(params: {
  largura: number;
  altura: number;
  indice: number;
  alturaDesejadaDaFolha: number;
}): {
  linhaTapadaPx: number;
  faixaLivrePx: number;
  alturaFinalDaFolha: number;
  deslocamentoAoFechar: number;
  espacoComAFolhaAberta: number;
} {
  const p = new PaginaDeMentira(params.largura, params.altura);
  p.irPara(p.maxScroll);
  const f = folhaDeMentira(p, params.alturaDesejadaDaFolha);
  const espacador = p.espacadorDeMentira();
  const plano = planoDaFolhaInferior({
    folha: f.rect,
    bottomDoBotao: p.linha(params.indice).bottom,
    topoDoBotao: p.linha(params.indice).top,
    larguraJanela: p.innerWidth,
    alturaJanela: p.innerHeight,
    scrollY: p.scrollY,
    alturaDoDocumento: p.alturaDoDocumento,
    espacoAtual: p.espacador,
  });
  aplicarPlanoDaFolha(plano, {
    espacador,
    folha: f.estilo,
    rolarPagina: (px) => p.rolarPor(px),
  });
  // O teto escrito na folha é o que ela passa a medir de verdade.
  const tetoEscrito = Number.parseFloat(f.estilo.style.maxHeight);
  const alturaFinal = Number.isFinite(tetoEscrito) ? Math.min(f.altura, tetoEscrito) : f.altura;
  const topoDaFolha = p.innerHeight - alturaFinal;
  const depois = p.linha(params.indice);
  const linhaTapadaPx = Math.max(0, Math.min(depois.bottom, p.innerHeight) - Math.max(depois.top, topoDaFolha));
  const espacoComAFolhaAberta = p.espacador;

  // ── fechar ────────────────────────────────────────────────────────────────
  const antes = p.linha(params.indice).top;
  const planoFechado = planoDaFolhaInferior({
    folha: null,
    bottomDoBotao: null,
    larguraJanela: p.innerWidth,
    alturaJanela: p.innerHeight,
    scrollY: p.scrollY,
    alturaDoDocumento: p.alturaDoDocumento,
    espacoAtual: p.espacador,
  });
  aplicarPlanoDaFolha(planoFechado, {
    espacador,
    folha: null,
    rolarPagina: (px) => p.rolarPor(px),
  });
  return {
    linhaTapadaPx,
    faixaLivrePx: topoDaFolha,
    alturaFinalDaFolha: alturaFinal,
    deslocamentoAoFechar: Math.round((p.linha(params.indice).top - antes) * 100) / 100,
    espacoComAFolhaAberta,
  };
}

// ── fixtures da montagem ─────────────────────────────────────────────────────

const HOJE = "2026-09-13";

function tarefa(input: {
  id: string;
  status?: TaskStatus;
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
    status: input.status ?? "open",
    priorityHierarq: hierarq,
    predecessorIds: input.predecessorIds ?? [],
    successorIds: input.successorIds ?? [],
    sourceId: "src-calendar",
    externalRef: input.id,
    updatedAt: "2026-07-09T00:00:00.000Z",
    estimativaDias: input.estimativaDias ?? 2,
    iniciadoEm: null,
    parentId: null,
    isGoal: input.isGoal ?? false,
    assimetria: null,
  };
}

const FONTES: Source[] = [
  { id: "src-calendar", kind: "calendar", label: "Agenda", authMode: "api", lastSyncAt: null },
];

function assuntoPr(numero: number, titulo: string): Pr {
  return {
    repo: "org/repo",
    numero,
    estado: "aberto",
    titulo,
    branch: "b",
    rascunho: false,
    url: `https://github.com/org/repo/pull/${numero}`,
    atualizado_em: "2026-09-10T00:00:00.000Z",
    fechado_em: null,
    mergeado_em: null,
    checks: null,
  };
}

function montar(): ReturnType<typeof montarLinhaDoTempo> {
  // De propósito FORA de ordem na entrada: se a montagem deixar de ordenar, a
  // tela sai nesta ordem crua — e é isso que a asserção pega.
  const tarefas = [
    tarefa({ id: "G", predecessorIds: ["D"], isGoal: true }),
    tarefa({ id: "Z" }),
    tarefa({ id: "D", predecessorIds: ["A"], successorIds: ["G"] }),
    tarefa({ id: "A", successorIds: ["D"] }),
  ];
  const cpm = caminhoCritico(tarefas, [], HOJE);
  return montarLinhaDoTempo(
    tarefas,
    [],
    [assuntoPr(1, "Primeiro assunto"), assuntoPr(2, "Segundo assunto")],
    FONTES,
    cpm,
    HOJE,
  );
}

// ── PROMESSA A · a ordem das linhas ──────────────────────────────────────────

describe("A · a tela abre com os ASSUNTOS antes das TAREFAS, e as tarefas em ordem de início", () => {
  it("A1 — o primeiro grupo é 'Assuntos' e o segundo é 'Tarefas' (nesta ordem, sempre)", () => {
    const props = montar();
    expect(props.grupos.map((g) => g.titulo)).toEqual(["Assuntos", "Tarefas"]);
    // E não é só o rótulo: o grupo de assuntos tem de conter os assuntos.
    expect(props.grupos[0]!.linhas.every((l) => l.kind === "assunto")).toBe(true);
    expect(props.grupos[1]!.linhas.every((l) => l.kind === "tarefa")).toBe(true);
  });

  it("A2 — dentro de 'Tarefas', quem começa antes aparece antes (A → D → G)", () => {
    const props = montar();
    const tarefas = props.grupos[1]!.linhas;
    // A entrada veio [G, Z, D, A]; a tela tem de sair na ordem do TEMPO.
    const pos = (id: string): number => tarefas.findIndex((l) => l.id === id);
    expect(pos("A")).toBeLessThan(pos("D"));
    expect(pos("D")).toBeLessThan(pos("G"));
    // E a cadeia sai com os inícios não-decrescentes (13/09 → 15/09 → 17/09).
    const cadeia = ["A", "D", "G"].map((id) => {
      const l = tarefas.find((x) => x.id === id);
      if (!l || l.kind !== "tarefa") throw new Error(`tarefa ${id} sumiu da tela`);
      return l.inicio;
    });
    expect(cadeia).toEqual([...cadeia].sort());
    expect(new Set(cadeia).size).toBe(3);
  });
});

// ── PROMESSA B · a faixa do período no topo ──────────────────────────────────

const ESCALA = gerarEscalaEixo({
  minIso: "2026-06-01",
  maxIso: "2027-02-28",
  pxPorDia: 6,
  hojeIso: HOJE,
});

describe("B · a faixa do período diz, sempre, QUAL período está na tela", () => {
  it("B1 — o chip é EMPURRADO pelo rótulo seguinte: nunca fica em cima de um mês", () => {
    const escondidos: string[] = [];
    let empurrou = 0;
    for (let scrollLeft = 0; scrollLeft <= 1200; scrollLeft += 7) {
      const faixa = faixaSuperiorDaTela({
        rotulosSuperiores: ESCALA.rotulosSuperiores,
        minIso: "2026-06-01",
        pxPorDia: 6,
        periodo: ESCALA.periodoSuperior,
        janela: { scrollLeft, larguraVisivel: 680 },
      });
      const fimDoChip = faixa.chip.x + faixa.chip.largura;
      for (const r of faixa.rotulos) {
        // O rótulo que está EM CIMA da borda fala do mesmo período do chip —
        // o chip é quem manda. Quem vem DEPOIS dela tem de aparecer inteiro.
        if (r.x <= scrollLeft) continue;
        if (r.x - scrollLeft < fimDoChip - 0.01) {
          escondidos.push(`scroll=${scrollLeft} "${r.label}" atrás do chip`);
        }
      }
      if (faixa.chip.x < -0.01) empurrou += 1;
    }
    expect(escondidos).toEqual([]);
    // E o empurrão acontece de verdade — senão a asserção acima seria vácuo.
    expect(empurrou).toBeGreaterThan(0);
  });

  it("B1/B2 — toda coluna desenhada tem o seu mês nomeado em cima (0 órfãs)", () => {
    const escala = gerarEscalaEixo({
      minIso: "2026-06-01",
      maxIso: "2027-02-28",
      pxPorDia: 12,
      hojeIso: HOJE,
    });
    const larguraVisivel = 680;
    let orfas = 0;
    const fim = Math.max(...escala.rotulos.map((r) => r.x), 0);
    for (let scrollLeft = 0; scrollLeft <= Math.max(0, fim - larguraVisivel); scrollLeft += 7) {
      const janela = { scrollLeft, larguraVisivel };
      const faixa = faixaSuperiorDaTela({
        rotulosSuperiores: escala.rotulosSuperiores,
        minIso: "2026-06-01",
        pxPorDia: 12,
        periodo: escala.periodoSuperior,
        janela,
      });
      orfas += colunasSemMes({
        rotulosSuperiores: escala.rotulosSuperiores,
        superioresDesenhados: faixa.rotulos,
        colunasDesenhadas: rotulosNaJanela(escala.rotulos, janela),
        janela,
      }).length;
    }
    expect(orfas).toBe(0);
  });

  it("B2 — a faixa de cima só desenha rótulo que cabe INTEIRO na janela", () => {
    const larguraVisivel = 420;
    const foraDaJanela: { x: number; label: string }[] = [];
    for (let scrollLeft = 0; scrollLeft <= 900; scrollLeft += 11) {
      const faixa = faixaSuperiorDaTela({
        rotulosSuperiores: ESCALA.rotulosSuperiores,
        minIso: "2026-06-01",
        pxPorDia: 6,
        periodo: ESCALA.periodoSuperior,
        janela: { scrollLeft, larguraVisivel },
      });
      for (const r of faixa.rotulos) {
        if (r.x < scrollLeft || r.x + larguraAproximada(r.label) > scrollLeft + larguraVisivel) {
          foraDaJanela.push({ x: r.x, label: r.label });
        }
      }
    }
    expect(foraDaJanela).toEqual([]);
  });

  it("B3 — o chip nomeia o período da BORDA, e muda quando se rola", () => {
    const naBorda = (scrollLeft: number): string =>
      faixaSuperiorDaTela({
        rotulosSuperiores: ESCALA.rotulosSuperiores,
        minIso: "2026-06-01",
        pxPorDia: 6,
        periodo: ESCALA.periodoSuperior,
        janela: { scrollLeft, larguraVisivel: 680 },
      }).chip.label;
    expect(naBorda(0)).toBe("jun/2026");
    // 6px/dia × ~30 d = ~180px por mês: rolar 3 meses tem de trocar o nome.
    expect(naBorda(6 * 92)).not.toBe(naBorda(0));
    const nomes = new Set<string>();
    for (let s = 0; s <= 6 * 270; s += 6 * 31) nomes.add(naBorda(s));
    expect(nomes.size).toBeGreaterThanOrEqual(8);
  });
});

// ── PROMESSA C · o que cabe na viewport ──────────────────────────────────────

describe("C · nenhum rótulo cortado: ou cabe inteiro, ou não é desenhado", () => {
  it("C1 — nenhum rótulo cruza a borda DIREITA da janela, em nenhuma posição de scroll", () => {
    const larguraVisivel = 380;
    const cortados: { scrollLeft: number; label: string; sobra: number }[] = [];
    const larguraTotal = Math.max(
      ...ESCALA.rotulos.map((r) => r.x + larguraAproximada(r.label)),
      larguraVisivel,
    );
    const maxScroll = Math.max(0, larguraTotal - larguraVisivel);
    for (let scrollLeft = 0; scrollLeft <= maxScroll; scrollLeft += 13) {
      for (const r of rotulosNaJanela(ESCALA.rotulos, { scrollLeft, larguraVisivel })) {
        const sobra = r.x + larguraAproximada(r.label) - (scrollLeft + larguraVisivel);
        if (sobra > 0) cortados.push({ scrollLeft, label: r.label, sobra });
      }
    }
    expect(cortados).toEqual([]);
  });

  it("C2 — o recorte existe de verdade: a janela mostra MENOS rótulos que o eixo inteiro", () => {
    const larguraVisivel = 380;
    const visiveis = rotulosNaJanela(ESCALA.rotulos, { scrollLeft: 300, larguraVisivel });
    expect(ESCALA.rotulos.length).toBeGreaterThan(0);
    expect(visiveis.length).toBeLessThan(ESCALA.rotulos.length);
    // E nenhum deles começa antes da borda esquerda.
    for (const r of visiveis) expect(r.x).toBeGreaterThanOrEqual(300);
  });
});

// ── PROMESSA D · eixo e barras rolam juntos ──────────────────────────────────

describe("D · o cabeçalho da escala nunca se afasta das barras", () => {
  it("D1/D4 — destino IMPOSSÍVEL: o cabeçalho segue o que o painel assumiu, não o pedido", () => {
    const painel = new PainelDeMentira(2520, 680);
    const cabecalho = cabecalhoDeMentira();
    const sincronizacao = rolarESincronizar(painel, 9999);
    aplicarTransformDoCabecalho(cabecalho, sincronizacao);
    expect(painel.scrollLeft).toBe(2520 - 680); // clampado pelo navegador
    expect(transformEmPx(cabecalho)).toBe(-painel.scrollLeft);
    // O defeito medido da rodada 6, em número: 9999 − 1840 = 8159px de desvio.
    expect(transformEmPx(cabecalho)).not.toBe(-9999);
  });

  it("D1/D2/D4 — varredura: em 200 destinos, |transform + scrollLeft| == 0 em todos", () => {
    const desvios: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const painel = new PainelDeMentira(2520, 680);
      const cabecalho = cabecalhoDeMentira();
      aplicarTransformDoCabecalho(cabecalho, rolarESincronizar(painel, i * 17 - 200));
      const desvio = Math.abs(transformEmPx(cabecalho) + painel.scrollLeft);
      if (!(desvio <= 0.001)) desvios.push(desvio);
    }
    expect(desvios).toEqual([]);
  });

  it("D3 — depois do resize o cabeçalho RELÊ o painel (nos dois sentidos)", () => {
    // (a) o conteúdo passou a caber: o navegador zerou o `scrollLeft` sozinho,
    // sem disparar `scroll` — foi daí que saíram os 329,6px da rodada 6.
    const coube = new PainelDeMentira(680, 680);
    coube.scrollLeft = 1840;
    const cabecalhoA = cabecalhoDeMentira();
    aplicarTransformDoCabecalho(cabecalhoA, aoRedimensionar(coube));
    expect(coube.scrollLeft).toBe(0);
    expect(transformEmPx(cabecalhoA)).toBe(0);
    // (b) ainda há rolagem de sobra: a posição PERMANECE, e o cabeçalho
    // permanece com ela. Um "ressincronizar" que devolve sempre zero passaria
    // em (a) e mentiria aqui.
    const sobrou = new PainelDeMentira(2520, 500);
    sobrou.scrollLeft = 900;
    const cabecalhoB = cabecalhoDeMentira();
    aplicarTransformDoCabecalho(cabecalhoB, aoRedimensionar(sobrou));
    expect(sobrou.scrollLeft).toBe(900);
    expect(transformEmPx(cabecalhoB)).toBe(-900);
  });

  it("D2 — o sinal do `translateX` é o inverso do scroll (para a esquerda, nunca para a direita)", () => {
    const painel = new PainelDeMentira(2520, 680);
    const cabecalho = cabecalhoDeMentira();
    aplicarTransformDoCabecalho(cabecalho, rolarESincronizar(painel, 400));
    expect(painel.scrollLeft).toBe(400);
    expect(transformEmPx(cabecalho)).toBe(-400);
    expect(transformEmPx(cabecalho)).toBeLessThan(0);
  });
});

// ── PROMESSA E · a folha abre e fecha ────────────────────────────────────────

const LARGURAS_DE_CELULAR = [360, 390, 767] as const;
const ALTURAS_DE_JANELA = [330, 390, 500, 640, 844] as const;
const ALTURAS_DESEJADAS_DA_FOLHA = [130, 197, 238, 320, 506] as const;

describe("E · a folha nunca tapa a linha tocada, e fechá-la não mexe a página", () => {
  it("E1/E3 — 3 larguras × 5 alturas de janela × 5 alturas de folha × 3 últimas linhas: 0px tapados", () => {
    const tapados: string[] = [];
    for (const largura of LARGURAS_DE_CELULAR) {
      for (const altura of ALTURAS_DE_JANELA) {
        for (const alturaDesejadaDaFolha of ALTURAS_DESEJADAS_DA_FOLHA) {
          for (const indice of [
            LINHAS_NA_PAGINA - 1,
            LINHAS_NA_PAGINA - 2,
            LINHAS_NA_PAGINA - 3,
          ]) {
            const r = abrirEFecharAFolha({ largura, altura, indice, alturaDesejadaDaFolha });
            if (r.linhaTapadaPx > 0) {
              tapados.push(`${largura}x${altura} folha=${alturaDesejadaDaFolha} linha=${indice}: ${r.linhaTapadaPx}px`);
            }
          }
        }
      }
    }
    expect(tapados).toEqual([]);
  });

  it("E1 — a reserva abaixo da última linha existe e cobre o pior excesso possível", () => {
    const r = abrirEFecharAFolha({
      largura: 390,
      altura: 844,
      indice: LINHAS_NA_PAGINA - 1,
      alturaDesejadaDaFolha: 197,
    });
    // Sem reserva, `window.scrollBy` é no-op na última linha e a folha tapa.
    expect(r.espacoComAFolhaAberta).toBeGreaterThanOrEqual(r.alturaFinalDaFolha + MARGEM_ANEL_PX);
    expect(r.linhaTapadaPx).toBe(0);
  });

  it("E2 — FECHAR a folha desloca o conteúdo 0px, em toda janela (eram 139px medidos)", () => {
    const saltos: string[] = [];
    for (const largura of LARGURAS_DE_CELULAR) {
      for (const altura of ALTURAS_DE_JANELA) {
        for (const alturaDesejadaDaFolha of ALTURAS_DESEJADAS_DA_FOLHA) {
          const r = abrirEFecharAFolha({
            largura,
            altura,
            indice: LINHAS_NA_PAGINA - 1,
            alturaDesejadaDaFolha,
          });
          if (r.deslocamentoAoFechar !== 0) {
            saltos.push(`${largura}x${altura} folha=${alturaDesejadaDaFolha}: ${r.deslocamentoAoFechar}px`);
          }
        }
      }
    }
    expect(saltos).toEqual([]);
  });

  it("E3 — a folha NUNCA come a linha do tempo inteira: sobra sempre a faixa mínima", () => {
    const estreitas: string[] = [];
    for (const altura of [300, 330, 360, 390, 430, 500, 640, 844]) {
      const r = abrirEFecharAFolha({
        largura: 390,
        altura,
        indice: LINHAS_NA_PAGINA - 1,
        alturaDesejadaDaFolha: 506,
      });
      // A exigência é INDEPENDENTE do teto sob teste: numa janela em que
      // cabem a faixa mínima e a folha mínima, a faixa mínima é obrigatória;
      // abaixo disso, o que sobra depois da folha mínima.
      const faixaExigida =
        altura - ALTURA_MINIMA_DA_FOLHA_PX >= FAIXA_MINIMA_DA_LINHA_PX
          ? FAIXA_MINIMA_DA_LINHA_PX
          : altura - ALTURA_MINIMA_DA_FOLHA_PX;
      if (r.faixaLivrePx < faixaExigida - 0.01) {
        estreitas.push(`${altura}px de janela: só ${r.faixaLivrePx}px de linha do tempo`);
      }
      // E a folha nunca passa de 60% da janela.
      expect(r.alturaFinalDaFolha).toBeLessThanOrEqual(altura * 0.6 + 0.01);
    }
    expect(estreitas).toEqual([]);
  });

  it("E3 — o teto é função da ALTURA da janela, não uma fração fixa", () => {
    // Numa janela baixa, 60% deixariam menos que a faixa mínima: o teto cede.
    expect(alturaMaximaDaFolha(844)).toBe(844 * 0.6);
    expect(alturaMaximaDaFolha(390)).toBe(390 - FAIXA_MINIMA_DA_LINHA_PX);
    expect(alturaMaximaDaFolha(500)).toBeLessThanOrEqual(500 - FAIXA_MINIMA_DA_LINHA_PX);
    // E o teto é monotônico: janela maior nunca dá folha menor.
    let anterior = 0;
    for (let h = 260; h <= 1200; h += 20) {
      const teto = alturaMaximaDaFolha(h);
      expect(teto).toBeGreaterThanOrEqual(anterior - 0.001);
      anterior = teto;
    }
  });
});

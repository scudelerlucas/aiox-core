import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { clampScroll } from "@/core/timeline/geometria-painel";
import {
  aoRedimensionar,
  lerSincronizacao,
  rolarESincronizar,
  scrollParaRevelar,
  type ElementoRolavel,
} from "@/core/timeline/sincronizacao-painel";

/**
 * OS-LIFEBOARD · P5 — rodada 7. A GUARDA MECÂNICA da correção-carro-chefe da
 * rodada 6, em duas camadas.
 *
 * Por que este arquivo existe, medido e não estimado: o crítico hostil da
 * rodada 7 rodou DUAS mutações contra a suíte de 879 testes e as duas ficaram
 * VERDES — (a) reverter `rolarPara` para `el.scrollLeft = destino` e
 * sincronizar o cabeçalho pelo destino cru (o bug LITERAL dos 329,6px da
 * rodada 6) e (b) apagar a re-sincronização do `ResizeObserver`. Os 4 testes
 * de `clampScroll` provavam que a função PURA clampa; nenhum provava que
 * alguém a CHAMA. O mesmo defeito já tinha voltado entre as rodadas 4→5 e 5→6
 * — três vezes o mesmo buraco é infraestrutura faltando, não descuido.
 *
 * Camada 1 (comportamento): o elemento é INJETADO, e o falso abaixo CLAMPA
 * como o navegador (setter que satura em `scrollWidth − clientWidth`). É essa
 * saturação que separa "li de volta" de "acreditei no destino": com a leitura
 * de volta, `transformDoCabecalho === −scrollLeftAplicado`; com o destino cru,
 * os dois divergem exatamente nos 329,6px medidos.
 *
 * Camada 2 (varredura de fonte, a mesma disciplina da peça P6 em
 * `components/task/escrita.ts`): o teste LÊ `components/timeline/
 * linha-do-tempo.tsx` e falha se houver atribuição direta a `.scrollLeft`
 * fora do módulo puro, ou se o `ResizeObserver` do painel não chamar a função
 * de re-sincronização. Sem esta camada, a mutação (a) — que é uma edição no
 * COMPONENTE — continuaria invisível para um teste de unidade do módulo.
 */

/**
 * O painel falso: escrever um valor impossível NÃO o guarda. É exatamente o
 * que o navegador faz — e por isso o `scroll` não dispara (o valor já estava
 * lá) e o cabeçalho, se acreditar no destino, fica adiantado das barras.
 */
class PainelFalso implements ElementoRolavel {
  private valor = 0;
  constructor(
    readonly scrollWidth: number,
    readonly clientWidth: number,
  ) {}
  get scrollLeft(): number {
    return this.valor;
  }
  set scrollLeft(v: number) {
    const max = Math.max(0, this.scrollWidth - this.clientWidth);
    this.valor = Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : 0;
  }
}

/**
 * A MUTAÇÃO (a) do crítico, escrita por extenso: escreve o destino cru e
 * sincroniza o cabeçalho por ele. Está aqui para o teste abaixo PROVAR que a
 * régua distingue as duas implementações — não é código de produção.
 */
function rolarESincronizarMutante(
  elemento: ElementoRolavel,
  destino: number,
): { scrollLeftAplicado: number; transformDoCabecalho: number } {
  elemento.scrollLeft = destino;
  return { scrollLeftAplicado: destino, transformDoCabecalho: -destino };
}

describe("rolarESincronizar — o cabeçalho segue o que a tela TEM, nunca o que pedimos", () => {
  /** O caso medido na rodada 6: 390 → 1024 com o conteúdo de 3000px. */
  const painelApos1024 = (): PainelFalso => new PainelFalso(3000, 1024);
  const DESTINO_IMPOSSIVEL = 2305.6;

  it("destino acima do máximo: o transform do cabeçalho é MENOS o scrollLeft aplicado", () => {
    const el = painelApos1024();
    const s = rolarESincronizar(el, DESTINO_IMPOSSIVEL);
    expect(s.scrollLeftAplicado).toBe(1976); // o máximo real: 3000 − 1024
    expect(s.transformDoCabecalho).toBe(-s.scrollLeftAplicado);
    expect(el.scrollLeft).toBe(s.scrollLeftAplicado);
  });

  it("MUTAÇÃO 'usa o destino cru': o cabeçalho fica 329,6px adiantado das barras", () => {
    const bom = rolarESincronizar(painelApos1024(), DESTINO_IMPOSSIVEL);
    const mau = rolarESincronizarMutante(painelApos1024(), DESTINO_IMPOSSIVEL);
    // O mutante ESCREVE a mesma coisa (o navegador clampa de qualquer jeito) —
    // o que ele erra é aquilo em que o cabeçalho acredita.
    expect(mau.transformDoCabecalho).not.toBe(bom.transformDoCabecalho);
    expect(Math.abs(mau.transformDoCabecalho - bom.transformDoCabecalho)).toBeCloseTo(329.6, 1);
    // E a assinatura do defeito: no mutante, o transform não é o negativo do
    // scrollLeft que o elemento de fato tem.
    const el = painelApos1024();
    const m = rolarESincronizarMutante(el, DESTINO_IMPOSSIVEL);
    expect(m.transformDoCabecalho).not.toBe(-el.scrollLeft);
  });

  it("destino negativo vira 0; conteúdo que cabe inteiro só admite 0", () => {
    expect(rolarESincronizar(new PainelFalso(3000, 1024), -500).scrollLeftAplicado).toBe(0);
    const cabe = rolarESincronizar(new PainelFalso(800, 1024), 900);
    expect(cabe.scrollLeftAplicado).toBe(0);
    expect(cabe.transformDoCabecalho).toBe(-0);
  });

  it("destino dentro da faixa passa intacto; NaN vira 0 (nunca `translateX(NaNpx)`)", () => {
    expect(rolarESincronizar(new PainelFalso(3000, 1024), 1200).scrollLeftAplicado).toBe(1200);
    const podre = rolarESincronizar(new PainelFalso(3000, 1024), Number.NaN);
    expect(podre.scrollLeftAplicado).toBe(0);
    expect(Number.isFinite(podre.transformDoCabecalho)).toBe(true);
  });

  it("usa a MESMA régua de clamp que o resto da tela (uma fonte, não duas)", () => {
    for (const destino of [-10, 0, 500, 1976, 2305.6, 99999]) {
      const el = new PainelFalso(3000, 1024);
      expect(rolarESincronizar(el, destino).scrollLeftAplicado).toBe(
        clampScroll(destino, 3000, 1024),
      );
    }
  });
});

describe("aoRedimensionar — o caminho do ResizeObserver (mutação (b) do crítico)", () => {
  it("o navegador clampou sozinho e não disparou `scroll`: relê e devolve o par certo", () => {
    // O painel estava em 2610 (máximo a 390px de largura). A largura passa a
    // 1024 e o máximo cai para 1976: o navegador guarda 1976 sem avisar.
    const antes = new PainelFalso(3000, 390);
    antes.scrollLeft = 99999;
    expect(antes.scrollLeft).toBe(2610);
    const depois = new PainelFalso(3000, 1024);
    depois.scrollLeft = 2610; // o mesmo clamp silencioso do navegador
    const s = aoRedimensionar(depois);
    expect(s.scrollLeftAplicado).toBe(1976);
    expect(s.transformDoCabecalho).toBe(-1976);
    // MUTAÇÃO (b): não chamar isto deixa o cabeçalho no valor antigo (2610) —
    // os mesmos 634px de desalinho que a rodada 6 corrigiu e ninguém guardava.
    expect(2610 - s.scrollLeftAplicado).toBe(634);
  });

  it("não escreve nada — é leitura pura", () => {
    const el = new PainelFalso(3000, 1024);
    el.scrollLeft = 800;
    aoRedimensionar(el);
    expect(el.scrollLeft).toBe(800);
  });

  it("afordância: diz se há mais conteúdo para cada lado, com folga de subpixel", () => {
    const meio = new PainelFalso(3000, 1024);
    meio.scrollLeft = 500;
    expect(lerSincronizacao(meio).afordancia).toEqual({ esquerda: true, direita: true });
    const inicio = new PainelFalso(3000, 1024);
    expect(lerSincronizacao(inicio).afordancia).toEqual({ esquerda: false, direita: true });
    const fim = new PainelFalso(3000, 1024);
    fim.scrollLeft = 1976;
    expect(lerSincronizacao(fim).afordancia).toEqual({ esquerda: true, direita: false });
    const cabe = new PainelFalso(800, 1024);
    expect(lerSincronizacao(cabe).afordancia).toEqual({ esquerda: false, direita: false });
  });
});

describe("scrollParaRevelar — a barra selecionada continua visível quando o painel comprime (D2)", () => {
  it("já visível: não mexe em nada", () => {
    expect(
      scrollParaRevelar({ inicio: 200, fim: 400, scrollLeftAtual: 100, larguraVisivel: 600 }),
    ).toBe(100);
  });

  it("a barra ficou à DIREITA da janela nova (o painel comeu 300px): alinha pelo fim", () => {
    // 1280 de painel → 980 com a coluna do detalhe. A barra vai de 900 a 1100.
    expect(
      scrollParaRevelar({ inicio: 900, fim: 1100, scrollLeftAtual: 0, larguraVisivel: 980, margem: 12 }),
    ).toBe(1100 + 12 - 980);
  });

  it("a barra ficou à ESQUERDA: alinha pelo início (nunca negativo)", () => {
    expect(
      scrollParaRevelar({ inicio: 50, fim: 120, scrollLeftAtual: 400, larguraVisivel: 300, margem: 12 }),
    ).toBe(38);
    expect(
      scrollParaRevelar({ inicio: 0, fim: 40, scrollLeftAtual: 400, larguraVisivel: 300, margem: 12 }),
    ).toBe(0);
  });

  it("barra mais larga que a janela: o INÍCIO ganha (é onde a barra começa)", () => {
    expect(
      scrollParaRevelar({ inicio: 500, fim: 3000, scrollLeftAtual: 0, larguraVisivel: 400 }),
    ).toBe(500);
  });

  it("painel ainda não medido / valores podres: devolve o scroll atual, nunca lança", () => {
    expect(
      scrollParaRevelar({ inicio: 10, fim: 20, scrollLeftAtual: 77, larguraVisivel: 0 }),
    ).toBe(77);
    expect(
      scrollParaRevelar({ inicio: Number.NaN, fim: 20, scrollLeftAtual: 77, larguraVisivel: 500 }),
    ).toBe(77);
  });
});

// ─── camada 2: a varredura de fonte ──────────────────────────────────────────

const CAMINHO_COMPONENTE = "components/timeline/linha-do-tempo.tsx";

function fonte(arquivo: string): string {
  return readFileSync(fileURLToPath(new URL(`../../src/${arquivo}`, import.meta.url)), "utf8");
}

/**
 * O CÓDIGO, sem comentários. Este arquivo explica POR ESCRITO o bug do
 * `scrollLeft`, e a explicação não pode fazer a varredura confundir a história
 * com o código vivo (o mesmo cuidado da varredura da peça P6).
 */
function codigo(arquivo: string): string {
  return fonte(arquivo)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("varredura de fonte: o componente é casca — quem mexe no scroll é o módulo puro", () => {
  it("PRONTO QUANDO: nenhuma atribuição direta a `.scrollLeft` no componente", () => {
    const alvo = codigo(CAMINHO_COMPONENTE);
    // `x.scrollLeft =` / `x.scrollLeft +=` — qualquer escrita, não a leitura.
    const escritas = alvo.match(/\.scrollLeft\s*(?:\+|-|\*|\/)?=[^=]/g) ?? [];
    expect(escritas).toEqual([]);
  });

  it("o componente importa as duas portas do módulo puro", () => {
    const alvo = codigo(CAMINHO_COMPONENTE);
    expect(alvo).toContain('from "@/core/timeline/sincronizacao-painel"');
    expect(alvo).toContain("rolarESincronizar");
    expect(alvo).toContain("aoRedimensionar");
  });

  it("MUTAÇÃO (b): o `ResizeObserver` do painel re-sincroniza o cabeçalho", () => {
    const alvo = codigo(CAMINHO_COMPONENTE);
    const i = alvo.indexOf("new ResizeObserver((entradas)");
    expect(i).toBeGreaterThan(-1);
    const fim = alvo.indexOf("obs.observe(el)", i);
    expect(fim).toBeGreaterThan(i);
    const corpoDoObservador = alvo.slice(i, fim);
    // Apagar esta chamada é a mutação (b) do crítico — aqui ela fica VERMELHA.
    expect(corpoDoObservador).toContain("aoRedimensionar(el)");
  });

  it("o evento `scroll` do painel também passa pelo módulo (nenhum caminho paralelo)", () => {
    const alvo = codigo(CAMINHO_COMPONENTE);
    expect(alvo).toContain("onScroll={(e) => sincronizarComPainel(e.currentTarget)}");
    const i = alvo.indexOf("const sincronizarComPainel");
    expect(i).toBeGreaterThan(-1);
    expect(alvo.slice(i, i + 220)).toContain("aoRedimensionar(el)");
  });

  it("`rolarPara` (botão Hoje, tecla H, setas, Home/End) também só passa pelo módulo", () => {
    const alvo = codigo(CAMINHO_COMPONENTE);
    const i = alvo.indexOf("const rolarPara =");
    expect(i).toBeGreaterThan(-1);
    expect(alvo.slice(i, i + 220)).toContain("rolarESincronizar(el, destino)");
  });
});

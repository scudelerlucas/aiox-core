/**
 * OS-LIFEBOARD · P4 · rodada 14 — a costura do alcance de tempo da guarda.
 *
 * O achado da rodada 14 foi que `scripts/guarda-no-navegador.mjs` media tudo
 * no COMEÇO da vida da página: uma regressão agendada para 45 s depois da
 * carga apagava 8 das 10 arestas do grafo com os cinco portões verdes. A cura
 * foram as sentinelas §19/§20/§21.
 *
 * Duas das propriedades que sustentam essas medidas NÃO se conferem sozinhas
 * na corrida, porque quem as quebra quebra junto quem as conferiria:
 *
 *  1. **a sentinela nasce ANTES da primeira medida e é lida DEPOIS da
 *     última.** Mover o nascimento para o fim deixaria §19 verde com alcance
 *     de tempo ~0 — a sentinela viveria segundos e diria que viveu;
 *  2. **sob relógio de mentira, quem causa o quadro é a guarda.**
 *     `clock.install()` substitui o `requestAnimationFrame` da página;
 *     esperar um quadro ali é impasse por construção, e a saída seria a
 *     guarda morrer de teto e o veredito virar "não consegui medir" — um
 *     verde que não é verde, pela porta de trás.
 *
 * Este teste é a costura dessas duas, lendo os dois arquivos. Não decide como
 * a guarda mede — decide que ela não pode medir com o alcance encolhido.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const guarda = readFileSync(
  join(process.cwd(), "scripts/guarda-no-navegador.mjs"),
  "utf8",
);
const pixel = readFileSync(join(process.cwd(), "scripts/pixel-do-grafo.mjs"), "utf8");

describe("a guarda de navegador tem sentinela de tempo, e o alcance dela é o declarado", () => {
  it("nasce a sentinela ANTES da primeira medida daquela largura", () => {
    /* Os pontos de CHAMADA dentro do laço de larguras, não as definições:
       comparar definições passaria com o nascimento no fim da corrida. */
    const nascimento = guarda.indexOf("await nascerAsSentinelasDe(browser, caso);");
    /* Rodada 17: cada etapa recebe o navegador como argumento (`(b) => …`) —
       é o que deixa a prova de travamento refazê-la num navegador novo. */
    const primeiraMedida = guarda.indexOf("(b) => medirUmaLargura(b, caso))");
    expect(nascimento).toBeGreaterThan(-1);
    expect(primeiraMedida).toBeGreaterThan(-1);
    expect(nascimento).toBeLessThan(primeiraMedida);
  });

  it("lê a sentinela DEPOIS da última medida daquela largura", () => {
    /* A última medida da largura é o passeio do pan (rodada 17). Sem achar a
       chamada, o teste passaria por ausência — por isso ela é exigida. */
    const ultimaMedida = guarda.indexOf("(b) => medirPasseioDoPan(b, caso))");
    const leitura = guarda.indexOf("§19 sentinela de tempo real");
    expect(ultimaMedida).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(-1);
    expect(leitura).toBeGreaterThan(ultimaMedida);
  });

  it("declara um piso de vida e um adiantamento de relógio, os dois em milissegundos", () => {
    const piso = /const PISO_DE_VIDA_DA_SENTINELA_MS = (\d+);/.exec(guarda);
    const adiantamento = /const ADIANTAMENTO_DO_RELOGIO_MS = (\d+);/.exec(guarda);
    expect(piso).not.toBeNull();
    expect(adiantamento).not.toBeNull();
    expect(Number(piso?.[1])).toBeGreaterThanOrEqual(30_000);
    expect(Number(adiantamento?.[1])).toBeGreaterThanOrEqual(600_000);
  });

  it("o alcance agendado que o texto promete é o que §20 adianta", () => {
    const adiantamento = Number(/const ADIANTAMENTO_DO_RELOGIO_MS = (\d+);/.exec(guarda)?.[1]);
    const prometido = /agendada para até (\d+) minutos depois/.exec(guarda);
    expect(prometido).not.toBeNull();
    expect(Number(prometido?.[1])).toBe(Math.round(adiantamento / 60_000));
  });

  it("§20 adianta o relógio DUAS vezes, com a tela exercida entre elas", () => {
    const bloco = guarda.slice(guarda.indexOf("§20 sentinela do relógio"));
    const antesDeExercitar = bloco.indexOf("exercitarATela(sentinela.page)");
    const adiantamentos = [...bloco.matchAll(/clock\.fastForward\(ADIANTAMENTO_DO_RELOGIO_MS\)/g)];
    expect(adiantamentos).toHaveLength(2);
    expect(antesDeExercitar).toBeGreaterThan(adiantamentos[0]!.index!);
    expect(antesDeExercitar).toBeLessThan(adiantamentos[1]!.index!);
  });

  it("com relógio de mentira, a guarda CAUSA o quadro em vez de esperar por ele", () => {
    const corpo = pixel.slice(
      pixel.indexOf("async function esperarOProximoQuadro"),
      pixel.indexOf("export async function fotosComESem"),
    );
    expect(corpo).toContain("__relogioDeMentira");
    const causa = corpo.indexOf("clock.runFor");
    const espera = corpo.indexOf("requestAnimationFrame(() => requestAnimationFrame(");
    expect(causa).toBeGreaterThan(-1);
    expect(espera).toBeGreaterThan(-1);
    /* O ramo que CAUSA o quadro tem de vir antes — e sair com `return`, ou a
       espera pelo quadro que nunca vem aconteceria do mesmo jeito. */
    expect(causa).toBeLessThan(espera);
    expect(corpo.slice(causa, espera)).toContain("return;");
  });
});

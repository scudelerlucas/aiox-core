import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P7 — RODADA 11. Os consertos A1–A4, B2, B3 e M2, e as NOVE
 * mutações que o crítico aplicou e que passaram batido pelos 1350 testes.
 *
 * Cada `it` aqui existe porque uma mudança REAL no código de produção passou
 * sem derrubar nada. Onde o teste é de ORTOGRAFIA (lê a fonte em vez de rodar
 * o comportamento), ele diz isso com todas as letras — a página não tem DOM no
 * Vitest (`environment: "node"`, sem jsdom), então clique não se simula aqui.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/user-server", () => ({
  createSupabaseUserClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { email: "lucasscudeler@gmail.com" } } }) },
  })),
}));
// `live-client.ts` chama `cache()` de "react" no topo do módulo — fora do Next
// isso lança na importação (o mesmo motivo já documentado nos irmãos).
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T,>(fn: T): T => fn };
});

const { enfileirarPrompt } = await import("@/lib/supabase/live-client");
const { CancelarBotao } = await import("@/components/prompts/cancelar-botao");
const { escolherConta } = await import("@/core/prompts/roteador");
const {
  CONTAS,
  CUSTO_ESTIMADO_POR_COMPLEXIDADE,
  faixaConsumo,
  fraseDoEnfileiramento,
} = await import("@/core/prompts/tipos");
const {
  ajustarTetoFixture,
  definirExigirMedicaoFixture,
  enfileirarFixture,
  envelhecerSinalFixture,
  listarConsumoFixture,
  listarFilaFixture,
  pegarFixture,
  resetarFilaFixtureStore,
} = await import("@/lib/repositories/prompts-fila.fixture-store");

type ConsumoConta = import("@/core/prompts/tipos").ConsumoConta;
type Conta = import("@/core/prompts/tipos").Conta;
type ResultadoFilaFixture =
  import("@/lib/repositories/prompts-fila.fixture-store").ResultadoFilaFixture;
type ResultadoEnfileirarFixture =
  import("@/lib/repositories/prompts-fila.fixture-store").ResultadoEnfileirarFixture;

/** Estreita o retorno do fixture para o caso de enfileiramento, ou falha nomeando. */
function enfileirado(r: ResultadoFilaFixture): ResultadoEnfileirarFixture {
  expect("erro" in r ? r.erro : "", "o enfileiramento recusou quando deveria aceitar").toBe("");
  expect("motivoCodigo" in r, "o retorno não é de enfileiramento").toBe(true);
  return r as ResultadoEnfileirarFixture;
}

const LUCAS: Conta = "lucasscudeler@gmail.com";
const PANDORA: Conta = "lsgpandora@gmail.com";
const ALMA: Conta = "almapetra.ltda@gmail.com";
const AGORA = Date.parse("2026-09-13T12:00:00.000Z");

const FONTE = (arquivo: string): string =>
  readFileSync(join(__dirname, "..", "..", "src", "components", "prompts", arquivo), "utf8");

/** Uma linha de consumo completa, para rodar o roteador como função pura. */
function linha(conta: Conta, patch: Partial<ConsumoConta> = {}): ConsumoConta {
  return {
    conta,
    tetoUsd: 500,
    consumoHojeUsd: 0,
    reservadoUsd: 0,
    naFilaUsd: 0,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
    defasagemHoras: 0.5,
    exigeMedicaoRecente: false,
    historico: null,
    ...patch,
  };
}

/** Só o código que roda vale como prova — comentário citando `Date.now()` não conta. */
function semComentarios(fonte: string): string {
  return fonte
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

function respostaOk(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  resetarFilaFixtureStore();
});

// ═══════════════════════════════════════════════════════════════════ A1 ═══
describe("A1 — a tela promete pela MESMA régua que o banco usa", () => {
  /**
   * O fixture decidia `cabeHoje = custoEstimado <= headroom` (headroom CRU).
   * O SQL decide por ESPAÇO LIVRE (`v_espaco = v_headroom - v_na_fila`,
   * migration 0025 §2). Medido no navegador com as duas réguas convivendo: a
   * tela dizia "cabe hoje contando a fila parada — US$ 0,00 livres".
   */
  it("cabe no headroom mas NÃO no espaço livre → não cabe hoje", () => {
    // Pandora começa com headroom 451,50 e fila parada zero. Quatro `maxima`
    // (US$ 120 cada) deixam US$ 480 parados na fila dela.
    for (let i = 0; i < 4; i += 1) {
      enfileirarFixture({ prompt: `p${i}`, complexidade: "maxima", conta: PANDORA, agora: AGORA });
    }
    const antes = listarConsumoFixture(AGORA).find((c) => c.conta === PANDORA) as ConsumoConta;
    const headroom = antes.tetoUsd - antes.consumoHojeUsd - antes.reservadoUsd;
    const espaco = headroom - antes.naFilaUsd;
    // O caso só prova alguma coisa se as duas réguas DIVERGIREM aqui.
    expect(headroom, "headroom precisa comportar o item").toBeGreaterThanOrEqual(120);
    expect(espaco, "espaço livre NÃO pode comportar o item").toBeLessThan(120);

    const r = enfileirado(
      enfileirarFixture({
        prompt: "o quinto",
        complexidade: "maxima",
        conta: PANDORA,
        agora: AGORA,
      }),
    );
    expect(r.cabeHoje).toBe(false);
    expect(r.motivoCodigo).toBe("manual_nao_cabe_hoje");
    expect(r.espacoLivreUsd).toBeCloseTo(espaco, 2);
  });

  it("a frase e o veredito falam do MESMO número (nada de 'cabe hoje — US$ 0,00 livres')", () => {
    for (let i = 0; i < 4; i += 1) {
      enfileirarFixture({ prompt: `p${i}`, complexidade: "maxima", conta: PANDORA, agora: AGORA });
    }
    const r = enfileirado(
      enfileirarFixture({
        prompt: "o quinto",
        complexidade: "maxima",
        conta: PANDORA,
        agora: AGORA,
      }),
    );
    const frase = fraseDoEnfileiramento(r.motivoCodigo, {
      conta: r.conta,
      complexidade: r.complexidade,
      headroomUsd: r.headroomUsd,
      espacoLivreUsd: r.espacoLivreUsd,
      custoEstimadoUsd: r.custoEstimadoUsd,
      naFilaUsd: r.naFilaUsd,
      itensNaFrente: r.itensNaFrente,
    });
    expect(frase).toContain("não cabe hoje contando a fila parada");
    // A contradição medida no navegador: "cabe hoje … — US$ 0,00 livres".
    expect(frase, "a frase afirma o que o veredito nega").not.toMatch(/(?:^|[^ã]o )cabe hoje/);
  });
});

// ═══════════════════════════════════════════════════════════════════ A2 ═══
describe("A2 — no automático quem vereditou foi o ROTEADOR", () => {
  it("as contas candidatas travadas por medição: o roteador diz não e a loja repete", () => {
    // Lucas sai da disputa pelo TETO (o item nunca caberia nele); Pandora e
    // Alma ficam, e as duas exigem medição recente sem medição fresca.
    ajustarTetoFixture(LUCAS, 100);
    definirExigirMedicaoFixture(PANDORA, true); // Pandora nunca mediu nada
    const consumos = listarConsumoFixture(AGORA);
    const escolha = escolherConta(consumos, "maxima", AGORA);
    expect(escolha.todasRecusadas, "o cenário só vale com TODAS recusadas").toBe(true);
    expect(escolha.cabeHoje).toBe(false);

    const r = enfileirado(enfileirarFixture({ prompt: "x", complexidade: "maxima", agora: AGORA }));
    expect(r.cabeHoje).toBe(false);
    expect(r.conta).toBe(escolha.conta);
  });
});

// ═══════════════════════════════════════════════════════════════════ A3 ═══
describe("A3 — o pull RECUSA de verdade, e recusa antes de escrever", () => {
  it("conta com medição velha e trava ligada: item nenhum sai, e a frase é a recusa", () => {
    ajustarTetoFixture(ALMA, 800); // dinheiro sobrando: o bloqueio é a medição
    enfileirado(
      enfileirarFixture({ prompt: "x", complexidade: "baixa", conta: ALMA, agora: AGORA }),
    );

    const r = pegarFixture(ALMA, "W-1", AGORA);
    expect(r.item, "o pull ENTREGAVA o item dizendo que não autorizava").toBeNull();
    expect(r.recusadoPorMedicao).toBe(true);
    expect(r.defasagemHoras).toBe(13);
    expect(r.motivo).toBe(
      "não autorizo contra saldo de 13 h atrás: esta conta exige medição recente",
    );
    expect(r.headroomUsd, "BAIXO 5: headroom nunca sai negativo").toBeGreaterThanOrEqual(0);
  });

  it("a recusa vem ANTES de qualquer escrita: item mudo não é devolvido nem morto", () => {
    ajustarTetoFixture(ALMA, 800);
    definirExigirMedicaoFixture(ALMA, false);
    enfileirado(
      enfileirarFixture({ prompt: "x", complexidade: "baixa", conta: ALMA, agora: AGORA }),
    );
    const pego = pegarFixture(ALMA, "W-1", AGORA);
    const id = pego.item?.id ?? "";
    expect(id, "o cenário precisa de um item EM EXECUÇÃO para envelhecer").not.toBe("");
    envelhecerSinalFixture(id, 90, AGORA); // 90 min sem sinal: seria devolvido
    definirExigirMedicaoFixture(ALMA, true);

    const r = pegarFixture(ALMA, "W-2", AGORA);
    expect(r.recusadoPorMedicao).toBe(true);
    expect(r.devolvidos, "expirar() rodou apesar da recusa").toBe(0);
    expect(r.mortos).toBe(0);
    const item = listarFilaFixture(200).find((i) => i.id === id);
    expect(item?.estado, "o item mudo foi mexido por um pull que recusou").toBe("pega");
  });
});

// ═══════════════════════════════════════════════════════════════════ A4 ═══
describe("A4 — `todas_recusadas` tem código e frase próprios", () => {
  it("fixture: nenhuma conta autoriza → `auto_medicao_velha`, não `auto_nao_cabe_hoje`", () => {
    ajustarTetoFixture(LUCAS, 100);
    definirExigirMedicaoFixture(PANDORA, true);
    const r = enfileirado(enfileirarFixture({ prompt: "x", complexidade: "maxima", agora: AGORA }));
    expect(r.motivoCodigo).toBe("auto_medicao_velha");
  });

  it("a frase fala de MEDIÇÃO, e não se desmente no meio", () => {
    const frase = fraseDoEnfileiramento("auto_medicao_velha", {
      conta: PANDORA,
      complexidade: "alta",
      headroomUsd: 500,
      espacoLivreUsd: 500,
      custoEstimadoUsd: 50,
      naFilaUsd: 0,
      itensNaFrente: 0,
    });
    expect(frase).toContain("nenhuma conta autoriza gasto agora");
    expect(frase).toContain("a medição está parada");
    // O defeito medido: "nenhuma conta tem US$ 50,00 livres … a mais folgada
    // tem US$ 500,00" — duas metades que se contradizem na mesma frase.
    expect(frase).not.toContain("nenhuma conta tem US$ 50,00 livres");
  });

  it("live: a RPC devolve `todas_recusadas` e o cliente LÊ (antes: zero ocorrências)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const corpo = {
      ok: true,
      id: "abc",
      conta: PANDORA,
      complexidade: "alta",
      modelo_sugerido: "Opus",
      motivo_codigo: "auto_nao_cabe_hoje",
      cabe_hoje: false,
      headroom_usd: 500,
      espaco_livre_usd: 500,
      custo_estimado_usd: 50,
      na_fila_usd: 0,
      itens_na_frente: 0,
      todas_recusadas: true,
    };
    fetchMock.mockResolvedValueOnce(respostaOk(corpo));
    const r = await enfileirarPrompt({ prompt: "x", complexidade: "alta" });
    expect("erro" in r ? r.erro : "").toBe("");
    expect("motivoCodigo" in r ? r.motivoCodigo : "").toBe("auto_medicao_velha");

    // E sem `todas_recusadas`, o código continua o de dinheiro.
    fetchMock.mockResolvedValueOnce(respostaOk({ ...corpo, todas_recusadas: false }));
    const r2 = await enfileirarPrompt({ prompt: "x", complexidade: "alta" });
    expect("motivoCodigo" in r2 ? r2.motivoCodigo : "").toBe("auto_nao_cabe_hoje");
    vi.unstubAllGlobals();
  });

  it("a frase final que o operador lê sai da server action, sem contradição", () => {
    const frase = fraseDoEnfileiramento("auto_medicao_velha", {
      conta: PANDORA,
      complexidade: "alta",
      headroomUsd: 500,
      espacoLivreUsd: 500,
      custoEstimadoUsd: 50,
      naFilaUsd: 0,
      itensNaFrente: 0,
    });
    expect(frase).not.toContain("a mais folgada tem");
  });
});

// ═══════════════════════════════════════════════════════════════════ B2 ═══
describe("B2 — `agora` chega às DUAS decisões de tempo do enfileiramento", () => {
  it("o instante do chamador é o instante do roteador e o da trava de medição", () => {
    ajustarTetoFixture(LUCAS, 100);
    definirExigirMedicaoFixture(PANDORA, true);
    // 40 dias depois, a medição de TODAS envelheceu — mas o relógio real da
    // máquina não. Se `agora` não chegasse, o veredito sairia do `Date.now()`.
    const futuro = AGORA + 40 * 24 * 3_600_000;
    const escolha = escolherConta(listarConsumoFixture(futuro), "maxima", futuro);
    const r = enfileirado(enfileirarFixture({ prompt: "x", complexidade: "maxima", agora: futuro }));
    expect(r.conta).toBe(escolha.conta);
    expect(r.cabeHoje).toBe(escolha.cabeHoje);
  });

  it("a fonte não chama `Date.now()` dentro de `enfileirarFixture`", () => {
    const fonte = readFileSync(
      join(__dirname, "..", "..", "src", "lib", "repositories", "prompts-fila.fixture-store.ts"),
      "utf8",
    );
    const abre = fonte.indexOf("export function enfileirarFixture(");
    // O default do parâmetro (`input.agora ?? Date.now()`) é o ÚNICO lugar
    // legítimo: dali para baixo, quem manda é `agora`.
    const inicio = fonte.indexOf("const agora = input.agora ?? Date.now();", abre);
    const fim = fonte.indexOf("\nexport function", abre + 10);
    const corpo = semComentarios(fonte.slice(inicio + 40, fim));
    expect(abre).toBeGreaterThan(0);
    expect(inicio).toBeGreaterThan(0);
    expect(corpo, "`agora` é parâmetro desta função — o relógio real não entra aqui").not.toContain(
      "Date.now()",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════ B3 ═══
describe("B3 — o 2º clique no cancelamento em voo não é recusado em silêncio", () => {
  it("com o cancelamento em andamento, a região viva explica em português", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao id="i-1" pendente aoMudarConfirmando={() => {}} aoConfirmar={() => {}} />,
    );
    expect(html).toContain("já está em andamento");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("sem cancelamento em voo, a frase não aparece (ela fala de AGORA)", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao id="i-1" aoMudarConfirmando={() => {}} aoConfirmar={() => {}} />,
    );
    expect(html).not.toContain("já está em andamento");
  });
});

// ═══════════════════════════════════════════════════════════════════ M2 ═══
describe("M2 — nenhuma região `sr-only` da fila escapa do recorte da tabela", () => {
  /**
   * ORTOGRAFIA, e é o bastante para esta lei: `sr-only` é `position:absolute`
   * sem deslocamento, e um absoluto de deslocamento automático fica na
   * "posição estática" — dentro da tabela de 880 px. Medido no navegador em
   * 820×1180: `scrollWidth` 894 contra 820 de viewport (74 px de rolagem
   * lateral da PÁGINA inteira); esconder a tabela derrubava para 820. Com
   * `relative` no pai e `left-0 top-0` no parágrafo: 820, rolagem 0.
   * Telefone (390) e desktop (1440) davam 0 antes e depois.
   */
  it("todo `sr-only` de região viva da fila é ancorado (`left-0 top-0`)", () => {
    const soltos: string[] = [];
    for (const arquivo of ["cancelar-botao.tsx", "mensagem-da-fila.tsx"]) {
      const fonte = FONTE(arquivo);
      for (const achado of fonte.matchAll(/"(sr-only[^"]*)"/g)) {
        const classe = achado[1] as string;
        if (!/\bleft-0\b/.test(classe) || !/\btop-0\b/.test(classe)) {
          soltos.push(`${arquivo}: "${classe}"`);
        }
      }
    }
    expect(
      soltos,
      "região `sr-only` sem âncora: ela escapa do `overflow-x-auto` da tabela e estica a página",
    ).toEqual([]);
  });

  it("o pai da região viva de `cancelar-botao` é posicionado", () => {
    expect(FONTE("cancelar-botao.tsx")).toContain(
      'className="relative flex flex-col items-end gap-1"',
    );
  });
});

// ═════════════════════════════════════════════════ as 9 mutações ═════════
describe("as 9 mutações que sobreviveram à rodada 10", () => {
  /**
   * M1 · `roteador.ts`: apagar `!todasRecusadas &&` de `cabeHoje`.
   *
   * MEDIDO NESTA RODADA: sozinha, essa mutação é EQUIVALENTE — `cabeHoje` é
   * calculado antes do `if (todasRecusadas) { … return … cabeHoje: false }`,
   * então o termo apagado não muda saída nenhuma enquanto o retorno adiantado
   * existir. São DUAS travas para a mesma lei (D36), de propósito. Por isso
   * aqui vão duas afirmações: a LEI, que fica vermelha se alguém apagar a
   * outra trava também, e a REDUNDÂNCIA, que fica vermelha se apagarem esta.
   */
  it("M1 · a lei D36: todas as contas recusadas ⇒ não cabe hoje", () => {
    const travadas = CONTAS.map((c) =>
      linha(c, { exigeMedicaoRecente: true, defasagemHoras: 40 }),
    );
    const e = escolherConta(travadas, "alta", AGORA);
    // Dinheiro de sobra em todas — e mesmo assim não cabe hoje: o pull recusa.
    expect(e.espacoLivreUsd).toBeGreaterThanOrEqual(CUSTO_ESTIMADO_POR_COMPLEXIDADE.alta);
    expect(e.todasRecusadas).toBe(true);
    expect(e.cabeHoje, "D36: não se convida para o que o banco recusa 100% das vezes").toBe(false);
    expect(e.motivo).toContain("Nenhuma conta autoriza gasto agora");
  });

  it("M1 · a SEGUNDA trava de D36 continua escrita (ORTOGRAFIA — ela é redundante de propósito)", () => {
    const fonte = readFileSync(
      join(__dirname, "..", "..", "src", "core", "prompts", "roteador.ts"),
      "utf8",
    );
    expect(
      fonte,
      "o `!todasRecusadas &&` de `cabeHoje` é a trava que sobra se o retorno adiantado sumir",
    ).toContain("const cabeHoje = !todasRecusadas && custoEstimado <= melhorEspaco;");
    expect(fonte, "e o retorno adiantado é a outra").toContain("if (todasRecusadas) {");
  });

  it("M2 · `fixture-store.ts`: `conta = escolha.conta` virar `CONTAS[2]`", () => {
    const escolha = escolherConta(listarConsumoFixture(AGORA), "baixa", AGORA);
    const r = enfileirado(enfileirarFixture({ prompt: "x", complexidade: "baixa", agora: AGORA }));
    expect(r.conta).toBe(escolha.conta);
    // E o valor concreto, para uma constante fixa não passar por coincidência:
    expect(r.conta).toBe(LUCAS);
    expect(CONTAS[2]).not.toBe(LUCAS);
  });

  it("M3 · `fixture-store.ts`: trocar a régua de `cabeHoje`", () => {
    for (let i = 0; i < 4; i += 1) {
      enfileirarFixture({ prompt: `p${i}`, complexidade: "maxima", conta: PANDORA, agora: AGORA });
    }
    const c = listarConsumoFixture(AGORA).find((x) => x.conta === PANDORA) as ConsumoConta;
    const headroom = c.tetoUsd - c.consumoHojeUsd - c.reservadoUsd;
    // As duas réguas divergem: com a errada passa, com a certa não.
    expect(CUSTO_ESTIMADO_POR_COMPLEXIDADE.maxima <= headroom).toBe(true);
    expect(CUSTO_ESTIMADO_POR_COMPLEXIDADE.maxima <= headroom - c.naFilaUsd).toBe(false);
    const r = enfileirado(
      enfileirarFixture({ prompt: "x", complexidade: "maxima", conta: PANDORA, agora: AGORA }),
    );
    expect(r.cabeHoje).toBe(false);
  });

  it("M4 · `roteador.ts`: `<=` virar `<` no espaço livre", () => {
    const custo = CUSTO_ESTIMADO_POR_COMPLEXIDADE.alta;
    // Espaço livre EXATAMENTE igual ao custo do item.
    const e = escolherConta([linha(LUCAS, { consumoHojeUsd: 500 - custo })], "alta", AGORA);
    expect(e.espacoLivreUsd).toBe(custo);
    expect(e.cabeHoje, "o item que cabe exatamente CABE").toBe(true);
  });

  it("M5 · `roteador.ts`: `>=` virar `>` no teto", () => {
    const custo = CUSTO_ESTIMADO_POR_COMPLEXIDADE.alta;
    // Teto EXATAMENTE igual ao custo do item: a conta continua na disputa.
    const e = escolherConta([linha(LUCAS, { tetoUsd: custo })], "alta", AGORA);
    expect(e.conta, "conta cujo teto comporta o item exatamente não sai da disputa").toBe(LUCAS);
    expect(e.motivo).not.toContain("Nunca vai caber");
  });

  it("M6 · `tipos.ts`: `razao >= 0.9` virar `>`", () => {
    expect(faixaConsumo(90, 0, 100), "0,9 exato é crítico, não amarelo").toBe("crit");
    expect(faixaConsumo(60, 0, 100), "0,6 exato é amarelo, não verde").toBe("warn");
    expect(faixaConsumo(89.99, 0, 100)).toBe("warn");
  });

  it("M8 · `cancelar-botao.tsx`: apagar `if (pendente) return;`", () => {
    // ORTOGRAFIA: sem DOM no Vitest, o clique não se simula. Esta é a guarda
    // que fica vermelha quando a linha some — e o `it` do bloco B3 acima prova
    // que a recusa tem frase.
    const fonte = FONTE("cancelar-botao.tsx");
    const inicio = fonte.indexOf("function aoClicar()");
    const corpo = fonte.slice(inicio, fonte.indexOf("\n  }", inicio));
    expect(inicio).toBeGreaterThan(0);
    expect(corpo, "a guarda do clique repetido sumiu de `aoClicar`").toMatch(
      /if \(pendente\) return;/,
    );
    expect(
      corpo.indexOf("if (pendente) return;"),
      "a guarda precisa vir ANTES de disparar a ação",
    ).toBeLessThan(corpo.indexOf("aoConfirmar?.(id)"));
  });

  it("M9 · `novo-prompt-form.tsx`: `disabled={false}` no botão primário", async () => {
    vi.doMock("@/components/prompts/usar-acao-prompt", () => ({
      useAcaoPrompt: () => ({ estado: {}, pendente: false, disparar: () => {} }),
    }));
    vi.resetModules();
    const { NovoPromptForm } = await import("@/components/prompts/novo-prompt-form");
    const html = renderToStaticMarkup(
      <NovoPromptForm
        complexidade="baixa"
        aoMudarComplexidade={() => {}}
        contaOverride=""
        aoMudarContaOverride={() => {}}
        modeloImplicado="Haiku"
        motivoAuto="agora iria para Lucas"
        contaAuto={LUCAS}
        tarefas={[]}
      />,
    );
    vi.doUnmock("@/components/prompts/usar-acao-prompt");
    vi.resetModules();
    // Prompt vazio: a ação primária NÃO pode estar clicável.
    const botao = /<button type="submit"[^>]*>/.exec(html)?.[0] ?? "";
    expect(botao, "o botão primário não foi encontrado no HTML").not.toBe("");
    // `disabled=""` é o ATRIBUTO. A classe `disabled:opacity-50` também contém
    // a palavra e faria um `toContain("disabled")` passar com a mutação posta.
    expect(botao, "com prompt vazio o botão primário tem de nascer desabilitado").toMatch(
      /\sdisabled=""/,
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════ P2 do Codex (PR #42, 23ª rodada) ═══
describe("23ª rodada — medição velha não apaga os outros bloqueios do enfileiramento", () => {
  const numeros = {
    conta: PANDORA,
    complexidade: "alta" as const,
    headroomUsd: 500,
    espacoLivreUsd: 500,
    custoEstimadoUsd: 50,
    naFilaUsd: 0,
    itensNaFrente: 0,
  };

  it("só a medição: a frase de antes, que nega a falta de espaço", () => {
    const frase = fraseDoEnfileiramento("auto_medicao_velha", numeros);
    expect(frase).toContain("Não é falta de espaço");
    expect(frase).toContain("Entra na fila e roda quando a medição voltar.");
  });

  it("medição + dinheiro + vaga: não nega o espaço e pede as três coisas", () => {
    const frase = fraseDoEnfileiramento("auto_medicao_velha", {
      ...numeros,
      espacoLivreUsd: 20,
      todasSemVaga: true,
    });
    expect(frase).not.toContain("Não é falta de espaço");
    expect(frase).toContain("o dia também não tem espaço — só US$ 20,00 livres");
    expect(frase).toContain("todas as contas estão no limite de sessões em voo");
    expect(frase).toContain("Entra na fila e roda quando a medição voltar, houver espaço e uma sessão fechar.");
  });

  it("live: `todas_sem_vaga` chega à frase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      respostaOk({
        ok: true,
        id: "abc",
        conta: PANDORA,
        complexidade: "alta",
        motivo_codigo: "auto_nao_cabe_hoje",
        cabe_hoje: false,
        headroom_usd: 500,
        espaco_livre_usd: 500,
        custo_estimado_usd: 50,
        na_fila_usd: 0,
        itens_na_frente: 0,
        todas_recusadas: true,
        todas_sem_vaga: true,
      }),
    );
    const r = await enfileirarPrompt({ prompt: "x", complexidade: "alta" });
    vi.unstubAllGlobals();
    expect("motivoCodigo" in r ? r.motivoCodigo : "").toBe("auto_medicao_velha");
    expect("todasSemVaga" in r ? r.todasSemVaga : undefined).toBe(true);
  });
});

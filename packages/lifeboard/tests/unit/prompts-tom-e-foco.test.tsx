import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MensagemDaFila,
  frasePeLancamento,
} from "@/components/prompts/mensagem-da-fila";
import { alvoAposExclusaoDeNota, focarComAlternativa } from "@/components/task/foco";
import { ContaCard } from "@/components/prompts/conta-card";
import {
  POSTO_ESTIMATIVA,
  custoAoCancelarUsd,
  custoNaTela,
  estadoDaMedicao,
  fraseDoCancelamento,
  headroomUsd,
  horasDeDefasagem,
  livroAceita,
  textoSemAjuste,
  textoTetoVsRealidade,
} from "@/core/prompts/tipos";

// `FilaTabela` (client component) usa `useRouter` via `usar-acao-prompt`.
vi.mock("next/navigation", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("next/navigation")>();
  return { ...original, useRouter: () => ({ refresh: vi.fn() }) };
});
vi.mock("@/lib/supabase/live-client", () => ({
  loadFilaPromptsState: vi.fn(),
  enfileirarPrompt: vi.fn(),
  cancelarPromptFila: vi.fn(),
  ajustarCustoPrompt: vi.fn(),
}));

const { FilaTabela, podeAjustarCusto, estadoInicialDoAjuste, aplicarMudancaNoAjuste } = await import(
  "@/components/prompts/fila-tabela"
);
const { AjustarCustoBotao } = await import("@/components/prompts/ajustar-custo-botao");

/**
 * OS-LIFEBOARD · P7 — rodada 6: MÉDIO 4 (a cor do dinheiro), MÉDIO 3 (o botão
 * que prometia e não movia nada) e BAIXO 3 (o foco no `<body>`).
 *
 * O que ESTES testes provam e o que NÃO provam, sem eufemismo: o pacote não
 * tem jsdom, então aqui se prova o CONTRATO renderizado (que classe sai, que
 * `tabIndex` sai, que botão existe) e a FUNÇÃO de foco (que é pura e
 * injetável). O `.focus()` de verdade — `document.activeElement !== body`
 * depois de cancelar e depois de ajustar, em 1280 e em 390 — é medido no
 * navegador, com Playwright, contra o build de produção (ver o relatório da
 * rodada e DEPLOY.md).
 */

const AGORA = Date.parse("2026-09-13T18:00:00.000Z");

function item(patch: Record<string, unknown> = {}): never {
  return {
    id: "i-1",
    conta: "lucasscudeler@gmail.com",
    prompt: "auditar RLS",
    promptTamanho: 11,
    complexidade: "maxima",
    modeloSugerido: "Fable",
    estado: "falhou",
    custoUsd: 120,
    custoEstimadoUsd: 120,
    criadoEm: new Date(AGORA - 3_600_000).toISOString(),
    pegoEm: new Date(AGORA - 3_000_000).toISOString(),
    concluidoEm: new Date(AGORA - 60_000).toISOString(),
    heartbeatEm: null,
    workerId: null,
    tentativas: 3,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: "expirou 3 vezes sem fechamento",
    custoEEstimativa: true,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: null,
    taskId: null,
    ...patch,
  } as never;
}

describe("MÉDIO 4 — a frase que LANÇA dinheiro nunca sai em verde de sucesso", () => {
  it("cancelamento em execução: a action manda `atencao` e a classe é a de espera", () => {
    const frase = fraseDoCancelamento("cancelado_em_execucao", 120, 1);
    expect(frase).toContain("US$ 120,00 entram no gasto de hoje");

    const html = renderToStaticMarkup(<MensagemDaFila mensagem={frase} tom="atencao" />);
    expect(html).toContain("text-state-progress");
    expect(html).not.toContain("text-state-done");
  });

  it("cinto e suspensório: sem `tom`, a própria frase denuncia o lançamento", () => {
    // O par `text-state-progress` já está na régua de contraste da casa
    // (scripts/checar-contraste.mjs) — não é uma cor nova inventada aqui.
    const frase = fraseDoCancelamento("cancelado_apos_devolucao", 50, 2);
    expect(frasePeLancamento(frase)).toBe(true);
    const html = renderToStaticMarkup(<MensagemDaFila mensagem={frase} />);
    expect(html).toContain("text-state-progress");
  });

  /*
   * P2 do Codex (PR #42): item que já rodou mas cujo custo já estava no livro
   * (a sessão vinculada publicou, a estimativa foi recusada pelo posto) volta
   * com `custo_lancado_usd = 0`. A frase dizia "US$ 0,00 entram no gasto de
   * hoje" e mandava ajustar na linha — o ajuste que a tela já não oferece.
   */
  it("cancelamento de item que já rodou sem lançar nada não promete dinheiro nem ajuste", () => {
    for (const [codigo, tentativas] of [
      ["cancelado_em_execucao", 1],
      ["cancelado_apos_devolucao", 2],
    ] as const) {
      const frase = fraseDoCancelamento(codigo, 0, tentativas);
      expect(frase).not.toContain("US$ 0,00");
      expect(frase).not.toContain("ajuste na linha");
      expect(frase).toContain("não soma nada ao gasto de hoje");
      expect(frasePeLancamento(frase)).toBe(false);
    }
  });

  it("cancelamento que NÃO custou nada continua em verde", () => {
    const frase = fraseDoCancelamento("cancelado_nunca_pego", 0, 0);
    expect(frasePeLancamento(frase)).toBe(false);
    const html = renderToStaticMarkup(<MensagemDaFila mensagem={frase} tom="sucesso" />);
    expect(html).toContain("text-state-done");
    expect(html).not.toContain("text-state-progress");
  });

  it("a região vazia continua `sr-only` e SEM tabIndex (não vira parada de tabulação)", () => {
    const html = renderToStaticMarkup(<MensagemDaFila />);
    expect(html).toContain("sr-only");
    expect(html).not.toContain("tabindex");
  });

  it("BAIXO 3 — com texto, a região aceita foco programático", () => {
    const html = renderToStaticMarkup(<MensagemDaFila mensagem="Cancelado." />);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="status"');
  });
});

describe("MÉDIO 3 — o botão 'ajustar custo' só aparece em item fechado HOJE", () => {
  function render(patch: Record<string, unknown>): string {
    return renderToStaticMarkup(<FilaTabela itens={[item(patch)]} agora={AGORA} />);
  }

  it("item que morreu HOJE oferece o ajuste (é o que move o gasto do dia)", () => {
    expect(render({})).toContain("ajustar custo");
  });

  it("item que morreu ONTEM não oferece — o ajuste dele não moveria número nenhum", () => {
    const ontem = new Date(AGORA - 24 * 3_600_000).toISOString();
    const html = render({ concluidoEm: ontem });
    expect(html).not.toContain("ajustar custo");
    // e a linha continua lá, com o custo e a marca de estimativa:
    expect(html).toContain("estimativa da casa");
  });

  it("item com custo MEDIDO não oferece o ajuste, nem fechado hoje", () => {
    expect(render({ custoEEstimativa: false })).not.toContain("ajustar custo");
  });

  /*
   * CRÍTICO 2 (rodada 12): o campo "sessão" do ajuste nascia VAZIO mesmo
   * quando o item já tinha uma sessão vinculada. Campo de digitação livre que
   * nasce vazio convida a digitar outra coisa, e trocar a sessão fazia o mesmo
   * trabalho aparecer em duas entidades: o crítico mediu um item de US$ 30
   * custando US$ 80 no dia, com a tela dizendo "o gasto de hoje já considera o
   * número real". A trava de verdade é do banco (0027 §7); esta é a tela
   * deixando de propor a troca.
   */
  it("o ajuste nasce com a SESSÃO que o item já tem, não em branco", () => {
    expect(estadoInicialDoAjuste(item({ sessionId: "sess-ja-vinculada" })).sessao).toBe(
      "sess-ja-vinculada",
    );
    expect(estadoInicialDoAjuste(item({ sessionId: null })).sessao).toBe("");
    // e o valor continua partindo do custo atual do item
    expect(estadoInicialDoAjuste(item({ custoUsd: 120 })).valor).toBe("120.00");
  });

  /*
   * P2 do Codex (PR #42): o estado inicial só valia ATÉ a primeira mexida. O
   * clique em "ajustar custo" grava `{ aberto: true }`, e o ponto de partida
   * dessa gravação era o estado vazio — o formulário abria sem a sessão e sem
   * o custo. MUTAÇÃO QUE DEIXA ESTE TESTE VERMELHO: voltar o `??` de
   * `aplicarMudancaNoAjuste` para `AJUSTE_VAZIO`.
   */
  it("abrir o ajuste pela primeira vez mantém a sessão e o custo do item", () => {
    const alvo: Parameters<typeof estadoInicialDoAjuste>[0] = item({
      sessionId: "sess-ja-vinculada",
      custoUsd: 120,
    });
    const depois = aplicarMudancaNoAjuste({}, alvo, { aberto: true });
    expect(depois[alvo.id]).toEqual({ aberto: true, valor: "120.00", sessao: "sess-ja-vinculada" });
    // e o que o operador já digitou não é trocado pelo inicial na mexida seguinte
    const digitado = aplicarMudancaNoAjuste(depois, alvo, { valor: "3" });
    expect(digitado[alvo.id]).toEqual({ aberto: true, valor: "3", sessao: "sess-ja-vinculada" });
  });

  it("o campo OPCIONAL de sessão existe no painel de ajuste (D26)", () => {
    // O vínculo de sessão é o que impede o dia de somar estimativa + custo real.
    const html = render({});
    expect(html).toContain("ajustar custo");
    // o campo só é renderizado com o painel aberto (estado de cliente); o que
    // se prova aqui é que o gatilho existe e o formulário é o mesmo par.
    expect(html).toContain('role="status"');
  });
});

describe("BAIXO 3 — `focarComAlternativa`: a função que entrega o foco (reuso da P6)", () => {
  it("entrega ao alvo quando ele aceita foco", () => {
    const alvo = { focus: vi.fn() } as unknown as HTMLElement;
    const alternativa = { focus: vi.fn() } as unknown as HTMLElement;
    focarComAlternativa(alvo, alternativa, { activeElement: alvo as unknown as Element });
    expect((alvo as unknown as { focus: () => void }).focus).toHaveBeenCalled();
    expect((alternativa as unknown as { focus: () => void }).focus).not.toHaveBeenCalled();
  });

  it("cai na alternativa quando o alvo NÃO aceita (o caso do botão desmontado)", () => {
    const alvo = { focus: vi.fn() } as unknown as HTMLElement;
    const alternativa = { focus: vi.fn() } as unknown as HTMLElement;
    focarComAlternativa(alvo, alternativa, { activeElement: null });
    expect((alternativa as unknown as { focus: () => void }).focus).toHaveBeenCalled();
  });

  it("é a MESMA função da peça P6 (nenhuma segunda implementação de foco)", () => {
    expect(typeof focarComAlternativa).toBe("function");
    expect(alvoAposExclusaoDeNota(0, 2)).toEqual({ tipo: "nota", indice: 1 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RODADA 7 — MÉDIO 3 (o resize que apagava o que se digitava), MÉDIO 4 (o botão
// que sumia sem dizer por quê), MÉDIO 5 (o `window.confirm` nativo), BAIXO 6
// (32 px numa página de 44) e BAIXO 10 (4 regiões vivas por linha).
//
// O que estes testes provam e o que NÃO provam, sem eufemismo: o pacote não tem
// jsdom, então aqui se prova o CONTRATO (o que é renderizado, que props o
// componente aceita, o que a função pura decide) e o CÓDIGO-FONTE onde o defeito
// era estrutural (um `window.confirm` chamado, um `useState` guardando o que
// devia subir). Clicar, digitar e redimensionar de verdade é medição de
// navegador, no relatório da rodada.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * O CÓDIGO que o navegador executa — sem os comentários. Sem isto o teste mede
 * a documentação: os dois arquivos abaixo EXPLICAM, em prosa, o `window.confirm`
 * e o `useState` que saíram, e um `not.toContain` ingênuo acusaria a explicação
 * como se fosse o defeito.
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((linha) => !linha.trimStart().startsWith("//"))
    .join("\n");
}

const FONTE = (arquivo: string): string =>
  semComentarios(
    readFileSync(join(__dirname, "..", "..", "src", "components", "prompts", arquivo), "utf8"),
  );

describe("MÉDIO 3 — o que o operador está digitando mora na LINHA, não no botão", () => {
  it("`AjustarCustoBotao` não guarda mais `aberto`/`valor`/`sessao` (nenhum useState)", () => {
    const fonte = FONTE("ajustar-custo-botao.tsx");
    expect(fonte).not.toContain("useState");
    // e recebe os três de fora, num objeto só:
    expect(fonte).toContain("estado: EstadoDoAjuste");
    expect(fonte).toContain("aoMudarEstado");
  });

  it("`FilaTabela` guarda um estado de ajuste POR ID (as duas instâncias leem o mesmo)", () => {
    const fonte = FONTE("fila-tabela.tsx");
    expect(fonte).toContain("useState<Record<string, EstadoDoAjuste>>");
    // As duas montagens da linha (tabela e cartão) recebem o MESMO `ajusteDe`.
    expect(fonte.match(/ajuste=\{ajusteDe\(item\)\}/g) ?? []).toHaveLength(2);
  });

  it("com o painel aberto, o valor e o id de sessão vêm do estado da linha", () => {
    const html = renderToStaticMarkup(
      <AjustarCustoBotao
        id="i-1"
        estado={{ aberto: true, valor: "12,30", sessao: "session_abc" }}
        aoMudarEstado={() => {}}
        aoSalvar={() => {}}
      />,
    );
    expect(html).toContain('value="12,30"');
    expect(html).toContain('value="session_abc"');
  });
});

describe("MÉDIO 4 — depois do número medido, a tela diz por que não há ajuste", () => {
  function html(patch: Record<string, unknown>): string {
    return renderToStaticMarkup(<FilaTabela itens={[item(patch)]} agora={AGORA} />);
  }

  it("custo medido pela sessão: a célula diz de onde veio o número", () => {
    expect(html({ custoUsd: 95, custoEEstimativa: false })).toContain("medido pela sessão");
  });

  it("e no lugar do botão entra a frase — não um vazio sem explicação", () => {
    const saida = html({ custoUsd: 95, custoEEstimativa: false });
    expect(saida).toContain("valores medidos pela sessão não são ajustados aqui");
    expect(saida).not.toContain("ajustar custo");
  });

  it("EXCEÇÃO testada: custo medido igual a ZERO é ajustável (a sessão não leu o usage)", () => {
    expect(podeAjustarCusto(item({ custoUsd: 0, custoEEstimativa: false }), AGORA)).toBe(true);
    expect(podeAjustarCusto(item({ custoUsd: 95, custoEEstimativa: false }), AGORA)).toBe(false);
    const saida = html({ custoUsd: 0, custoEEstimativa: false });
    expect(saida).toContain("ajustar custo");
    expect(saida).toContain("a sessão fechou sem ler o gasto — dá para corrigir");
  });

  it("o zero de OUTRO dia continua fora (a régua do dia não mudou)", () => {
    const ontem = new Date(AGORA - 24 * 3_600_000).toISOString();
    expect(
      podeAjustarCusto(item({ custoUsd: 0, custoEEstimativa: false, concluidoEm: ontem }), AGORA),
    ).toBe(false);
  });
});

describe("MÉDIO 5 — a confirmação destrutiva mora na página, não num diálogo do navegador", () => {
  it("nenhum `window.confirm` sobrou no botão de cancelar", () => {
    expect(FONTE("cancelar-botao.tsx")).not.toContain("window.confirm");
  });

  it("é de dois passos, com Escape cancelando — o mesmo padrão da P6", () => {
    const fonte = FONTE("cancelar-botao.tsx");
    expect(fonte).toContain("confirmar cancelamento?");
    expect(fonte).toMatch(/e\.key === "Escape"/);
    // e o primeiro passo continua sendo um botão comum na linha:
    const html = renderToStaticMarkup(<FilaTabela itens={[item({ estado: "pega" })]} agora={AGORA} />);
    expect(html).toContain(">cancelar<");
    expect(html).not.toContain("confirmar cancelamento?");
  });
});

describe("BAIXO 6 — 44 px nos controles da fila (a navegação da página já era 44)", () => {
  it("nenhum controle da linha continua em 32 px", () => {
    const html = renderToStaticMarkup(
      <FilaTabela itens={[item({ estado: "pega" }), item({ id: "i-2" })]} agora={AGORA} />,
    );
    expect(html).not.toContain("min-h-[32px]");
    expect(html).toContain("min-h-[44px]");
  });

  it("e o painel de ajuste aberto também (campos e os dois botões)", () => {
    const html = renderToStaticMarkup(
      <AjustarCustoBotao
        id="i-1"
        estado={{ aberto: true, valor: "1,00", sessao: "" }}
        aoMudarEstado={() => {}}
        aoSalvar={() => {}}
      />,
    );
    expect(html).not.toContain("min-h-[32px]");
    expect(html.match(/min-h-\[44px\]/g) ?? []).toHaveLength(4);
  });
});

describe("BAIXO 10 — uma região viva por linha (eram 4: 2 ações × 2 breakpoints)", () => {
  it("10 itens: 20 regiões no DOM inteiro — 1 por linha em cada breakpoint", () => {
    const dez = Array.from({ length: 10 }, (_, i) => item({ id: `i-${i}` }));
    const html = renderToStaticMarkup(<FilaTabela itens={dez} agora={AGORA} />);
    expect(html.match(/role="status"/g) ?? []).toHaveLength(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D32a/D32d (rodada 7) — O CARD PARA DE MENTIR SOBRE O TETO
//
// O crítico mediu, na conta real: 9 de 9 dias com dado ACIMA do teto de US$ 150
// (mediana ~2,6×, máximo 16,8× — 12/09 deu US$ 2.513,29 em 12 sessões); a
// última sessão sincronizada era de 12/09 12:37 UTC (~37 h atrás); duas das
// três contas nunca tiveram sessão nenhuma. E o card imprimia, para as três,
// "US$ 0,00 de US$ 150,00 · US$ 150,00 livres" — como se aquele zero tivesse
// sido medido. O VALOR do teto continua sendo decisão do operador: nada aqui o
// muda; o que muda é a tela parar de afirmar o que não sabe.
// ═════════════════════════════════════════════════════════════════════════════

function consumoDeProva(patch: Record<string, unknown>): never {
  return {
    conta: "lsgpandora@gmail.com",
    tetoUsd: 150,
    consumoHojeUsd: 0,
    reservadoUsd: 0,
    naFilaUsd: 0,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    medidoAteEm: null,
    defasagemHoras: null,
    ...patch,
  } as never;
}

describe("D32a — três estados de medição, três frases (eram um só)", () => {
  it("conta que NUNCA mediu: 'sem medição nenhuma' — e nada de 'US$ 150,00 livres'", () => {
    const html = renderToStaticMarkup(<ContaCard consumo={consumoDeProva({})} agora={AGORA} />);
    expect(html).toContain("sem medição nenhuma");
    expect(html).not.toContain("US$ 150,00 livres");
    expect(html).not.toContain("US$ 0,00 de US$ 150,00");
    expect(estadoDaMedicao(consumoDeProva({}), AGORA)).toBe("sem-medicao");
  });

  it("conta medida há 37 h: 'última medição há 37 h', e a linha sai em amarelo", () => {
    const consumo = consumoDeProva({
      medidoAteEm: new Date(AGORA - 37 * 3_600_000).toISOString(),
      defasagemHoras: 37,
      consumoHojeUsd: 20,
    });
    const html = renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />);
    expect(html).toContain("última medição há 37 h");
    expect(html).toContain("text-state-progress");
    expect(estadoDaMedicao(consumo, AGORA)).toBe("atrasada");
  });

  it("conta medida há 30 min: o 'medido até' de sempre", () => {
    const consumo = consumoDeProva({
      medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
      defasagemHoras: 0.5,
      consumoHojeUsd: 20,
    });
    expect(estadoDaMedicao(consumo, AGORA)).toBe("recente");
    expect(renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />)).toContain(
      "medido até",
    );
  });

  /*
   * MÉDIO 2 (rodada 12): o card ESCONDIA o consumo que governa o teto sempre
   * que `medidoAteEm` era nulo — e "nulo" não quer dizer "zero". O estado é
   * alcançável no banco vivo (item que morre sem fechar lança a estimativa da
   * casa sem medição de sessão nenhuma) e era o retrato de 2 das 3 contas
   * reais. Medido pelo crítico a 1280 px com consumo 98,50 / reservado 15 /
   * teto 500: o texto dizia "nada medido ainda + US$ 15,00 em execução de
   * US$ 500,00", o `aria-label` repetia isso e a barra marcava
   * `aria-valuenow=23` — a barra desenhava 23% do teto enquanto o texto
   * explicava 3%.
   */
  it("consumo lançado SEM medição de sessão: o número aparece, e a barra bate com o texto", () => {
    const consumo = consumoDeProva({
      tetoUsd: 500,
      consumoHojeUsd: 98.5,
      reservadoUsd: 15,
      estimativaUsd: 50,
      estimativaItens: 1,
    });
    const html = renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />);
    // (98,50 + 15) / 500 = 22,7% → 23
    expect(html).toContain('aria-valuenow="23"');
    expect(html, "o número que governa o teto não pode ficar fora da linha").toContain(
      "US$ 98,50",
    );
    expect(html, "a linha do dinheiro não pode trocar o número por 'nada medido ainda'")
      .not.toContain("nada medido ainda");
    expect(html, "o espaço livre sumia junto com o número").toContain("livres");
    // a proveniência continua dita, na linha de baixo
    expect(html).toContain("sem medição nenhuma");
  });

  it("nada medido E nada consumido continua sendo 'nada medido ainda' (D32a intacta)", () => {
    const html = renderToStaticMarkup(
      <ContaCard consumo={consumoDeProva({ tetoUsd: 500 })} agora={AGORA} />,
    );
    expect(html).toContain("nada medido ainda");
    expect(html).not.toContain("US$ 500,00 livres");
  });

  it("sem `defasagemHoras` (banco antigo, sem 0016) a tela calcula e degrada sem quebrar", () => {
    const consumo = consumoDeProva({
      medidoAteEm: new Date(AGORA - 37 * 3_600_000).toISOString(),
      defasagemHoras: undefined,
    });
    expect(Math.round(horasDeDefasagem(consumo, AGORA) ?? 0)).toBe(37);
    expect(estadoDaMedicao(consumo, AGORA)).toBe("atrasada");
  });
});

describe("D32d — o teto ao lado da realidade medida (leitura, não mudança)", () => {
  it("a linha traz mínimo, máximo e mediana dos dias medidos", () => {
    const consumo = consumoDeProva({
      medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
      defasagemHoras: 0.5,
      historico: { dias: 9, minUsd: 155.72, maxUsd: 2513.29, medianaUsd: 391.7 },
    });
    expect(textoTetoVsRealidade(consumo)).toBe(
      "teto US$ 150,00 · nos últimos 9 dias medidos o gasto ficou entre US$ 155,72 e US$ 2513,29 (mediana US$ 391,70)",
    );
    expect(renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />)).toContain(
      "nos últimos 9 dias medidos",
    );
  });

  it("sem histórico (conta nova) não inventa faixa nenhuma", () => {
    expect(textoTetoVsRealidade(consumoDeProva({}))).toBeNull();
    expect(
      textoTetoVsRealidade(
        consumoDeProva({ historico: { dias: 0, minUsd: null, maxUsd: null, medianaUsd: null } }),
      ),
    ).toBeNull();
  });

  it("a trava opcional do operador aparece no card quando está ligada", () => {
    const consumo = consumoDeProva({
      medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
      defasagemHoras: 0.5,
      exigeMedicaoRecente: true,
    });
    expect(renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />)).toContain(
      "só autoriza gasto novo com medição de menos de 12 h",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RODADA 8 — os achados do crítico que vivem na TELA
//
// MÉDIO 2 · o cartão cujo trabalho é "gasto do dia vs teto" não mostrava o teto
//           em 2 dos 3 estados reais (o ramo "sem medição" trocava a linha do
//           dinheiro por uma frase, e o valor sobrava só no `aria-label`), e a
//           frase da medição saía DUAS vezes seguidas.
// MÉDIO 4 · o operador não conseguia corrigir o próprio erro de digitação:
//           depois do primeiro ajuste, o segundo era recusado como "medido".
// MÉDIO 5 · a confirmação da ÚNICA ação destrutiva da página não chegava a
//           leitor de tela nenhum.
// BAIXO 2 · a confirmação armada em 390 px sumia ao ir para 1280 px.
// BAIXO 3 · a AÇÃO PRIMÁRIA ("Enviar para a fila") era o menor alvo da tela.
// D36     · nenhuma superfície convida para o disparo que o banco vai recusar.
// ═════════════════════════════════════════════════════════════════════════════

const { CancelarBotao } = await import("@/components/prompts/cancelar-botao");

describe("MÉDIO 2 — o teto SEMPRE em texto, e a frase da medição uma vez só", () => {
  it("sem medição nenhuma: o teto continua na linha, e o zero não é dito como medido", () => {
    const html = renderToStaticMarkup(<ContaCard consumo={consumoDeProva({})} agora={AGORA} />);
    expect(html).toContain("nada medido ainda");
    // O NÚMERO do teto, em texto visível — era isto que faltava.
    expect(html).toContain("de US$ 150,00");
    // e continua proibido afirmar medição que não houve:
    expect(html).not.toContain("US$ 0,00 de US$ 150,00");
  });

  it("a frase 'sem medição nenhuma' aparece UMA vez (eram duas linhas seguidas)", () => {
    const html = renderToStaticMarkup(<ContaCard consumo={consumoDeProva({})} agora={AGORA} />);
    expect(html.split("sem medição nenhuma").length - 1).toBe(1);
  });

  it("nos outros dois estados o teto também está em texto", () => {
    const atrasada = consumoDeProva({
      medidoAteEm: new Date(AGORA - 37 * 3_600_000).toISOString(),
      defasagemHoras: 37,
      consumoHojeUsd: 20,
    });
    const recente = consumoDeProva({
      medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
      defasagemHoras: 0.5,
      consumoHojeUsd: 20,
    });
    for (const consumo of [atrasada, recente]) {
      expect(renderToStaticMarkup(<ContaCard consumo={consumo} agora={AGORA} />)).toContain(
        "de US$ 150,00",
      );
    }
  });

  it("o fixture tem as DUAS contas que faltavam (sem medição e com a trava ligada)", async () => {
    const { FIXTURE_CONSUMO } = await import("@/lib/repositories/prompts-fila.fixture");
    expect(FIXTURE_CONSUMO.some((c) => c.medidoAteEm === null)).toBe(true);
    expect(FIXTURE_CONSUMO.some((c) => c.exigeMedicaoRecente === true)).toBe(true);
  });
});

describe("D36 — nenhuma superfície convida para o que o banco vai recusar", () => {
  const travada = consumoDeProva({
    medidoAteEm: new Date(AGORA - 37 * 3_600_000).toISOString(),
    defasagemHoras: 37,
    exigeMedicaoRecente: true,
  });

  it("o cartão carimba 'sem autorização agora' e NÃO sugere próximo modelo", () => {
    const html = renderToStaticMarkup(
      <ContaCard consumo={travada} agora={AGORA} proximoModelo="Fable" seriaEscolhida />,
    );
    expect(html).toContain("sem autorização agora");
    expect(html).not.toContain("escolhida agora");
    expect(html).not.toContain("próximo modelo sugerido");
  });

  it("com medição recente, a MESMA trava não bloqueia nada", () => {
    const ok = consumoDeProva({
      medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
      defasagemHoras: 0.5,
      exigeMedicaoRecente: true,
    });
    const html = renderToStaticMarkup(
      <ContaCard consumo={ok} agora={AGORA} proximoModelo="Fable" seriaEscolhida />,
    );
    expect(html).toContain("escolhida agora");
    expect(html).not.toContain("sem autorização agora");
  });
});

describe("MÉDIO 4 (rodada 8) — o operador corrige o próprio erro de digitação", () => {
  function html(patch: Record<string, unknown>): string {
    return renderToStaticMarkup(<FilaTabela itens={[item(patch)]} agora={AGORA} />);
  }
  const ajustado = {
    custoUsd: 3,
    custoEEstimativa: false,
    custoOrigem: "operador",
    custoAjustadoEm: new Date(AGORA - 30_000).toISOString(),
  };

  it("o valor que ELE digitou continua ajustável (era porta de mão única)", () => {
    expect(podeAjustarCusto(item(ajustado), AGORA)).toBe(true);
    const saida = html(ajustado);
    expect(saida).toContain("ajustar custo");
    expect(saida).toContain("ajustado por você");
    expect(saida).not.toContain("valores medidos pela sessão não são ajustados aqui");
  });

  it("o que a SESSÃO mediu continua travado — a origem é que decide, não o valor", () => {
    expect(podeAjustarCusto(item({ custoUsd: 95, custoOrigem: "medido" }), AGORA)).toBe(false);
    expect(html({ custoUsd: 95, custoOrigem: "medido" })).toContain(
      "valores medidos pela sessão não são ajustados aqui",
    );
  });

  it("a porta dos fundos do ZERO fechou: quem reabre é a origem, não o número", () => {
    // Ajustado para exatamente 0 pelo operador: continua ajustável — mas por
    // ser DELE, não por ser zero. E um valor > 0 de origem `operador` também é.
    expect(podeAjustarCusto(item({ ...ajustado, custoUsd: 0 }), AGORA)).toBe(true);
    expect(podeAjustarCusto(item({ ...ajustado, custoUsd: 30 }), AGORA)).toBe(true);
    // Medido zero segue sendo a exceção declarada (a sessão não leu o usage).
    expect(podeAjustarCusto(item({ custoUsd: 0, custoOrigem: "medido" }), AGORA)).toBe(true);
  });

  it("banco antigo (sem `custoOrigem`) degrada para a dedução de antes, sem quebrar", () => {
    expect(podeAjustarCusto(item({ custoUsd: 95, custoEEstimativa: false }), AGORA)).toBe(false);
    expect(podeAjustarCusto(item({ custoUsd: 120, custoEEstimativa: true }), AGORA)).toBe(true);
  });
});

describe("MÉDIO 5 (rodada 8) — a consequência do cancelamento é ANUNCIADA", () => {
  it("a frase é a descrição acessível do botão e vive numa região viva", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao id="i-1" emExecucao confirmando aoMudarConfirmando={() => {}} />,
    );
    // [Minor do CodeRabbit, rodada 10] o id ganhou sufixo por instância
    // (`useId`), porque `FilaTabela` monta este componente DUAS vezes para o
    // mesmo item — tabela do desktop e cartão do celular — e os dois nós
    // dividiam o mesmo id. Em vez do literal, o teste passa a provar o que
    // realmente importa e o literal nunca provou: que o `aria-describedby` do
    // botão aponta para o id que EXISTE nesta árvore, com o prefixo estável.
    const idDescricao = /id="(cancelar-consequencia-i-1-[^"]+)"/.exec(html)?.[1];
    expect(idDescricao, "a região de descrição precisa existir").toBeDefined();
    expect(html).toContain(`aria-describedby="${idDescricao}"`);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("A sessão que está rodando vai ser interrompida");
  });

  it("a região existe ANTES do texto (vazia e `sr-only`) — senão não é anunciada", () => {
    const html = renderToStaticMarkup(<CancelarBotao id="i-1" aoMudarConfirmando={() => {}} />);
    expect(html).toMatch(/id="cancelar-consequencia-i-1-[^"]+"/);
    expect(html).toContain("sr-only");
    // sem confirmação armada, o botão não aponta para uma descrição vazia:
    expect(html).not.toContain("aria-describedby");
  });

  // [Minor do CodeRabbit, rodada 10] a guarda do defeito em si. `FilaTabela`
  // renderiza a tabela do desktop E os cartões do celular para o MESMO item:
  // com o id derivado só do `id` do item, os dois nós nasciam iguais e o
  // `aria-describedby` do celular podia resolver para o nó do desktop.
  it("duas instâncias do MESMO item não dividem o id da descrição", () => {
    const html = renderToStaticMarkup(
      <>
        <CancelarBotao id="i-1" emExecucao confirmando aoMudarConfirmando={() => {}} />
        <CancelarBotao id="i-1" emExecucao confirmando aoMudarConfirmando={() => {}} />
      </>,
    );
    const ids = [...html.matchAll(/id="(cancelar-consequencia-i-1-[^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, `os dois ids colidiram: ${ids.join(" / ")}`).toBe(2);
    // e cada botão aponta para o SEU, não para o do vizinho.
    for (const id of ids) expect(html).toContain(`aria-describedby="${id}"`);
  });

  it("o texto muda com o estado do item (em execução × parado na fila)", () => {
    const parado = renderToStaticMarkup(
      <CancelarBotao id="i-2" confirmando aoMudarConfirmando={() => {}} />,
    );
    expect(parado).toContain("Ele sai da fila e não vai rodar.");
  });
});

/**
 * MÉDIO 6 (rodada 9) — A CONFIRMAÇÃO ESCONDIA O DINHEIRO.
 * Medido pelo crítico: `cancelar-botao.tsx` decidia a frase SÓ por `emExecucao`.
 * Para um item `na_fila` com `tentativas > 0` — pego, morto, devolvido — cancelar
 * lança até US$ 120 no gasto do dia (D12), e a confirmação dizia, com todas as
 * letras, "Ele sai da fila e não vai rodar". O texto certo só aparecia DEPOIS,
 * quando o dinheiro já tinha entrado.
 */
describe("MÉDIO 6 (rodada 9) — a confirmação diz o DINHEIRO antes, não depois", () => {
  it("item que já rodou: a pergunta nomeia o valor que vai entrar no gasto de hoje", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao
        id="i-3"
        confirmando
        custoAoCancelarUsd={120}
        aoMudarConfirmando={() => {}}
      />,
    );
    expect(html).toContain("Ele sai da fila e não vai rodar.");
    expect(html).toContain("US$ 120,00 entram no gasto de hoje como estimativa");
    expect(html).not.toContain("Não entra nada no gasto de hoje");
  });

  it("item que nunca foi pego: a pergunta diz que NADA entra (e não fica muda)", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao id="i-4" confirmando aoMudarConfirmando={() => {}} />,
    );
    expect(html).toContain("Não entra nada no gasto de hoje.");
    expect(html).not.toContain("entram no gasto de hoje como estimativa");
  });

  it("em execução também nomeia o dinheiro — as duas coisas na mesma frase", () => {
    const html = renderToStaticMarkup(
      <CancelarBotao
        id="i-5"
        emExecucao
        confirmando
        custoAoCancelarUsd={50}
        aoMudarConfirmando={() => {}}
      />,
    );
    expect(html).toContain("A sessão que está rodando vai ser interrompida");
    expect(html).toContain("US$ 50,00 entram no gasto de hoje como estimativa");
  });

  it("a LINHA calcula pela mesma régua do banco (D12), e passa o número ao botão", () => {
    const fonte = FONTE("fila-tabela.tsx");
    expect(fonte).toContain("function custoAoCancelar(item: ItemFilaPrompt): number");
    expect(fonte).toContain("custoAoCancelarUsd={custoAoCancelar(item)}");
    // MÉDIO 3 (rodada 13): A REGRA MUDOU DE CASA, e este espelho vai atrás
    // dela. Ela vive em `tipos.ts`, com a leitura do livro ao lado — era a
    // metade que faltava aqui (a estimativa da casa tem posto 10 e o livro a
    // recusa quando a entidade já guarda medição). A linha delega; o teste
    // confere as duas pontas, para a regra não voltar a existir em dois
    // lugares com dois comportamentos.
    expect(fonte).toContain("return custoAoCancelarUsd(item);");
    expect(fonte).toContain("jaMedidoPelaSessao={!livroAceita(item, POSTO_ESTIMATIVA)}");
    const tipos = readFileSync(
      join(__dirname, "..", "..", "src", "core", "prompts", "tipos.ts"),
      "utf8",
    );
    expect(tipos).toContain('item.estado === "pega" || item.tentativas > 0');
    expect(tipos).toContain("if (!livroAceita(item, POSTO_ESTIMATIVA)) return 0;");
  });
});

/**
 * MÉDIO 2 (rodada 9) — DOIS ESTADOS VERDADEIROS NÃO SE ESCONDEM, E O RODAPÉ
 * PARA DE PROMETER O QUE O BANCO NÃO CUMPRE.
 * Medido pelo crítico: `conta-card.tsx` decidia os selos com `atingiu ? … :
 * travada ? …`. Alma Petra mostrava só "teto atingido" e, duas linhas abaixo de
 * "nenhum disparo é autorizado agora", o rodapé prometia "próximo espaço
 * amanhã" — amanhã o teto zera e o banco continua recusando. E "sem autorização
 * agora" não renderizava NENHUMA vez, porque a única conta com a trava também
 * estava no teto.
 */
describe("MÉDIO 2 (rodada 9) — os selos do cartão e o rodapé que não mente", () => {
  const base = {
    conta: "almapetra.ltda@gmail.com" as const,
    tetoUsd: 500,
    reservadoUsd: 0,
    naFilaUsd: 0,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    historico: null,
  };

  it("teto atingido E sem autorização: os DOIS selos aparecem", () => {
    const html = renderToStaticMarkup(
      <ContaCard
        consumo={{
          ...base,
          consumoHojeUsd: 500,
          medidoAteEm: new Date(AGORA - 13 * 3_600_000).toISOString(),
          defasagemHoras: 13,
          exigeMedicaoRecente: true,
        }}
        agora={AGORA}
      />,
    );
    expect(html).toContain("teto atingido");
    expect(html).toContain("sem autorização agora");
  });

  it("os dois juntos: o rodapé diz que amanhã NÃO resolve o que trava a conta", () => {
    const html = renderToStaticMarkup(
      <ContaCard
        consumo={{
          ...base,
          consumoHojeUsd: 500,
          medidoAteEm: new Date(AGORA - 13 * 3_600_000).toISOString(),
          defasagemHoras: 13,
          exigeMedicaoRecente: true,
        }}
        agora={AGORA}
      />,
    );
    expect(html).toContain(
      "teto atingido e sem autorização — amanhã o teto zera, mas o disparo só volta quando a medição desta conta for atualizada",
    );
    expect(html).not.toContain("teto atingido — próximo espaço amanhã");
  });

  it("só o teto: a promessa de amanhã volta a ser verdade", () => {
    const html = renderToStaticMarkup(
      <ContaCard
        consumo={{
          ...base,
          consumoHojeUsd: 500,
          medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
          defasagemHoras: 0.5,
          exigeMedicaoRecente: false,
        }}
        agora={AGORA}
      />,
    );
    expect(html).toContain("teto atingido — próximo espaço amanhã");
    expect(html).not.toContain("sem autorização agora");
  });

  it("nenhum bloqueio: só aí o cartão convida (\u201cescolhida agora\u201d)", () => {
    const html = renderToStaticMarkup(
      <ContaCard
        consumo={{
          ...base,
          consumoHojeUsd: 10,
          medidoAteEm: new Date(AGORA - 30 * 60_000).toISOString(),
          defasagemHoras: 0.5,
          exigeMedicaoRecente: false,
        }}
        seriaEscolhida
        agora={AGORA}
      />,
    );
    expect(html).toContain("escolhida agora");
    expect(html).not.toContain("teto atingido");
    expect(html).not.toContain("sem autorização agora");
  });
});

describe("BAIXO 2 (rodada 8) — a confirmação de cancelar não mora mais no botão", () => {
  it("`cancelar-botao.tsx` não tem estado próprio: ele é controlado pela linha", () => {
    const fonte = FONTE("cancelar-botao.tsx");
    expect(fonte).not.toContain("useState");
    expect(fonte).toContain("confirmando");
    expect(fonte).toContain("aoMudarConfirmando");
  });

  it("a linha guarda o mapa e o entrega às DUAS instâncias (tabela e cartão)", () => {
    const fonte = FONTE("fila-tabela.tsx");
    expect(fonte).toContain("useState<Record<string, boolean>>({})");
    expect(fonte.split("confirmandoCancelar={confirmandoCancelar[item.id] === true}").length - 1).toBe(2);
  });

  it("controlado: a mesma prop produz o mesmo passo nas duas instâncias", () => {
    const armado = renderToStaticMarkup(
      <CancelarBotao id="i-1" confirmando aoMudarConfirmando={() => {}} />,
    );
    const desarmado = renderToStaticMarkup(
      <CancelarBotao id="i-1" aoMudarConfirmando={() => {}} />,
    );
    expect(armado).toContain("confirmar cancelamento?");
    expect(desarmado).toContain(">cancelar<");
    expect(desarmado).not.toContain("confirmar cancelamento?");
  });
});

describe("BAIXO 3 (rodada 8) — a AÇÃO PRIMÁRIA era o menor alvo da tela", () => {
  it("nem o botão de enviar nem os selects continuam abaixo de 44 px", () => {
    const fonte = FONTE("novo-prompt-form.tsx");
    expect(fonte).not.toContain("min-h-[40px]");
    expect(fonte).not.toContain("min-h-[36px]");
    expect(fonte.split("min-h-[44px]").length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe("MÉDIO 3 (rodada 13) — a tela sabe o que o BANCO sabe", () => {
  /*
    O ESTADO MEDIDO PELO CRÍTICO, por porta real: item em execução cuja sessão
    já publicou US$ 300; o operador cancela. A LINHA fica
    `estado=cancelada custo_usd=50 custo_origem=estimativa`, e sobre ela o
    banco respondia `custo_lancado_usd=0.00` e
    `ERRO(Este custo já foi medido pela sessão — não dá para corrigi-lo aqui.)`.

    A tela, lendo só a COLUNA do item, oferecia o botão que a RPC recusa,
    prometia "US$ 50,00 entram no gasto de hoje … dá para ajustar na linha
    depois" (entram US$ 0,00 e não dá) e imprimia "US$ 50,00 · estimativa da
    casa" para um item que pesa 300 no dia.

    A CAUSA é uma só, e a cura é uma só: `fila_prompts_listar` passou a mandar
    o lançamento VIVO da entidade (`livroOrigem`, `livroPrecedencia`,
    `livroLiquidoUsd`, migration 0028 §2) e tudo o que a tela decide sobre
    dinheiro deriva dele.
  */
  const sessaoPublicou = {
    estado: "cancelada",
    custoUsd: 50,
    custoEstimadoUsd: 50,
    custoEEstimativa: true,
    custoOrigem: "estimativa",
    sessionId: "sess-medida",
    tentativas: 1,
    livroOrigem: "medido",
    livroPrecedencia: 40,
    livroLiquidoUsd: 300,
  };

  it("o botão de ajuste NÃO aparece para o que o banco vai recusar", () => {
    expect(podeAjustarCusto(item(sessaoPublicou), AGORA)).toBe(false);
    const saida = renderToStaticMarkup(
      <FilaTabela itens={[item(sessaoPublicou)]} agora={AGORA} />,
    );
    expect(saida).not.toContain("ajustar custo");
    expect(textoSemAjuste(item(sessaoPublicou))).toContain("a sessão já publicou o número");
  });

  it("a pergunta destrutiva não promete dinheiro que não entra", () => {
    const emExecucao = {
      ...sessaoPublicou,
      estado: "pega",
      custoUsd: null,
      workerId: "w-1",
      concluidoEm: null,
    };
    expect(custoAoCancelarUsd(item(emExecucao))).toBe(0);
    const saida = renderToStaticMarkup(
      <CancelarBotao
        id="i-1"
        emExecucao
        confirmando
        custoAoCancelarUsd={custoAoCancelarUsd(item(emExecucao))}
        jaMedidoPelaSessao={!livroAceita(item(emExecucao), POSTO_ESTIMATIVA)}
        aoMudarConfirmando={() => {}}
      />,
    );
    expect(saida).not.toContain("entram no gasto de hoje");
    expect(saida).not.toContain("dá para ajustar na linha depois");
    expect(saida).toContain("a sessão já publicou o número real deste item");
  });

  it("a célula imprime o número que o DIA cobra, não o do item", () => {
    const naTela = custoNaTela(item(sessaoPublicou));
    expect(naTela.valorUsd).toBe(300);
    expect(naTela.nota).toContain("medido pela sessão");
    expect(naTela.nota).toContain("a casa estimava US$ 50,00");
    const saida = renderToStaticMarkup(
      <FilaTabela itens={[item(sessaoPublicou)]} agora={AGORA} />,
    );
    expect(saida).toContain("US$ 300,00");
    expect(saida).not.toContain("US$ 50,00 ·");
  });

  it("sem lançamento vivo no livro, nada muda — a tela degrada para a coluna", () => {
    // Banco anterior à 0028 (os três campos vêm `undefined`) e item que nunca
    // custou nada: a régua antiga continua valendo, inteira.
    expect(podeAjustarCusto(item({ custoUsd: 120, custoOrigem: "estimativa" }), AGORA)).toBe(true);
    expect(custoNaTela(item({ custoUsd: 120, custoOrigem: "estimativa" })).valorUsd).toBe(120);
    expect(
      custoAoCancelarUsd(item({ estado: "pega", custoUsd: null, custoEstimadoUsd: 120, tentativas: 0 })),
    ).toBe(120);
  });

  it("o livro de posto BAIXO não trava nada — só o posto acima do operador trava", () => {
    // A casa lançou a estimativa (posto 10) e ninguém mediu: o operador
    // continua dono do número, como sempre foi.
    const soEstimativa = {
      custoUsd: 120,
      custoOrigem: "estimativa",
      livroOrigem: "estimativa",
      livroPrecedencia: 10,
      livroLiquidoUsd: 120,
    };
    expect(podeAjustarCusto(item(soEstimativa), AGORA)).toBe(true);
    expect(textoSemAjuste(item(soEstimativa))).toBeNull();
  });
});

describe("CRÍTICO 1 (rodada 13) — crédito de um dia fechado não vira teto NA TELA", () => {
  /*
    O defeito nasce e morre no banco (o estorno limitado ao que hoje tem,
    migration 0027 §6; o piso do número que governa o teto, 0028 §1). Este
    bloco guarda a TERCEIRA parede, a única dentro da tela — porque a promessa
    do DEPLOY.md D13 ("a tela nunca mostra número negativo") era guardada só na
    saída (`textoEspacoLivre` clampa) e nunca na ENTRADA.

    Medido no Chromium com `consumoHojeUsd = -358,50` e teto 500, ANTES:
      · cartão: "US$ -358,50 + US$ 15,00 em execução de US$ 500,00 · US$ 843,50 livres"
      · barra:  aria-valuenow="-69", style="width:-69%", 220 de 220 px — o CSS
                é inválido, o navegador cai no `w-full` da classe e desenha a
                barra CHEIA, em verde, sobre uma conta estourada.
    DEPOIS: aria-valuenow="3", style="width:3%", 7 de 220 px, e nenhum número
    negativo na tela.
  */
  const diaNegativo = consumoDeProva({
    tetoUsd: 500,
    consumoHojeUsd: -358.5,
    reservadoUsd: 15,
    medidoAteEm: new Date(AGORA - 3_600_000).toISOString(),
    defasagemHoras: 1,
  });

  it("o espaço livre não cresce com o crédito — é a mesma régua do pull", () => {
    // 500 − max(0, −358,50) − 15 = 485. Com o defeito: 500 + 358,50 − 15 = 843,50.
    expect(headroomUsd(diaNegativo)).toBe(485);
  });

  it("a barra é CSS válido e ARIA válida, com qualquer número que chegue", () => {
    const html = renderToStaticMarkup(<ContaCard consumo={diaNegativo} agora={AGORA} />);
    expect(html).not.toContain("width:-");
    expect(html).not.toContain('aria-valuenow="-');
    const valor = /aria-valuenow="(-?\d+)"/.exec(html)?.[1];
    expect(Number(valor)).toBeGreaterThanOrEqual(0);
    expect(Number(valor)).toBeLessThanOrEqual(100);
  });

  it("nenhum número negativo chega ao olho do operador", () => {
    const html = renderToStaticMarkup(<ContaCard consumo={diaNegativo} agora={AGORA} />);
    expect(html).not.toContain("US$ -358,50");
    expect(html).not.toContain("US$ 843,50 livres");
    expect(html).toContain("US$ 485,00 livres");
  });
});

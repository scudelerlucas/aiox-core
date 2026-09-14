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
  estadoDaMedicao,
  fraseDoCancelamento,
  horasDeDefasagem,
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

const { FilaTabela, podeAjustarCusto } = await import("@/components/prompts/fila-tabela");
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

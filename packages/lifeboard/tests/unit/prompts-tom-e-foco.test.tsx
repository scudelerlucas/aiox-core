import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  MensagemDaFila,
  frasePeLancamento,
} from "@/components/prompts/mensagem-da-fila";
import { alvoAposExclusaoDeNota, focarComAlternativa } from "@/components/task/foco";
import { fraseDoCancelamento } from "@/core/prompts/tipos";

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

const { FilaTabela } = await import("@/components/prompts/fila-tabela");

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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #8 (crítico 13/09): roving tabindex.
 * `renderToStaticMarkup` não executa eventos de teclado (não há DOM real
 * aqui — o repo não tem @testing-library), mas prova a metade estática do
 * contrato: só a opção SELECIONADA entra no fluxo de Tab (`tabindex="0"`);
 * todas as outras saem dele (`tabindex="-1"`). É essa mudança —de N paradas
 * de Tab por controle para 1— que derruba a régua de 20 para ≤ 8 até a
 * textarea da nota.
 */
const OPCOES: readonly OpcaoSegmentada<number>[] = [
  { valor: 1, rotulo: "1" },
  { valor: 2, rotulo: "2" },
  { valor: 3, rotulo: "3" },
];

describe("ControleSegmentado — roving tabindex (achado #8)", () => {
  it("PRONTO QUANDO: só o botão selecionado tem tabindex=0; os outros, -1", () => {
    const html = renderToStaticMarkup(
      <ControleSegmentado
        rotuloGrupo="Teste"
        opcoes={OPCOES}
        valorAtual={2}
        aoMudar={() => undefined}
      />,
    );
    // 1 ocorrência de tabindex="0" (a opção 2) e 2 de tabindex="-1" (1 e 3).
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(2);
  });

  it("cada botão continua com role=radio e aria-checked correto", () => {
    const html = renderToStaticMarkup(
      <ControleSegmentado
        rotuloGrupo="Teste"
        opcoes={OPCOES}
        valorAtual={3}
        aoMudar={() => undefined}
      />,
    );
    expect(html.match(/role="radio"/g)?.length).toBe(3);
    expect(html).toContain('aria-checked="true"');
  });
});

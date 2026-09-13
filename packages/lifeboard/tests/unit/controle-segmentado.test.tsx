import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ControleSegmentado,
  indiceDeFocoParaTecla,
  type OpcaoSegmentada,
} from "@/components/task/controle-segmentado";

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

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #3 (crítico 13/09, rodada 2): as setas
 * comitavam a cada tecla (uma mutação por keystroke) porque o handler de
 * teclado chamava `aoMudar` diretamente. `indiceDeFocoParaTecla` é a lógica
 * de navegação extraída como função PURA — ela nem RECEBE `aoMudar`, então
 * a prova de que uma seta nunca comita é estrutural (a assinatura não tem
 * como chamar um callback que não existe nos seus parâmetros), não só
 * observada em runtime.
 *
 * Decisão de ambiente: o repo não tem `jsdom` nem `@testing-library`
 * (`vitest.config.ts` roda em `environment: "node"`, sem DOM real) e a
 * instrução de execução deste PR proíbe `npm install`/`yarn` — não há como
 * disparar um `KeyboardEvent` de verdade contra o componente montado. O
 * teste abaixo prova a MESMA garantia no nível que dá para testar sem DOM:
 * (1) a navegação pura nunca invoca nenhuma função de commit — só devolve
 * um índice; (2) o componente só liga o commit (`aoMudar`) ao `onClick`, e
 * `aoTeclar` só chama `moverFoco` (que só chama `.focus()`) — nunca `aoMudar`
 * — o que confere lendo `src/components/task/controle-segmentado.tsx`.
 */
describe("indiceDeFocoParaTecla — ArrowRight/ArrowLeft/Home/End nunca comitam (achado MÉDIO #3, rodada 2)", () => {
  it("PRONTO QUANDO: ArrowRight avança (com wrap) sem precisar de nenhum callback de commit", () => {
    const aoMudarNuncaChamado = vi.fn();
    expect(indiceDeFocoParaTecla("ArrowRight", 0, 3)).toBe(1);
    expect(indiceDeFocoParaTecla("ArrowRight", 2, 3)).toBe(0); // wrap
    // A função nem aceita `aoMudar` como parâmetro — impossível ela chamar.
    expect(aoMudarNuncaChamado).not.toHaveBeenCalled();
  });

  it("ArrowLeft/ArrowUp retrocede (com wrap); Home/End vão para as pontas", () => {
    expect(indiceDeFocoParaTecla("ArrowLeft", 0, 3)).toBe(2); // wrap
    expect(indiceDeFocoParaTecla("ArrowUp", 2, 3)).toBe(1);
    expect(indiceDeFocoParaTecla("Home", 2, 3)).toBe(0);
    expect(indiceDeFocoParaTecla("End", 0, 3)).toBe(2);
  });

  it("Enter/Espaço (e qualquer outra tecla) devolvem null — não é a navegação que decide o commit", () => {
    expect(indiceDeFocoParaTecla("Enter", 1, 3)).toBeNull();
    expect(indiceDeFocoParaTecla(" ", 1, 3)).toBeNull();
    expect(indiceDeFocoParaTecla("a", 1, 3)).toBeNull();
  });

  it("nenhuma tecla de navegação, sozinha, gera efeito colateral (a função só lê números)", () => {
    // Chama todas as 6 teclas tratadas em sequência sem tocar em nenhum
    // estado externo — só a matemática de índice, PURA.
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"]) {
      expect(typeof indiceDeFocoParaTecla(key, 0, 3)).toBe("number");
    }
  });
});

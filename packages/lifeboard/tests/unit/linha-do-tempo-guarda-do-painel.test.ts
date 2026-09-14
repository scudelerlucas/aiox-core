import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analisarFonteDoPainel, PORTAS_PURAS } from "./analise-de-fonte";

/**
 * OS-LIFEBOARD · P5 — rodada 9, achado MÉDIO A3. A guarda da rodada 7 tinha
 * duas camadas e o crítico furou as duas com nove mutantes; QUATRO deles
 * derrubavam ZERO dos 1027 testes:
 *
 * | mutante | testes que caíam antes |
 * |---|---|
 * | `rolarESincronizar` devolve o destino já clampado, sem reler | 0 |
 * | `el.scrollTo({ left: 0 })` num `useEffect` | 0 |
 * | `el[chave] = 0` (colchete) num `useEffect` | 0 |
 * | chama o módulo e DESCARTA o retorno | 0 |
 *
 * O primeiro é de COMPORTAMENTO e está fechado em
 * `linha-do-tempo-sincronizacao.test.ts` (o painel falso passou a arredondar
 * como o navegador — achado BAIXO A6). Os outros três são edições DENTRO do
 * componente, e a camada que deveria pegá-los procurava a string
 * `.scrollLeft =` — que nenhum dos três contém.
 *
 * Este arquivo troca a varredura de string por ANÁLISE SINTÁTICA (a árvore do
 * arquivo, pelo compilador de TypeScript). E ele não confia na própria régua:
 * cada mutante do crítico está escrito por extenso abaixo e é ALIMENTADO ao
 * analisador — se a régua parar de enxergar um deles, este teste fica
 * vermelho ANTES de o mutante chegar no componente.
 *
 * Materialidade medida pelo crítico em build de produção, com o mutante
 * "descarta o retorno" no lugar: o cabeçalho ficava −493,2px, −665,2px e
 * −186,0px adiantado das barras; no build limpo, 0,00px em 72 de 72 combos.
 */

const CAMINHO_COMPONENTE = "components/timeline/linha-do-tempo.tsx";

function fonte(arquivo: string): string {
  return readFileSync(fileURLToPath(new URL(`../../src/${arquivo}`, import.meta.url)), "utf8");
}

/** Um `useEffect` de brinquedo com o corpo mutante dentro — a forma real do ataque. */
function efeitoCom(corpo: string): string {
  return `
    export function Componente(): JSX.Element {
      const painelRef = useRef<HTMLDivElement | null>(null);
      const chave = "scrollLeft";
      useEffect(() => {
        const el = painelRef.current;
        if (!el) return;
        ${corpo}
      }, []);
      return <div ref={painelRef} />;
    }
  `;
}

describe("guarda do painel: o componente real não tem porta lateral para o scroll", () => {
  it("PRONTO QUANDO: zero achados no componente de produção", () => {
    const achados = analisarFonteDoPainel(fonte(CAMINHO_COMPONENTE), "linha-do-tempo.tsx");
    expect(achados).toEqual([]);
  });

  it("o componente continua importando as portas puras que ele é obrigado a usar", () => {
    const alvo = fonte(CAMINHO_COMPONENTE);
    expect(alvo).toContain('from "@/core/timeline/sincronizacao-painel"');
    expect(alvo).toContain('from "@/core/timeline/folha-inferior"');
    for (const porta of ["rolarESincronizar", "aoRedimensionar", "planoDaFolhaInferior"]) {
      expect(PORTAS_PURAS).toContain(porta);
      expect(alvo).toContain(porta);
    }
  });
});

describe("a régua VÊ cada mutante do crítico (alimentados por extenso)", () => {
  it("MUTANTE 2: `el.scrollTo({ left: 0 })` num useEffect", () => {
    const achados = analisarFonteDoPainel(efeitoCom("el.scrollTo({ left: 0 });"));
    expect(achados.map((a) => a.tipo)).toContain("rolagem-fora-do-modulo");
  });

  it("MUTANTE 2b: `el.scrollIntoView()` e `el.scrollBy(...)` também", () => {
    for (const corpo of ["el.scrollIntoView();", "el.scrollBy({ left: 40 });"]) {
      expect(analisarFonteDoPainel(efeitoCom(corpo)).map((a) => a.tipo)).toContain(
        "rolagem-fora-do-modulo",
      );
    }
  });

  it("MUTANTE 3: `el[chave] = 0` — a escrita por COLCHETE, sem a string `.scrollLeft =`", () => {
    const codigo = efeitoCom("el[chave] = 0;");
    // Prova de que a varredura de string ANTIGA passaria batido:
    expect(/\.scrollLeft\s*=[^=]/.test(codigo)).toBe(false);
    expect(analisarFonteDoPainel(codigo).map((a) => a.tipo)).toContain("escrita-por-colchete");
  });

  it("MUTANTE 4 (bug da rodada 6 re-soletrado): `el[k] = destino` sem chamar o módulo", () => {
    const achados = analisarFonteDoPainel(
      efeitoCom("const destino = 329.6; el[chave] = destino;"),
    );
    expect(achados.map((a) => a.tipo)).toContain("escrita-por-colchete");
  });

  it("MUTANTE 6 (achado ALTO A1): o componente escreve geometria no DOM", () => {
    for (const corpo of [
      'espaco.style.height = "0px";',
      "ticks.style.transform = `translateX(0px)`;",
    ]) {
      expect(analisarFonteDoPainel(efeitoCom(corpo)).map((a) => a.tipo)).toContain(
        "escrita-de-estilo",
      );
    }
  });

  it("MUTANTE 5: chama o módulo e DESCARTA o retorno (nada chega ao DOM)", () => {
    for (const porta of PORTAS_PURAS) {
      const achados = analisarFonteDoPainel(efeitoCom(`${porta}(el, 0);`));
      expect(achados.map((a) => a.tipo)).toContain("retorno-descartado");
    }
  });

  it("MUTANTE 1 re-soletrado no componente: `el.scrollLeft = destino` continua pego", () => {
    const achados = analisarFonteDoPainel(efeitoCom("el.scrollLeft = 329.6;"));
    expect(achados.map((a) => a.tipo)).toContain("escrita-em-scroll");
    expect(analisarFonteDoPainel(efeitoCom("el.scrollTop += 10;")).map((a) => a.tipo)).toContain(
      "escrita-em-scroll",
    );
  });
});

describe("a régua não grita à toa (senão ninguém a mantém acesa)", () => {
  it("LER `el.scrollLeft` é legítimo — só ESCREVER não é", () => {
    expect(analisarFonteDoPainel(efeitoCom("const x = el.scrollLeft; void x;"))).toEqual([]);
  });

  it("`window.scrollBy` é o caminho legítimo da folha inferior", () => {
    expect(analisarFonteDoPainel(efeitoCom("window.scrollBy({ top: 12 });"))).toEqual([]);
  });

  it("usar o retorno da porta pura (o código bom) não gera achado", () => {
    expect(
      analisarFonteDoPainel(efeitoCom("const s = rolarESincronizar(el, 10); void s;")),
    ).toEqual([]);
    expect(
      analisarFonteDoPainel(efeitoCom("aplicar(aoRedimensionar(el));")),
    ).toEqual([]);
  });

  it("atribuição a `.current` de um ref não é escrita de scroll", () => {
    expect(analisarFonteDoPainel(efeitoCom("ancoraRef.current = null;"))).toEqual([]);
  });
});

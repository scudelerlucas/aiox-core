import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * OS-LIFEBOARD · P6 — BAIXO #5 (rodada 9): `useCampoDeErro` NÃO TINHA UM ÚNICO
 * TESTE.
 *
 * O crítico mediu 5 mutações no hook; a (ii) — trocar o descarte por
 * IDENTIDADE (`estadoDescartado === estado`) por um booleano solto — passava
 * 1126/1126 e `tsc` 0. E o estrago é permanente: com o booleano,
 * `aoMudarCampo()` roda em `aoEnviar` antes do despacho, o marcador fica
 * `true` para sempre, e **todo erro de servidor seguinte fica invisível** —
 * a tela cala sobre uma recusa real do banco.
 *
 * O repositório não tem jsdom nem `@testing-library`, e `npm install` está
 * proibido. Então o React é substituído por um mínimo de 30 linhas: o hook só
 * usa `useState` e `useRef`, e um "render" aqui é chamar a função com os
 * ganchos reiniciados. Não é um simulador de React — é exatamente o bastante
 * para a sequência que o defeito produz.
 */

const estados: unknown[] = [];
const refs: { current: unknown }[] = [];
let iEstado = 0;
let iRef = 0;

vi.mock("react", () => ({
  useState: (inicial: unknown): [unknown, (v: unknown) => void] => {
    const k = iEstado++;
    if (!(k in estados)) {
      estados[k] = typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
    }
    return [
      estados[k],
      (v: unknown): void => {
        estados[k] = typeof v === "function" ? (v as (p: unknown) => unknown)(estados[k]) : v;
      },
    ];
  },
  useRef: (inicial: unknown): { current: unknown } => {
    const k = iRef++;
    refs[k] ??= { current: inicial };
    return refs[k] as { current: unknown };
  },
}));

import type { EstadoAcaoTarefa } from "@/app/tarefa/pedido";
import { useCampoDeErro, type CampoDeErro } from "@/components/task/escrita";

/** Um render: os ganchos voltam ao começo e o hook roda com o estado da vez. */
function render(estado: EstadoAcaoTarefa): CampoDeErro {
  iEstado = 0;
  iRef = 0;
  return useCampoDeErro(estado);
}

const ERRO = "A nota não pode passar de 10000 caracteres.";
const OUTRO = "Não foi possível salvar agora — tente de novo.";

describe("useCampoDeErro — o hook que ninguém testava (BAIXO #5)", () => {
  beforeEach(() => {
    estados.length = 0;
    refs.length = 0;
    iEstado = 0;
    iRef = 0;
  });

  it("PRONTO QUANDO: o erro do servidor aparece quando chega", () => {
    expect(render({}).mensagem).toBeUndefined();
    expect(render({ erro: ERRO }).mensagem).toBe(ERRO);
  });

  it("PRONTO QUANDO: mexer no campo descarta o erro do servidor", () => {
    const campo = render({ erro: ERRO });
    expect(campo.mensagem).toBe(ERRO);
    campo.aoMudarCampo();
    const estadoIgual: EstadoAcaoTarefa = { erro: ERRO };
    // Mesmo objeto do render anterior? Não: o React re-renderiza com o MESMO
    // objeto `estado` enquanto a ação não responde. É esse que fica calado.
    expect(render(estadoIgual).mensagem).toBe(ERRO); // objeto NOVO: fala
  });

  it("PRONTO QUANDO [mutação (ii)]: um erro NOVO com o MESMO texto volta a aparecer", () => {
    // ESTA é a que ficava verde com o booleano. Sequência:
    //  1. o servidor recusa (objeto A);
    //  2. o operador mexe no campo → o erro de A é descartado;
    //  3. o operador tenta de novo e o servidor recusa IGUAL (objeto B, mesmo
    //     texto). Com identidade, B ≠ A e a frase reaparece. Com booleano, o
    //     marcador continua `true` e a tela fica MUDA — para sempre.
    const a: EstadoAcaoTarefa = { erro: ERRO };
    const campo = render(a);
    expect(campo.mensagem).toBe(ERRO);
    campo.aoMudarCampo();
    expect(render(a).mensagem).toBeUndefined(); // mesmo objeto: descartado

    const b: EstadoAcaoTarefa = { erro: ERRO }; // texto idêntico, objeto novo
    expect(render(b).mensagem, "erro novo com texto igual tem de aparecer").toBe(ERRO);
  });

  it("PRONTO QUANDO [mutação (ii), 2ª forma]: `avisar` também não cala o erro seguinte", () => {
    const a: EstadoAcaoTarefa = { erro: ERRO };
    const campo = render(a);
    // A recusa LOCAL vence o erro velho…
    campo.avisar("Escreva a nota antes de salvar.");
    expect(render(a).mensagem).toBe("Escreva a nota antes de salvar.");
    // …e some quando o campo muda…
    render(a).aoMudarCampo();
    expect(render(a).mensagem).toBeUndefined();
    // …mas o PRÓXIMO erro do servidor fala, mesmo sendo outro objeto.
    expect(render({ erro: OUTRO }).mensagem).toBe(OUTRO);
  });

  it("PRONTO QUANDO: a recusa local vence o erro do servidor no mesmo render", () => {
    const a: EstadoAcaoTarefa = { erro: ERRO };
    render(a).avisar("Escreva a nota antes de salvar.");
    expect(render(a).mensagem).toBe("Escreva a nota antes de salvar.");
    expect(render(a).mensagem).not.toBe(ERRO);
  });

  it("o marcador de descarte é a IDENTIDADE do estado, não um booleano (2ª rede)", () => {
    // Estrutural, além do comportamental acima: a mutação (ii) some daqui
    // também, e com o nome do defeito por escrito.
    const src = readFileSync(
      fileURLToPath(new URL("../../src/components/task/escrita.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toContain("descartado: estadoDescartado === estado");
    expect(src).toContain("useState<EstadoAcaoTarefa | null>(null)");
    expect(src).not.toMatch(/setDescartado\(true\)/);
  });
});

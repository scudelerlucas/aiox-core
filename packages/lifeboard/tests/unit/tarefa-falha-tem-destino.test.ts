import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { avisarHumano, destinoPadrao, type DestinoDaFalha } from "@/lib/avisar-humano";

/**
 * OS-LIFEBOARD · P6 — [Checagem 8 da régua (B11), rodada 11] A FALHA CHEGA A
 * GENTE.
 *
 * O que o crítico mediu: a falha de leitura da página da tarefa virava
 * `console.error` + uma frase na tela, e **ninguém era avisado** — sem
 * destino humano e sem teste-sentinela. As duas metades eram verdadeiras e
 * nenhuma delas alcança uma pessoa: o log de um Server Component não tem
 * leitor, e a frase só existe para quem estiver na frente da tela naquele
 * segundo.
 *
 * Este arquivo é o teste-sentinela: prova que o destino existe, que ele é
 * usado no `catch` da página (derivado do fonte, não de um nome escrito à mão
 * aqui) e que a ausência de canal APARECE em vez de sumir.
 */

function destinoFalso(
  opcoes: { url?: string | null; falhar?: boolean } = {},
): { destino: DestinoDaFalha; enviados: string[]; registros: string[] } {
  const enviados: string[] = [];
  const registros: string[] = [];
  return {
    enviados,
    registros,
    destino: {
      url: opcoes.url === undefined ? "https://exemplo.invalido/hook" : opcoes.url,
      enviar: async (corpo: string) => {
        if (opcoes.falhar === true) throw new Error("canal fora do ar");
        enviados.push(corpo);
        return undefined;
      },
      registrar: (rotulo: string) => {
        registros.push(rotulo);
      },
    },
  };
}

describe("B11 — a falha de leitura tem um destino humano", () => {
  it("PRONTO QUANDO: com canal configurado, o aviso SAI com onde, alvo e mensagem", async () => {
    const { destino, enviados } = destinoFalso();
    const chegou = await avisarHumano(
      { onde: "/tarefa/[id]", alvo: "task-build", causa: new Error("conexão recusada") },
      destino,
    );
    expect(chegou).toBe(true);
    expect(enviados).toHaveLength(1);
    const corpo = JSON.parse(enviados[0] ?? "{}") as Record<string, string>;
    expect(corpo.onde).toBe("/tarefa/[id]");
    expect(corpo.alvo).toBe("task-build");
    expect(corpo.mensagem).toBe("conexão recusada");
    expect(typeof corpo.quando).toBe("string");
  });

  it("PRONTO QUANDO: SEM canal configurado, a ausência aparece — não some", async () => {
    const { destino, enviados, registros } = destinoFalso({ url: null });
    const chegou = await avisarHumano({ onde: "/tarefa/[id]", alvo: "t", causa: "x" }, destino);
    expect(chegou).toBe(false);
    expect(enviados).toEqual([]);
    expect(registros.join(" ")).toContain("sem canal humano configurado");
  });

  it("PRONTO QUANDO: o canal recusar o aviso não vira a segunda falha", async () => {
    const { destino, registros } = destinoFalso({ falhar: true });
    await expect(
      avisarHumano({ onde: "/tarefa/[id]", alvo: "t", causa: new Error("x") }, destino),
    ).resolves.toBe(false);
    expect(registros.join(" ")).toContain("recusou o aviso");
  });

  it("PRONTO QUANDO: o destino padrão lê a variável de ambiente, e nada mais", () => {
    const antes = process.env.LIFEBOARD_ALERTA_WEBHOOK;
    delete process.env.LIFEBOARD_ALERTA_WEBHOOK;
    expect(destinoPadrao().url).toBeNull();
    process.env.LIFEBOARD_ALERTA_WEBHOOK = "https://exemplo.invalido/hook";
    expect(destinoPadrao().url).toBe("https://exemplo.invalido/hook");
    if (antes === undefined) delete process.env.LIFEBOARD_ALERTA_WEBHOOK;
    else process.env.LIFEBOARD_ALERTA_WEBHOOK = antes;
  });

  /**
   * A sentinela propriamente dita: DERIVADA do fonte da página. Um `catch`
   * novo que só logue e devolva a tela de erro derruba este teste — que é
   * exatamente o defeito que a rodada 10 tinha.
   */
  it("PRONTO QUANDO: todo `catch` da página da tarefa manda a falha ao destino humano", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/app/tarefa/[id]/page.tsx", import.meta.url)),
      "utf8",
    );
    const blocos = [...src.matchAll(/catch\s*\([^)]*\)\s*\{([\s\S]*?)\n {2}\}/g)].map((m) => m[1] ?? "");
    expect(blocos.length, "a página não tem mais nenhum catch?").toBeGreaterThan(0);
    for (const bloco of blocos) {
      expect(bloco, `um catch da página não avisa ninguém:\n${bloco}`).toContain("avisarHumano");
    }
    // E o log cru sozinho não é mais o tratamento.
    expect(src).not.toMatch(/catch[\s\S]{0,80}console\.error[\s\S]{0,80}return <NaoConsegui/);
  });

  it("PRONTO QUANDO: o registro nunca interpola variável no 1º argumento de console (CodeQL)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/lib/avisar-humano.ts", import.meta.url)),
      "utf8",
    );
    for (const m of src.matchAll(/console\.\w+\(([^,)]*)/g)) {
      expect(m[1] ?? "", "1º argumento de console com template/variável").toMatch(/^"[^"]*"$/);
    }
  });

  it("PRONTO QUANDO: o erro cru nunca vai para a tela do operador", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../src/app/tarefa/[id]/page.tsx", import.meta.url)),
      "utf8",
    );
    const tela = /function NaoConsegui\(\{[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
    expect(tela).toContain("Não consegui ler esta tarefa agora");
    expect(tela).not.toContain("erro");
    expect(tela).not.toContain("stack");
  });
});

/** O `fetch` do destino padrão nunca é chamado sem URL — prova de fumaça. */
describe("B11 — o destino padrão não bate em rede à toa", () => {
  it("PRONTO QUANDO: sem canal, nenhum fetch acontece", async () => {
    const antes = process.env.LIFEBOARD_ALERTA_WEBHOOK;
    delete process.env.LIFEBOARD_ALERTA_WEBHOOK;
    const espiao = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
    await avisarHumano({ onde: "/tarefa/[id]", alvo: "t", causa: "x" });
    expect(espiao).not.toHaveBeenCalled();
    espiao.mockRestore();
    if (antes !== undefined) process.env.LIFEBOARD_ALERTA_WEBHOOK = antes;
  });
});

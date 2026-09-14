import { describe, expect, it, vi } from "vitest";

import { executarAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { EstadoAcaoTarefa } from "@/app/tarefa/actions";

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #4 (rodada 5): 8 dos 9 componentes desta
 * página não tinham teste nenhum. O repo não tem jsdom nem
 * `@testing-library` (ver a nota longa em `controle-segmentado.test.tsx`) e a
 * instrução deste PR proíbe `npm install` — então a parte do comportamento
 * que MAIS custa errar em uso repetido ("20 tarefas por dia sem perder uma
 * edição") foi extraída do hook para uma função sem React, e é ela que este
 * arquivo exerce:
 *
 *  - a action devolve `{ok:true}` → é o que chega a quem chamou (e só nesse
 *    caso o chamador roda `aoSucesso` + `router.refresh()`);
 *  - a action devolve `{erro}` → chega o erro, em português, do servidor;
 *  - a action REJEITA (falha de rede de verdade — o fetch da Server Action
 *    estoura) → nunca propaga a exceção: vira uma frase em português. Sem
 *    isto, o `await` do hook lançava, `aoFalha` nunca rodava e o controle
 *    otimista ficava preso PARA SEMPRE no valor que o servidor recusou.
 *
 * Reverter para ver falhar: em `src/components/task/usar-acao-tarefa.ts`,
 * apagar o `try/catch` de `executarAcaoTarefa` (deixar `return acao(estado,
 * form)`) — o 3º teste passa a rejeitar em vez de devolver a frase.
 */
function form(campos: Record<string, string> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("executarAcaoTarefa — o miolo da chamada, sem React (achado MÉDIO #4, rodada 5)", () => {
  it("PRONTO QUANDO: sucesso do servidor chega inteiro (com o `id`, que sustenta o Desfazer)", async () => {
    const acao = vi.fn(async (): Promise<EstadoAcaoTarefa> => ({ ok: true, id: "edge-1" }));
    const r = await executarAcaoTarefa(acao, {}, form({ destino: "t2" }));
    expect(r).toEqual({ ok: true, id: "edge-1" });
    expect(acao).toHaveBeenCalledTimes(1);
  });

  it("recusa do servidor chega como o erro EM PORTUGUÊS que a action escreveu — nunca JSON", async () => {
    const acao = vi.fn(
      async (): Promise<EstadoAcaoTarefa> => ({ erro: "Uma tarefa não pode ser mãe de si mesma." }),
    );
    const r = await executarAcaoTarefa(acao, {}, form());
    expect(r.erro).toBe("Uma tarefa não pode ser mãe de si mesma.");
    expect(r.ok).toBeUndefined();
  });

  it("PRONTO QUANDO: falha de REDE (a action rejeita) vira frase em português, não exceção", async () => {
    const acao = vi.fn(async (): Promise<EstadoAcaoTarefa> => {
      throw new TypeError("Failed to fetch");
    });
    const r = await executarAcaoTarefa(acao, {}, form());
    expect(r.erro).toBe("Não foi possível salvar agora — tente de novo.");
    expect(r.ok).toBeUndefined();
    // A mensagem nunca carrega o erro cru do navegador para a tela.
    expect(r.erro).not.toContain("fetch");
  });

  it("o estado anterior é repassado à action (mesmo contrato de useFormState)", async () => {
    const acao = vi.fn(async (estado: EstadoAcaoTarefa): Promise<EstadoAcaoTarefa> => estado);
    const anterior: EstadoAcaoTarefa = { erro: "erro anterior" };
    await executarAcaoTarefa(acao, anterior, form());
    expect(acao.mock.calls[0]?.[0]).toBe(anterior);
  });
});

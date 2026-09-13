"use client";

import { useMemo, useState } from "react";

import { ContaCard } from "@/components/prompts/conta-card";
import { NovoPromptForm, type TarefaParaLink } from "@/components/prompts/novo-prompt-form";
import { escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, Conta, ConsumoConta } from "@/core/prompts/tipos";
import { CONTAS, modeloParaComplexidade } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — casca client que liga os 3 cartões de conta ao
 * formulário: os dois compartilham `complexidade` (o modelo sugerido é o
 * mesmo nos dois) e o roteador PURO (`escolherConta`, mesma função testada em
 * `tests/unit/roteador-de-conta.test.ts`) decide, ao vivo, qual cartão
 * ganha o selo "escolhida agora" — sem round-trip nenhum até o envio real.
 */
export function PromptsClient({
  consumo,
  tarefas,
}: {
  consumo: readonly ConsumoConta[];
  tarefas: readonly TarefaParaLink[];
}): JSX.Element {
  const [complexidade, setComplexidade] = useState<Complexidade>("baixa");
  const [contaOverride, setContaOverride] = useState<string>("");

  const { consumos, tetos } = useMemo(() => {
    const c: Partial<Record<Conta, number>> = {};
    const t: Partial<Record<Conta, number>> = {};
    for (const item of consumo) {
      c[item.conta] = item.consumoHojeUsd;
      t[item.conta] = item.tetoUsd;
    }
    return { consumos: c, tetos: t };
  }, [consumo]);

  const escolha = useMemo(
    () => escolherConta(consumos, tetos, complexidade),
    [consumos, tetos, complexidade],
  );

  const modeloImplicado = modeloParaComplexidade(complexidade);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {CONTAS.map((conta) => {
          const item = consumo.find((c) => c.conta === conta);
          if (!item) return null;
          const seriaEscolhida =
            contaOverride === "" ? escolha.conta === conta : contaOverride === conta;
          return (
            <ContaCard
              key={conta}
              consumo={item}
              proximoModelo={modeloImplicado}
              seriaEscolhida={seriaEscolhida}
            />
          );
        })}
      </div>

      <NovoPromptForm
        complexidade={complexidade}
        aoMudarComplexidade={setComplexidade}
        contaOverride={contaOverride}
        aoMudarContaOverride={setContaOverride}
        modeloImplicado={modeloImplicado}
        motivoAuto={escolha.motivo}
        contaAuto={escolha.conta}
        tarefas={tarefas}
      />
    </div>
  );
}

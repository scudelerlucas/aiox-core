"use client";

import { useMemo, useState } from "react";

import { ContaCard } from "@/components/prompts/conta-card";
import { NovoPromptForm, type TarefaParaLink } from "@/components/prompts/novo-prompt-form";
import { contaTemEspacoPara, escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, ConsumoConta } from "@/core/prompts/tipos";
import { CONTAS, modeloParaComplexidade } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — casca client que liga os 3 cartões de conta ao
 * formulário: os dois compartilham `complexidade` e o roteador PURO
 * (`escolherConta`, a FONTE ÚNICA da regra, espelhada pelo SQL) decide ao
 * vivo qual cartão ganha o selo "escolhida agora" — sem round-trip até o envio.
 *
 * D3 (rodada 3): "sem espaço hoje" deixou de desabilitar o envio. A fila
 * ACEITA o item e ele roda quando houver espaço; o que a tela deve fazer é
 * dizer isso, não impedir. O único bloqueio real é o impossível (uma tarefa
 * que custa mais que o teto de qualquer conta) — aí `escolha.conta` é `null`.
 */
export function PromptsClient({
  consumo,
  tarefas,
  agora,
}: {
  consumo: readonly ConsumoConta[];
  tarefas: readonly TarefaParaLink[];
  agora?: number;
}): JSX.Element {
  const [complexidade, setComplexidade] = useState<Complexidade>("baixa");
  const [contaOverride, setContaOverride] = useState<string>("");

  // D36 (rodada 8): o instante entra no roteamento. Sem ele, `escolherConta` e
  // `contaTemEspacoPara` não conseguem perguntar "o banco recusaria agora?" —
  // e era exatamente isso que fazia a tela convidar para um disparo recusado.
  const instante = agora ?? Date.now();

  const escolha = useMemo(
    () => escolherConta(consumo, complexidade, instante),
    [consumo, complexidade, instante],
  );
  const modeloImplicado = modeloParaComplexidade(complexidade);

  const contaOverrideItem =
    contaOverride === "" ? undefined : consumo.find((c) => c.conta === contaOverride);
  const overrideSemEspaco =
    contaOverrideItem !== undefined &&
    !contaTemEspacoPara(contaOverrideItem, complexidade, instante);

  // "Não cabe hoje" é um AVISO; "impossível" (conta null) é o único bloqueio.
  const naoCabeHoje = contaOverride === "" ? !escolha.cabeHoje : overrideSemEspaco;
  const impossivel = escolha.conta === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {CONTAS.map((conta) => {
          const item = consumo.find((c) => c.conta === conta);
          if (!item) return null;
          const ehAOverride = contaOverride !== "" && contaOverride === conta;
          const seriaEscolhida = contaOverride === "" ? escolha.conta === conta : ehAOverride;
          const semEspacoHoje = ehAOverride
            ? overrideSemEspaco
            : contaOverride === "" && escolha.conta === conta
              ? !escolha.cabeHoje
              : undefined;
          return (
            <ContaCard
              key={conta}
              consumo={item}
              proximoModelo={modeloImplicado}
              seriaEscolhida={seriaEscolhida}
              semEspacoHoje={semEspacoHoje}
              agora={instante}
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
        naoCabeHoje={naoCabeHoje}
        impossivel={impossivel}
      />
    </div>
  );
}

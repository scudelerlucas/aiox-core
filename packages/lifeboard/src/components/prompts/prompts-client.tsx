"use client";

import { useMemo, useState } from "react";

import { ContaCard } from "@/components/prompts/conta-card";
import { NovoPromptForm, type TarefaParaLink } from "@/components/prompts/novo-prompt-form";
import { contaTemEspacoPara, escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, Conta, ConsumoConta } from "@/core/prompts/tipos";
import { CONTAS, modeloParaComplexidade } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — casca client que liga os 3 cartões de conta ao
 * formulário: os dois compartilham `complexidade` (o modelo sugerido é o
 * mesmo nos dois) e o roteador PURO (`escolherConta`, mesma função testada em
 * `tests/unit/roteador-de-conta.test.ts`) decide, ao vivo, qual cartão
 * ganha o selo "escolhida agora" — sem round-trip nenhum até o envio real.
 *
 * Achados ALTO #8 / MÉDIO #13 (crítico hostil, rodada de correção
 * 13/09/2026): o roteador agora recebe `reservados` (o que já está
 * `na_fila`/`pega` por conta) e filtra por HEADROOM, não só "consumo <
 * teto" — e quando o operador escolhe uma conta À MÃO sem espaço, o cartão
 * dela vira "no teto — vai recusar" e o formulário desabilita o envio.
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

  const { consumos, tetos, reservados } = useMemo(() => {
    const c: Partial<Record<Conta, number>> = {};
    const t: Partial<Record<Conta, number>> = {};
    const r: Partial<Record<Conta, number>> = {};
    for (const item of consumo) {
      c[item.conta] = item.consumoHojeUsd;
      t[item.conta] = item.tetoUsd;
      r[item.conta] = item.reservadoUsd;
    }
    return { consumos: c, tetos: t, reservados: r };
  }, [consumo]);

  const escolha = useMemo(
    () => escolherConta(consumos, tetos, complexidade, reservados),
    [consumos, tetos, reservados, complexidade],
  );

  const modeloImplicado = modeloParaComplexidade(complexidade);

  // Achado MÉDIO #13: a conta escolhida À MÃO tem espaço para esta
  // complexidade? (o roteamento automático já garante isto — `escolha.conta`
  // só vem preenchido quando alguma conta tem headroom.)
  const contaOverrideItem =
    contaOverride === "" ? undefined : consumo.find((c) => c.conta === contaOverride);
  const overrideSemEspaco =
    contaOverrideItem !== undefined && !contaTemEspacoPara(contaOverrideItem, complexidade);
  const semEspacoNenhuma = contaOverride === "" ? escolha.conta === null : overrideSemEspaco;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {CONTAS.map((conta) => {
          const item = consumo.find((c) => c.conta === conta);
          if (!item) return null;
          const ehAOverride = contaOverride !== "" && contaOverride === conta;
          const seriaEscolhida = contaOverride === "" ? escolha.conta === conta : ehAOverride;
          const semEspacoParaComplexidade = ehAOverride
            ? overrideSemEspaco
            : contaOverride === "" && escolha.conta === conta
              ? false // escolha automática só aponta contas que JÁ têm headroom
              : undefined;
          return (
            <ContaCard
              key={conta}
              consumo={item}
              proximoModelo={modeloImplicado}
              seriaEscolhida={seriaEscolhida}
              semEspacoParaComplexidade={semEspacoParaComplexidade}
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
        semEspaco={semEspacoNenhuma}
      />
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

import { goalSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";

export interface MetaFormProps {
  taskId: string;
  isGoal: boolean;
}

/**
 * Alterna "é a meta (goal) do caminho crítico". O app só MOSTRA uma meta por
 * vez (o CPM escolhe a de menor id quando há mais de uma marcada — mesma
 * regra de `caminho-critico.ts`); marcar uma segunda não desmarca a primeira
 * automaticamente, por isso a dica abaixo do botão.
 */
export function MetaForm({ taskId, isGoal }: MetaFormProps): JSX.Element {
  const [valor, setValor] = useState(isGoal);
  // [MÉDIO #1, rodada 3] mesmo padrão de `MaeForm`/`StatusForm`: reverte o
  // botão para o último valor CONFIRMADO quando a action falha.
  const confirmadoRef = useRef(isGoal);
  const tentativaRef = useRef(confirmadoRef.current);
  const { estado, pendente, disparar } = useAcaoTarefa(
    goalSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function alternar(): void {
    const novo = !valor;
    tentativaRef.current = novo;
    setValor(novo);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("is_goal", String(novo));
    disparar(form);
  }

  return (
    <div>
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        aria-pressed={valor}
        className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-50 ${
          valor
            ? "border-gold-500 bg-navy-800 text-gold-300"
            : "border-navy-700 bg-navy-850 text-bone-300 hover:border-navy-600"
        }`}
      >
        {valor ? "★ Meta do caminho crítico" : "☆ Marcar como meta"}
      </button>
      <p className="mt-1.5 text-xs text-bone-400">
        O painel mostra uma meta por vez — com mais de uma marcada, vale a de menor id.
      </p>
      <CampoErro mensagem={estado.erro} />
    </div>
  );
}

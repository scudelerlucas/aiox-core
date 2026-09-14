"use client";

import { useRef, useState } from "react";

import { goalSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { concluirEscrita, decidirEscrita, recusarEscrita } from "@/components/task/escrita";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
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
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  // [MÉDIO #1, rodada 3] mesmo padrão de `MaeForm`/`StatusForm`: reverte o
  // botão para o último valor CONFIRMADO quando a action falha.
  const confirmadoRef = useRef(isGoal);
  const tentativaRef = useRef(confirmadoRef.current);
  // [BAIXO #5, rodada 4] mesmo padrão de `DuracaoForm`/`MaeForm`/`StatusForm`.
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(
    goalSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
      concluirEscrita(
        "meta",
        botaoRef.current,
        null,
        (t) => mostrar(t),
        tentativaRef.current ? "Marcada como meta." : "Meta removida.",
      );
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function alternar(): void {
    const novo = !valor;
    // [MÉDIO #2, rodada 5] recusa o 2º clique sem `disabled` (que tiraria o
    // foco do próprio botão apertado). [MÉDIO #3 + BAIXO #4, rodada 6] e a
    // recusa fala; gravar o valor que já está confirmado não gasta rede.
    const decisao = decidirEscrita({
      pendente: pendente || emVooAgora(),
      mudou: novo !== confirmadoRef.current,
    });
    if (decisao !== "gravar") {
      recusarEscrita("meta", decisao, { anunciar: (t) => mostrar(t), alertar: (t) => mostrar(t) });
      return;
    }
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
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        aria-pressed={valor}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
          pendente ? "opacity-50" : ""
        } ${
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
      <MensagemSucesso mensagem={mensagem} />
    </div>
  );
}

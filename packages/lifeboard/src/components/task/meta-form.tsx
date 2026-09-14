"use client";

import { useRef, useState } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";

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
  // [MÉDIO #1, rodada 3] reverte o botão para o último valor CONFIRMADO
  // quando a action falha.
  const confirmadoRef = useRef(isGoal);
  const tentativaRef = useRef(confirmadoRef.current);

  const porta = usarPortaDeEscrita({
    op: "meta",
    alvo: () => botaoRef.current,
    texto: () => (tentativaRef.current ? "Marcada como meta." : "Meta removida."),
    aoSucesso: () => {
      confirmadoRef.current = tentativaRef.current;
    },
    aoFalha: () => {
      setValor(confirmadoRef.current);
    },
  });

  function alternar(): void {
    const novo = !valor;
    // [MÉDIO #3 + BAIXO #4, rodada 6] a recusa fala, e gravar o valor que já
    // está confirmado não gasta rede. O otimismo (`setValor`) só acontece
    // quando a porta de fato gravou — é o veredito dela que diz isso.
    // [Major do CodeRabbit, rodada 10] e `tentativaRef` segue a MESMA lei: só
    // se escreve quando a porta aceita, senão uma recusa passa por cima do
    // valor em voo e a gravação a caminho anuncia o valor errado.
    const decisao = porta.escrever(
      { task_id: taskId, is_goal: String(novo) },
      { mudou: novo !== confirmadoRef.current },
    );
    if (decisao === "gravar") {
      tentativaRef.current = novo;
      setValor(novo);
    }
  }

  return (
    <div>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        aria-pressed={valor}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
          porta.pendente ? "opacity-50" : ""
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
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </div>
  );
}

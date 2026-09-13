"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { parentSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";

export interface OpcaoTarefa {
  id: string;
  title: string;
}

export interface MaeFormProps {
  taskId: string;
  parentIdAtual: string | null;
  /** Candidatas a mãe — o chamador já exclui a própria tarefa (`page.tsx`). */
  opcoes: readonly OpcaoTarefa[];
}

/** Seletor de mãe (`parent_id`) — "nenhuma" limpa a hierarquia. */
export function MaeForm({ taskId, parentIdAtual, opcoes }: MaeFormProps): JSX.Element {
  const [valor, setValor] = useState(parentIdAtual ?? "");
  // [MÉDIO #1, rodada 3] `confirmadoRef` guarda o último valor que o
  // SERVIDOR aceitou (começa no valor vindo do servidor via prop);
  // `tentativaRef` guarda o valor que ACABOU de ser submetido — em refs, não
  // em closure, porque `aoSucesso`/`aoFalha` só rodam depois que o `await`
  // da action resolve, e por lá `valor` (a variável de `useState`) já
  // poderia estar presa ao render antigo. Falha → `setValor` otimista é
  // revertido para o último confirmado; sem isto o `<select>` ficava preso
  // na mãe recusada até um reload manual.
  const confirmadoRef = useRef(parentIdAtual ?? "");
  const tentativaRef = useRef(confirmadoRef.current);
  const { estado, pendente, disparar } = useAcaoTarefa(
    parentSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function aoMudar(e: ChangeEvent<HTMLSelectElement>): void {
    const novo = e.target.value;
    tentativaRef.current = novo;
    setValor(novo);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("parent_id", novo);
    disparar(form);
  }

  return (
    <div>
      <select
        value={valor}
        onChange={aoMudar}
        disabled={pendente}
        aria-label="Tarefa mãe"
        className="w-full max-w-sm rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500 disabled:opacity-50"
      >
        <option value="">nenhuma</option>
        {opcoes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <CampoErro mensagem={estado.erro} />
    </div>
  );
}

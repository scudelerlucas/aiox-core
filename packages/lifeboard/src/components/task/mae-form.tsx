"use client";

import { useState, type ChangeEvent } from "react";

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
  const { estado, pendente, disparar } = useAcaoTarefa(parentSetAction);

  function aoMudar(e: ChangeEvent<HTMLSelectElement>): void {
    const novo = e.target.value;
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

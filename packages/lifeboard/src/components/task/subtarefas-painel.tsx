"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { subtarefaAddAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import { StatusChip } from "@/components/ui/status-chip";
import type { Task } from "@/types/canonical";

export interface SubtarefasPainelProps {
  parentId: string;
  filhas: readonly Task[];
}

export function SubtarefasPainel({ parentId, filhas }: SubtarefasPainelProps): JSX.Element {
  return (
    <div className="space-y-3">
      {filhas.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma subtarefa ainda.</p>
      ) : (
        <ul className="space-y-2">
          {filhas.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-850 p-3"
            >
              <Link
                href={`/tarefa/${f.id}`}
                prefetch={false}
                className="flex-1 text-sm font-medium text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
              >
                {f.title}
              </Link>
              <StatusChip status={f.status} />
              {f.estimativaDias != null ? (
                <span className="font-mono text-xs text-bone-400">{f.estimativaDias}d</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <FormularioNovaSubtarefa parentId={parentId} />
    </div>
  );
}

function FormularioNovaSubtarefa({ parentId }: { parentId: string }): JSX.Element {
  const [title, setTitle] = useState("");
  const [estimativa, setEstimativa] = useState("");
  const { estado, pendente, disparar } = useAcaoTarefa(subtarefaAddAction, () => {
    setTitle("");
    setEstimativa("");
  });

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("parent_id", parentId);
    form.set("title", title);
    form.set("estimativa_dias", estimativa);
    disparar(form);
  }

  return (
    <form onSubmit={aoEnviar} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-xs font-semibold text-bone-300">
        Título da subtarefa
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex.: Escrever os testes de borda"
          className="rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Duração (dias)
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={estimativa}
          onChange={(e) => setEstimativa(e.target.value)}
          placeholder="opcional"
          className="w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <button
        type="submit"
        disabled={pendente || title.trim().length === 0}
        className="inline-flex min-h-[40px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 disabled:opacity-50"
      >
        Adicionar subtarefa
      </button>
      <CampoErro mensagem={estado.erro} />
    </form>
  );
}

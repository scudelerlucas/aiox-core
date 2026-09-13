"use client";

import { useState, type FormEvent } from "react";

import { notaAddAction, notaDelAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { TaskNote } from "@/types/canonical";

export interface NotasPainelProps {
  taskId: string;
  notas: readonly TaskNote[];
}

/**
 * Notas em lista (mais recente primeiro — o servidor já entrega ordenado) +
 * o formulário "nova nota", que é a AÇÃO PRIMÁRIA desta página (régua de
 * UI/UX: uma ação primária por tela) — é por isso que o botão usa o
 * destaque dourado que o resto da página não usa.
 *
 * [MÉDIO #9, crítico 13/09] este comentário era FALSO: "Salvar átomos"
 * (atomos-form.tsx) usava o mesmo destaque dourado — 2 botões primários na
 * mesma tela. Corrigido rebaixando aquele para outline; a frase acima só
 * voltou a ser verdade depois desse ajuste.
 */
export function NotasPainel({ taskId, notas }: NotasPainelProps): JSX.Element {
  return (
    <div className="space-y-3">
      <FormularioNovaNota taskId={taskId} />
      {notas.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma nota ainda.</p>
      ) : (
        <ol className="space-y-2">
          {notas.map((n) => (
            <NotaLinha key={n.id} nota={n} taskId={taskId} />
          ))}
        </ol>
      )}
    </div>
  );
}

function FormularioNovaNota({ taskId }: { taskId: string }): JSX.Element {
  const [texto, setTexto] = useState("");
  const [autor, setAutor] = useState("");
  const { estado, pendente, disparar } = useAcaoTarefa(notaAddAction, () => setTexto(""));

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("texto", texto);
    form.set("autor", autor);
    disparar(form);
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-2">
      <label className="block text-xs font-semibold text-bone-300">
        Nova nota
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Escreva o que aconteceu, o que decidiu, o que falta…"
          className="mt-1 w-full rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="autor (opcional)"
          className="w-40 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          disabled={pendente || texto.trim().length === 0}
          className="inline-flex min-h-[40px] items-center rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-navy-950 disabled:opacity-50"
        >
          Salvar nota
        </button>
      </div>
      <CampoErro mensagem={estado.erro} />
    </form>
  );
}

function NotaLinha({ nota, taskId }: { nota: TaskNote; taskId: string }): JSX.Element {
  const { estado, pendente, disparar } = useAcaoTarefa(notaDelAction);
  const [confirmando, setConfirmando] = useState(false);

  function excluir(): void {
    if (!confirmando) {
      setConfirmando(true);
      window.setTimeout(() => setConfirmando(false), 3000);
      return;
    }
    setConfirmando(false);
    const form = new FormData();
    form.set("id", nota.id);
    form.set("task_id", taskId);
    disparar(form);
  }

  return (
    <li className="rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-relaxed text-bone-100">{nota.texto}</p>
        <button
          type="button"
          onClick={excluir}
          disabled={pendente}
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
            confirmando
              ? "bg-state-blocked/12 text-state-blocked"
              : "text-bone-400 hover:bg-state-blocked/10 hover:text-state-blocked"
          }`}
        >
          {confirmando ? "confirmar exclusão?" : "excluir"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-bone-400">
        {nota.autor ?? "sem autor"} · {formatRelativeTime(nota.createdAt)}
      </p>
      <CampoErro mensagem={estado.erro} />
    </li>
  );
}

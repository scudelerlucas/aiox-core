"use client";

import { useState } from "react";

import { statusSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { TaskStatus } from "@/types/canonical";

const OPCOES: readonly OpcaoSegmentada<TaskStatus>[] = [
  { valor: "open", rotulo: "aberta" },
  { valor: "in_progress", rotulo: "em progresso" },
  { valor: "blocked", rotulo: "bloqueada" },
  { valor: "done", rotulo: "concluída" },
];

export interface StatusFormProps {
  taskId: string;
  statusAtual: TaskStatus;
}

/** Segmentado de status — muda sozinho ao clicar (sem botão "salvar" extra). */
export function StatusForm({ taskId, statusAtual }: StatusFormProps): JSX.Element {
  const [valor, setValor] = useState<TaskStatus>(statusAtual);
  const { estado, pendente, disparar } = useAcaoTarefa(statusSetAction);

  function aoMudar(novo: TaskStatus): void {
    setValor(novo);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("status", novo);
    disparar(form);
  }

  return (
    <div>
      <ControleSegmentado
        rotuloGrupo="Status da tarefa"
        opcoes={OPCOES}
        valorAtual={valor}
        aoMudar={aoMudar}
        desabilitado={pendente}
      />
      <CampoErro mensagem={estado.erro} />
    </div>
  );
}

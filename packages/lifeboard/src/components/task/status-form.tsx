"use client";

import { useRef, useState } from "react";

import { statusSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { TaskStatus } from "@/types/canonical";

const OPCOES: readonly OpcaoSegmentada<TaskStatus>[] = [
  { valor: "open", rotulo: "aberta" },
  { valor: "in_progress", rotulo: "em progresso" },
  { valor: "blocked", rotulo: "bloqueada" },
  { valor: "done", rotulo: "concluída" },
];

const ROTULO_STATUS: Record<TaskStatus, string> = {
  open: "aberta",
  in_progress: "em progresso",
  blocked: "bloqueada",
  done: "concluída",
};

export interface StatusFormProps {
  taskId: string;
  statusAtual: TaskStatus;
}

/** Segmentado de status — muda sozinho ao clicar (sem botão "salvar" extra). */
export function StatusForm({ taskId, statusAtual }: StatusFormProps): JSX.Element {
  const [valor, setValor] = useState<TaskStatus>(statusAtual);
  // [MÉDIO #1, rodada 3] mesmo padrão de `MaeForm`: reverte o segmentado
  // para o último status CONFIRMADO quando a action falha (validação ou
  // falha de rede) — em vez de deixar "concluída" na tela sem estar no banco.
  const confirmadoRef = useRef(statusAtual);
  const tentativaRef = useRef(confirmadoRef.current);
  // [BAIXO #5, rodada 4] mesmo padrão de `DuracaoForm`/`MaeForm`.
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar } = useAcaoTarefa(
    statusSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
      mostrar(`Status atualizado para ${ROTULO_STATUS[tentativaRef.current]}.`);
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function aoMudar(novo: TaskStatus): void {
    tentativaRef.current = novo;
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
      <MensagemSucesso mensagem={mensagem} />
    </div>
  );
}

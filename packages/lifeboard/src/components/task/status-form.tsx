"use client";

import { useRef, useState } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";
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
  /** O grupo inteiro, para devolver o foco ao botão que ficou marcado. */
  const grupoRef = useRef<HTMLDivElement | null>(null);
  // [MÉDIO #1, rodada 3] reverte o segmentado para o último status CONFIRMADO
  // quando a action falha — em vez de deixar "concluída" na tela sem estar no
  // banco.
  const confirmadoRef = useRef(statusAtual);
  const tentativaRef = useRef(confirmadoRef.current);

  const porta = usarPortaDeEscrita({
    op: "status",
    alvo: () =>
      grupoRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]'),
    texto: () => `Status atualizado para ${ROTULO_STATUS[tentativaRef.current]}.`,
    aoSucesso: () => {
      confirmadoRef.current = tentativaRef.current;
    },
    aoFalha: () => {
      setValor(confirmadoRef.current);
    },
  });

  function aoMudar(novo: TaskStatus): void {
    /**
     * [MÉDIO #3, rodada 6] 6 Enters no botão JÁ selecionado mandavam 6 POSTs
     * idênticos. A recusa aqui é silenciosa de propósito (o operador está
     * vendo o valor que pediu, já marcado na tela).
     */
    // [Major do CodeRabbit, rodada 10] `tentativaRef` só depois do veredito:
    // escrito antes, uma recusa sobrescrevia o valor EM VOO e a gravação a
    // caminho anunciava e confirmava o valor errado.
    const decisao = porta.escrever(
      { task_id: taskId, status: novo },
      { mudou: novo !== confirmadoRef.current },
    );
    if (decisao === "gravar") {
      tentativaRef.current = novo;
      setValor(novo);
    }
  }

  return (
    <div ref={grupoRef}>
      <ControleSegmentado
        rotuloGrupo="Status da tarefa"
        opcoes={OPCOES}
        valorAtual={valor}
        aoMudar={aoMudar}
        desabilitado={porta.pendente}
      />
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </div>
  );
}

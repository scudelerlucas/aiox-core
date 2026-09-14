"use client";

import { useRef, useState } from "react";

import { statusSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { concluirEscrita, decidirEscrita, recusarEscrita } from "@/components/task/escrita";
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
  /**
   * [MÉDIO #3, rodada 6] O grupo inteiro, para devolver o foco ao botão que
   * ficou marcado. Ele nunca sai do DOM (nenhum controle desta página usa
   * `disabled`), mas passar o alvo explicitamente é o que faz esta operação
   * entrar no teste-varredura como todas as outras.
   */
  const grupoRef = useRef<HTMLDivElement | null>(null);
  // [MÉDIO #1, rodada 3] mesmo padrão de `MaeForm`: reverte o segmentado
  // para o último status CONFIRMADO quando a action falha (validação ou
  // falha de rede) — em vez de deixar "concluída" na tela sem estar no banco.
  const confirmadoRef = useRef(statusAtual);
  const tentativaRef = useRef(confirmadoRef.current);
  // [BAIXO #5, rodada 4] mesmo padrão de `DuracaoForm`/`MaeForm`.
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(
    statusSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
      concluirEscrita(
        "status",
        grupoRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]'),
        null,
        (t) => mostrar(t),
        `Status atualizado para ${ROTULO_STATUS[tentativaRef.current]}.`,
      );
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function aoMudar(novo: TaskStatus): void {
    /**
     * [MÉDIO #3, rodada 6] 6 Enters no botão JÁ selecionado mandavam 6 POSTs
     * idênticos — medido pelo crítico. Gravar o que já está gravado não é
     * salvar: é gastar rede e abrir uma janela de erro onde não havia nada a
     * mudar. A recusa aqui é silenciosa de propósito (o operador está vendo o
     * valor que pediu, já marcado na tela).
     */
    const decisao = decidirEscrita({
      pendente: pendente || emVooAgora(),
      mudou: novo !== confirmadoRef.current,
    });
    if (decisao !== "gravar") {
      recusarEscrita("status", decisao, { anunciar: (t) => mostrar(t), alertar: (t) => mostrar(t) });
      return;
    }
    tentativaRef.current = novo;
    setValor(novo);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("status", novo);
    disparar(form);
  }

  return (
    <div ref={grupoRef}>
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

"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { arestaAddAction, arestaDelAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import type { EdgeTipo, TaskEdge } from "@/types/canonical";

const ROTULO_TIPO: Record<EdgeTipo, string> = {
  predecessor: "predecessor",
  correlacao: "correlação",
  sinergia: "sinergia",
  obsolescencia: "obsolescência",
};

const OPCOES_TIPO: readonly OpcaoSegmentada<EdgeTipo>[] = [
  { valor: "predecessor", rotulo: "predecessor" },
  { valor: "correlacao", rotulo: "correlação" },
  { valor: "sinergia", rotulo: "sinergia" },
  { valor: "obsolescencia", rotulo: "obsolescência" },
];

export interface OpcaoTarefaRelacao {
  id: string;
  title: string;
}

export interface RelacoesPainelProps {
  taskId: string;
  /** Arestas em que esta tarefa é a ORIGEM (aponta para fora). */
  saindo: readonly TaskEdge[];
  /** Arestas em que esta tarefa é o DESTINO (apontam para cá). */
  entrando: readonly TaskEdge[];
  /** Candidatas a destino — o chamador já exclui a própria tarefa. */
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  tituloPorId: ReadonlyMap<string, string>;
}

export function RelacoesPainel({
  taskId,
  saindo,
  entrando,
  opcoesDestino,
  tituloPorId,
}: RelacoesPainelProps): JSX.Element {
  return (
    <div className="space-y-3">
      {saindo.length === 0 && entrando.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma relação ainda.</p>
      ) : (
        <ul className="space-y-2">
          {saindo.map((e) => (
            <LinhaAresta
              key={e.id}
              aresta={e}
              taskId={taskId}
              direcao="saindo"
              rotuloOutraPonta={tituloPorId.get(e.destino) ?? e.destino}
              outraPontaId={e.destino}
            />
          ))}
          {entrando.map((e) => (
            <LinhaAresta
              key={e.id}
              aresta={e}
              taskId={taskId}
              direcao="entrando"
              rotuloOutraPonta={tituloPorId.get(e.origem) ?? e.origem}
              outraPontaId={e.origem}
            />
          ))}
        </ul>
      )}
      <FormularioNovaAresta taskId={taskId} opcoesDestino={opcoesDestino} />
    </div>
  );
}

function LinhaAresta({
  aresta,
  taskId,
  direcao,
  rotuloOutraPonta,
  outraPontaId,
}: {
  aresta: TaskEdge;
  taskId: string;
  direcao: "saindo" | "entrando";
  rotuloOutraPonta: string;
  outraPontaId: string;
}): JSX.Element {
  const { estado, pendente, disparar } = useAcaoTarefa(arestaDelAction);
  // [MÉDIO #20, crítico 13/09] excluir nota já pedia confirmação em 2 passos
  // (clique → "confirmar exclusão?" → clique de novo); excluir relação
  // apagava direto no 1º clique. Mesma disciplina agora nos dois.
  const [confirmando, setConfirmando] = useState(false);

  function excluir(): void {
    if (!confirmando) {
      setConfirmando(true);
      window.setTimeout(() => setConfirmando(false), 3000);
      return;
    }
    setConfirmando(false);
    const form = new FormData();
    form.set("id", aresta.id);
    form.set("task_id", taskId);
    disparar(form);
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="min-w-0 flex-1">
        <span className="mr-2 rounded-full bg-navy-800 px-2 py-0.5 font-mono text-xs font-semibold text-gold-300">
          {ROTULO_TIPO[aresta.tipo]}
        </span>
        <span className="text-xs text-bone-400">{direcao === "saindo" ? "→" : "←"}</span>{" "}
        <Link
          href={`/tarefa/${outraPontaId}`}
          prefetch={false}
          className="text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
        >
          {rotuloOutraPonta}
        </Link>
        {aresta.tipo === "sinergia" ? (
          <span className="ml-2 font-mono text-xs text-bone-400">desconto {aresta.peso}</span>
        ) : null}
      </div>
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
      <CampoErro mensagem={estado.erro} />
    </li>
  );
}

function FormularioNovaAresta({
  taskId,
  opcoesDestino,
}: {
  taskId: string;
  opcoesDestino: readonly OpcaoTarefaRelacao[];
}): JSX.Element {
  const [destino, setDestino] = useState(opcoesDestino[0]?.id ?? "");
  const [tipo, setTipo] = useState<EdgeTipo>("predecessor");
  const [peso, setPeso] = useState("0.5");
  const { estado, pendente, disparar } = useAcaoTarefa(arestaAddAction);

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const form = new FormData();
    form.set("origem", taskId);
    form.set("destino", destino);
    form.set("tipo", tipo);
    if (tipo === "sinergia") form.set("peso", peso);
    disparar(form);
  }

  if (opcoesDestino.length === 0) {
    return <p className="text-xs text-bone-400">Não há outra tarefa para relacionar.</p>;
  }

  return (
    // [ALTO #4, crítico 13/09] mesmo ajuste — o desconto (`peso`) tem
    // min/max/step nativos que disparariam validação em inglês do Chrome.
    <form onSubmit={aoEnviar} noValidate className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
          Destino
          <select
            value={destino}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setDestino(e.target.value)}
            className="w-56 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
          >
            {opcoesDestino.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        {tipo === "sinergia" ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
            Desconto (0–1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="w-24 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
            />
          </label>
        ) : null}
        <button
          type="submit"
          disabled={pendente}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 disabled:opacity-50"
        >
          Adicionar relação
        </button>
      </div>
      <ControleSegmentado
        rotuloGrupo="Tipo de relação"
        opcoes={OPCOES_TIPO}
        valorAtual={tipo}
        aoMudar={setTipo}
        desabilitado={pendente}
      />
      <CampoErro mensagem={estado.erro} />
    </form>
  );
}

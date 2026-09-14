"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { MENSAGEM_INVALIDO } from "@/components/task/escrita";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";
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
              {/* [BAIXO #6, rodada 6] alvo de toque: o link ocupa a altura
                  inteira da linha (≥ 44 px), não só a altura do texto. */}
              <Link
                href={`/tarefa/${f.id}`}
                prefetch={false}
                className="inline-flex min-h-[44px] flex-1 items-center text-sm font-medium text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
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
  const tituloRef = useRef<HTMLInputElement | null>(null);
  // [MÉDIO #2, rodada 6] "Subtarefa criada." — este formulário não tinha
  // nenhuma região viva; para quem não enxerga a lista crescer, adicionar uma
  // subtarefa era mudo.
  // [ALTO #1, rodada 9] uma porta, e nada mais: sem despacho cru a obter, e
  // com o foco entregue ao campo que acabou de esvaziar (era ele que o
  // `disabled` por validade mandava para o `<body>`).
  const porta = usarPortaDeEscrita({
    op: "subtarefa_criar",
    alvo: () => tituloRef.current,
    aoSucesso: () => {
      setTitle("");
      setEstimativa("");
    },
  });

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    porta.escrever(
      { parent_id: parentId, title, estimativa_dias: estimativa },
      { valido: title.trim().length > 0 },
    );
  }

  const semTitulo = title.trim().length === 0;

  return (
    // [ALTO #4, crítico 13/09] mesmo ajuste de duracao-form.tsx — o campo de
    // duração aqui tem o mesmo `min={0.25}` que disparava validação nativa.
    <form onSubmit={aoEnviar} noValidate className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-xs font-semibold text-bone-300">
        Título da subtarefa
        <input
          ref={tituloRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            porta.aoMudarCampo();
          }}
          placeholder="ex.: Escrever os testes de borda"
          className="min-h-[44px] rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
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
          className="min-h-[44px] w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <button
        type="submit"
        // [ALTO #1, rodada 6] SEM `disabled` — nem por validade (ver
        // `notas-painel.tsx`). A recusa mora em `aoEnviar` e diz o motivo.
        // [MÉDIO #3, rodada 7] `aria-disabled` só enquanto grava — por
        // validade ele anunciava "indisponível" e a tecnologia assistiva
        // recusava o clique que mouse e teclado faziam. A exigência é o texto
        // abaixo, ligado por `aria-describedby`.
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        aria-describedby={semTitulo ? "dica-nova-subtarefa" : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 ${porta.pendente ? "opacity-50" : ""}`}
      >
        Adicionar subtarefa
      </button>
      {semTitulo ? (
        <p id="dica-nova-subtarefa" className="w-full text-xs text-bone-400">
          {MENSAGEM_INVALIDO.subtarefa_criar}
        </p>
      ) : null}
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </form>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";

import { estimativaSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { concluirEscrita, decidirEscrita, recusarEscrita } from "@/components/task/escrita";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";

export interface DuracaoFormProps {
  taskId: string;
  estimativaDias: number | null;
}

/** Duração p80 em dias — sem ela a tarefa fica fora do caminho crítico, com aviso. */
export function DuracaoForm({ taskId, estimativaDias }: DuracaoFormProps): JSX.Element {
  const [valor, setValor] = useState<string>(estimativaDias != null ? String(estimativaDias) : "");
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  /**
   * [MÉDIO #3, rodada 6] o último valor que o SERVIDOR aceitou — apertar
   * "Salvar duração" duas vezes com o mesmo número mandava dois POSTs
   * idênticos. Aqui o botão continua respondendo (a região viva diz "nada
   * mudou"), só não gasta rede.
   */
  const confirmadoRef = useRef<string>(estimativaDias != null ? String(estimativaDias) : "");
  // [BAIXO #5, rodada 4] "Salvar duração" não dava nenhum sinal de sucesso —
  // 0 `role=alert`/`aria-live` fora do caminho de erro. `mostrar` dispara o
  // texto que `MensagemSucesso` deixa na tela por ~4s (role="status").
  const { mensagem, mostrar } = useMensagemSucesso();
  /** O que foi submetido — lido no `aoSucesso`, que roda depois do `await`. */
  const valorEnviadoRef = useRef<string>(confirmadoRef.current);
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(
    estimativaSetAction,
    () => {
      confirmadoRef.current = valorEnviadoRef.current;
      concluirEscrita("duracao", botaoRef.current, null, (t) => mostrar(t));
    },
  );

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const decisao = decidirEscrita({
      pendente: pendente || emVooAgora(),
      mudou: valor.trim() !== confirmadoRef.current.trim(),
    });
    if (decisao !== "gravar") {
      recusarEscrita("duracao", decisao, {
        anunciar: (t) => mostrar(t),
        alertar: (t) => mostrar(t),
      });
      return;
    }
    valorEnviadoRef.current = valor;
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("estimativa_dias", valor);
    disparar(form);
  }

  return (
    // [ALTO #4, crítico 13/09] `min`/`step` no <input> disparavam a validação
    // NATIVA do Chrome (inglês, fora do CampoErro) antes da action rodar —
    // `noValidate` desativa isso; `min`/`step` continuam como dica visual
    // (setas do spinner, teclado numérico), a régua de verdade é a Server
    // Action, cujo erro em português já cai no CampoErro.
    <form onSubmit={aoEnviar} noValidate className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Duração (dias, p80)
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="ex.: 2"
          className="min-h-[44px] w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <button
        ref={botaoRef}
        type="submit"
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 transition hover:border-gold-600 ${
          pendente ? "opacity-50" : ""
        }`}
      >
        Salvar duração
      </button>
      <CampoErro mensagem={estado.erro} />
      <MensagemSucesso mensagem={mensagem} />
    </form>
  );
}

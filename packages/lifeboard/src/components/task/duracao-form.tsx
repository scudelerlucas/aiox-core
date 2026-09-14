"use client";

import { useRef, useState, type FormEvent } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";

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
  /** O que foi submetido — lido no `aoSucesso`, que roda depois do `await`. */
  const valorEnviadoRef = useRef<string>(confirmadoRef.current);

  const porta = usarPortaDeEscrita({
    op: "duracao",
    alvo: () => botaoRef.current,
    aoSucesso: () => {
      confirmadoRef.current = valorEnviadoRef.current;
    },
  });

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    valorEnviadoRef.current = valor;
    porta.escrever(
      { task_id: taskId, estimativa_dias: valor },
      { mudou: valor.trim() !== confirmadoRef.current.trim() },
    );
  }

  return (
    // [ALTO #4, crítico 13/09] `min`/`step` no <input> disparavam a validação
    // NATIVA do Chrome (inglês, fora do CampoErro) antes da action rodar —
    // `noValidate` desativa isso; a régua de verdade é a Server Action.
    <form onSubmit={aoEnviar} noValidate className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Duração (dias, p80)
        <input
          type="number"
          min={0.25}
          step={0.25}
          value={valor}
          // [ALTO #2, rodada 9] mexer no campo descarta o erro velho do
          // servidor — era ele que sobrevivia à correção e contradizia a
          // recusa nova na mesma tela.
          onChange={(e) => {
            setValor(e.target.value);
            porta.aoMudarCampo();
          }}
          placeholder="ex.: 2"
          className="min-h-[44px] w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <button
        ref={botaoRef}
        type="submit"
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 transition hover:border-gold-600 ${
          porta.pendente ? "opacity-50" : ""
        }`}
      >
        Salvar duração
      </button>
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </form>
  );
}

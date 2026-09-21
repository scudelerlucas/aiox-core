"use client";

import { useRef, useState, type FormEvent } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { CampoNumerico } from "@/components/task/campo-numerico";
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
    // [BAIXO, rodada 11] esvaziar o campo REMOVE a duração, e a tela dizia
    // "Duração salva." mesmo assim — a mesma frase dos dois desfechos
    // opostos. (`MaeForm` já distinguia: "Tarefa mãe removida.".)
    texto: () =>
      valorEnviadoRef.current.trim() === "" ? "Duração removida." : "Duração salva.",
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
      {/* [CRÍTICO, rodada 11] campo de TEXTO: um `type="number"` em estado
          `badInput` (`2e`) mostrava `2e` na caixa e entregava `""` ao
          programa — e o servidor apagava a duração salva dizendo "Duração
          salva.". Ver `campo-numerico.tsx`. */}
      <CampoNumerico
        rotulo="Duração (dias, p80 — o prazo que acerta em 8 de 10 vezes)"
        valor={valor}
        // [ALTO #2, rodada 9] mexer no campo descarta o erro velho do
        // servidor — era ele que sobrevivia à correção e contradizia a
        // recusa nova na mesma tela.
        aoMudar={(texto) => {
          setValor(texto);
          porta.aoMudarCampo();
        }}
        placeholder="ex.: 2"
        classeDoCampo="min-h-[44px] w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
      />
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

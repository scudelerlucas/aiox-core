"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";

export interface OpcaoTarefa {
  id: string;
  title: string;
}

export interface MaeFormProps {
  taskId: string;
  parentIdAtual: string | null;
  /**
   * Candidatas a mãe — o chamador já exclui a própria tarefa (`page.tsx`) e,
   * desde a rodada 11, também as DESCENDENTES dela (MÉDIO A6).
   */
  opcoes: readonly OpcaoTarefa[];
  /**
   * [MÉDIO A6, rodada 11] Quantas descendentes ficaram de fora da lista.
   * O `<select>` oferecia as próprias filhas e netas: escolher uma ia ao
   * servidor e voltava com "Isso criaria um ciclo de hierarquia…". A régua
   * pede prevenir antes de avisar (F5) — mas sumir em silêncio seria o outro
   * defeito, então o número aparece com o motivo.
   */
  descendentesOcultas: number;
}

/** Seletor de mãe (`parent_id`) — "nenhuma" limpa a hierarquia. */
export function MaeForm({
  taskId,
  parentIdAtual,
  opcoes,
  descendentesOcultas,
}: MaeFormProps): JSX.Element {
  const [valor, setValor] = useState(parentIdAtual ?? "");
  const selectRef = useRef<HTMLSelectElement | null>(null);
  // [MÉDIO #1, rodada 3] `confirmadoRef` = o último valor que o SERVIDOR
  // aceitou; `tentativaRef` = o que ACABOU de ser submetido. Em refs porque
  // `aoSucesso`/`aoFalha` só rodam depois do `await`, e lá a variável de
  // `useState` estaria presa ao render antigo.
  const confirmadoRef = useRef(parentIdAtual ?? "");
  const tentativaRef = useRef(confirmadoRef.current);

  const porta = usarPortaDeEscrita({
    op: "mae",
    alvo: () => selectRef.current,
    texto: () =>
      tentativaRef.current === "" ? "Tarefa mãe removida." : "Tarefa mãe atualizada.",
    aoSucesso: () => {
      confirmadoRef.current = tentativaRef.current;
    },
    aoFalha: () => {
      setValor(confirmadoRef.current);
    },
  });

  function aoMudar(e: ChangeEvent<HTMLSelectElement>): void {
    const novo = e.target.value;
    // [Major do CodeRabbit, rodada 10] o ref da TENTATIVA só se escreve depois
    // que a porta ACEITA. Antes ele era escrito aqui em cima, e uma escolha
    // recusada passava por cima do valor EM VOO: a gravação a caminho lia este
    // ref em `texto()` e em `aoSucesso`, anunciava a frase errada e guardava em
    // `confirmadoRef` um valor que o servidor nunca recebeu. E logo abaixo, no
    // ramo "aguardar", a leitura devolvia ao `<select>` exatamente a opção
    // recusada — o oposto do que o comentário ali promete.
    const decisao = porta.escrever(
      { task_id: taskId, parent_id: novo },
      { mudou: novo !== confirmadoRef.current },
    );
    if (decisao === "gravar") {
      tentativaRef.current = novo;
      setValor(novo);
      return;
    }
    // O `<select>` nativo já trocou de valor sozinho (o React não
    // re-renderiza quando o estado não muda): devolve ao valor que a tela
    // deve estar mostrando — o que está EM VOO, se há uma gravação a caminho
    // ("aguardar"), ou o último confirmado. Nunca a escolha recusada.
    const naTela = decisao === "aguardar" ? tentativaRef.current : confirmadoRef.current;
    setValor(naTela);
    if (selectRef.current !== null) selectRef.current.value = naTela;
  }

  return (
    <div>
      {/* [MÉDIO #2, rodada 5] sem `disabled` durante a gravação: um `<select>`
          que vira `disabled` perde o foco para o `<body>`. `aria-busy`/
          `aria-disabled` dizem o mesmo ao leitor de tela sem mexer no foco; a
          recusa do segundo envio está na porta. */}
      <select
        ref={selectRef}
        value={valor}
        onChange={aoMudar}
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        aria-label="Tarefa mãe"
        className={`min-h-[44px] w-full max-w-sm rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500 ${
          porta.pendente ? "opacity-50" : ""
        }`}
      >
        <option value="">nenhuma</option>
        {opcoes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      {descendentesOcultas > 0 ? (
        <p className="mt-1.5 text-xs text-bone-400">
          {descendentesOcultas === 1
            ? "1 subtarefa desta tarefa está fora da lista"
            : `${String(descendentesOcultas)} subtarefas desta tarefa estão fora da lista`}
          : uma tarefa não pode ter a própria subtarefa como mãe.
        </p>
      ) : null}
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </div>
  );
}

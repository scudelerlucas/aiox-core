"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";

/** A tarefa que o cronograma está de fato usando como alvo final. */
export interface MetaVigente {
  id: string;
  title: string;
}

export interface MetaFormProps {
  taskId: string;
  isGoal: boolean;
  /**
   * [MÉDIO #3, rodada 12] QUEM VENCE, POR NOME. `null` = nenhuma tarefa está
   * marcada como meta. Calculado no servidor (`page.tsx`) com a MESMA régua
   * do cronograma (`caminho-critico.ts`: entre várias marcadas, vale a de
   * menor id).
   */
  metaVigente: MetaVigente | null;
}

/**
 * Alterna "esta tarefa é o alvo final do cronograma".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * [MÉDIO #3, rodada 12] DUAS TAREFAS DIZIAM, AO MESMO TEMPO, SER O ALVO FINAL.
 *
 * Medido no Chromium: em `/tarefa/task-docs`, clicar "☆ Marcar como meta"
 * com `task-deploy` já marcada. Nada impedia, nada avisava, e as DUAS páginas
 * passavam a estampar os mesmos três rótulos de meta. Dois defeitos no mesmo
 * bloco:
 *
 *  (a) o botão afirmava "★ Meta do caminho crítico" numa tarefa que a frase
 *      logo abaixo declarava FORA do caminho crítico ("Fora do caminho
 *      crítico calculado agora…"). Duas frases opostas, coladas;
 *  (b) a saída de emergência — *"com mais de uma marcada, vale a de menor
 *      id"* — estava escrita num valor que a página NUNCA MOSTRA
 *      (`task-docs`, `task-deploy` são identificadores internos). O operador
 *      não tinha como saber qual das duas valia.
 *
 * O que mudou: o botão deixou de reivindicar o caminho crítico (isso quem diz
 * é a janela do cronograma, logo abaixo, que sabe a conta), e **quando há
 * outra meta marcada a tela diz QUAL É, pelo título, com link para ela** — em
 * vez de mandar o operador comparar ids que ele não vê.
 *
 * O que NÃO foi feito, e é decisão de produto: marcar uma segunda meta
 * continua não desmarcando a primeira. Desmarcar sozinho seria uma segunda
 * escrita, numa OUTRA tarefa, disparada por um clique que não a mencionava —
 * e esta página nunca escreveu em tarefa que não é a dela. Proposta no
 * relatório.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function MetaForm({ taskId, isGoal, metaVigente }: MetaFormProps): JSX.Element {
  const [valor, setValor] = useState(isGoal);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  // [MÉDIO #1, rodada 3] reverte o botão para o último valor CONFIRMADO
  // quando a action falha.
  const confirmadoRef = useRef(isGoal);
  const tentativaRef = useRef(confirmadoRef.current);

  const porta = usarPortaDeEscrita({
    op: "meta",
    alvo: () => botaoRef.current,
    texto: () => (tentativaRef.current ? "Marcada como meta." : "Meta removida."),
    aoSucesso: () => {
      confirmadoRef.current = tentativaRef.current;
    },
    aoFalha: () => {
      setValor(confirmadoRef.current);
    },
  });

  function alternar(): void {
    const novo = !valor;
    // [MÉDIO #3 + BAIXO #4, rodada 6] a recusa fala, e gravar o valor que já
    // está confirmado não gasta rede. O otimismo (`setValor`) só acontece
    // quando a porta de fato gravou — é o veredito dela que diz isso.
    // [Major do CodeRabbit, rodada 10] e `tentativaRef` segue a MESMA lei: só
    // se escreve quando a porta aceita, senão uma recusa passa por cima do
    // valor em voo e a gravação a caminho anuncia o valor errado.
    const decisao = porta.escrever(
      { task_id: taskId, is_goal: String(novo) },
      { mudou: novo !== confirmadoRef.current },
    );
    if (decisao === "gravar") {
      tentativaRef.current = novo;
      setValor(novo);
    }
  }

  /**
   * Outra tarefa é que está valendo? `null` no servidor significa "ninguém
   * marcado ainda" — e, logo depois de marcar esta aqui, significa "esta".
   */
  const outraQueVale =
    metaVigente !== null && metaVigente.id !== taskId ? metaVigente : null;

  return (
    <div>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        aria-pressed={valor}
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
          porta.pendente ? "opacity-50" : ""
        } ${
          valor
            ? "border-gold-500 bg-navy-800 text-gold-300"
            : "border-navy-700 bg-navy-850 text-bone-300 hover:border-navy-600"
        }`}
      >
        {valor
          ? outraQueVale === null
            ? "★ Meta do cronograma"
            : "★ Marcada como meta — mas quem vale é outra"
          : "☆ Marcar como meta"}
      </button>
      <p className="mt-1.5 text-xs text-bone-400">
        {outraQueVale === null ? (
          valor ? (
            "O cronograma usa esta tarefa como alvo final."
          ) : (
            "Nenhuma tarefa está marcada como meta — o cronograma fica sem alvo final."
          )
        ) : (
          <>
            {valor
              ? "Duas tarefas estão marcadas como meta, e o cronograma só usa uma: quem vale hoje é "
              : "A meta de hoje é "}
            <Link
              href={`/tarefa/${outraQueVale.id}`}
              prefetch={false}
              // [BAIXO #6, rodada 6] alvo de toque de 44 px — mesmo padrão dos
              // links de `relacoes-painel.tsx`: medido a 390 px, este link
              // nascia com 30 px de altura.
              className="inline-flex min-h-[44px] items-center text-bone-200 underline underline-offset-2 hover:text-gold-300"
            >
              {outraQueVale.title}
            </Link>
            {valor
              ? ". Para esta aqui passar a valer, desmarque a outra."
              : ". Marcar esta aqui não desmarca aquela — as duas ficam marcadas e o cronograma continua usando aquela."}
          </>
        )}
      </p>
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </div>
  );
}

"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { parentSetAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";

export interface OpcaoTarefa {
  id: string;
  title: string;
}

export interface MaeFormProps {
  taskId: string;
  parentIdAtual: string | null;
  /** Candidatas a mãe — o chamador já exclui a própria tarefa (`page.tsx`). */
  opcoes: readonly OpcaoTarefa[];
}

/** Seletor de mãe (`parent_id`) — "nenhuma" limpa a hierarquia. */
export function MaeForm({ taskId, parentIdAtual, opcoes }: MaeFormProps): JSX.Element {
  const [valor, setValor] = useState(parentIdAtual ?? "");
  // [MÉDIO #1, rodada 3] `confirmadoRef` guarda o último valor que o
  // SERVIDOR aceitou (começa no valor vindo do servidor via prop);
  // `tentativaRef` guarda o valor que ACABOU de ser submetido — em refs, não
  // em closure, porque `aoSucesso`/`aoFalha` só rodam depois que o `await`
  // da action resolve, e por lá `valor` (a variável de `useState`) já
  // poderia estar presa ao render antigo. Falha → `setValor` otimista é
  // revertido para o último confirmado; sem isto o `<select>` ficava preso
  // na mãe recusada até um reload manual.
  const confirmadoRef = useRef(parentIdAtual ?? "");
  const tentativaRef = useRef(confirmadoRef.current);
  // [BAIXO #5, rodada 4] mesmo padrão de `DuracaoForm`: feedback de sucesso
  // que hoje não existe aqui fora do caminho de erro.
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar } = useAcaoTarefa(
    parentSetAction,
    () => {
      confirmadoRef.current = tentativaRef.current;
      mostrar(tentativaRef.current === "" ? "Tarefa mãe removida." : "Tarefa mãe atualizada.");
    },
    () => {
      setValor(confirmadoRef.current);
    },
  );

  function aoMudar(e: ChangeEvent<HTMLSelectElement>): void {
    // [MÉDIO #2, rodada 5] enquanto a gravação anterior não volta, a troca é
    // ignorada (era o `disabled={pendente}` que fazia isso — e era ele que
    // jogava o foco do `<select>` para o `<body>` a cada troca de mãe).
    if (pendente) return;
    const novo = e.target.value;
    tentativaRef.current = novo;
    setValor(novo);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("parent_id", novo);
    disparar(form);
  }

  return (
    <div>
      {/* [MÉDIO #2, rodada 5] sem `disabled` durante a gravação: um
          `<select>` que vira `disabled` perde o foco para o `<body>` (medido:
          5 de 5 operações da página faziam isso). `aria-busy`/`aria-disabled`
          dizem o mesmo ao leitor de tela sem mexer no foco; a recusa do
          segundo envio está em `aoMudar`. */}
      <select
        value={valor}
        onChange={aoMudar}
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        aria-label="Tarefa mãe"
        className={`w-full max-w-sm rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500 ${
          pendente ? "opacity-50" : ""
        }`}
      >
        <option value="">nenhuma</option>
        {opcoes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <CampoErro mensagem={estado.erro} />
      <MensagemSucesso mensagem={mensagem} />
    </div>
  );
}

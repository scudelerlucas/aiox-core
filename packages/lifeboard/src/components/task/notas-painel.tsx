"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";

import { notaAddAction, notaDelAction } from "@/app/tarefa/actions";
import { CampoErro } from "@/components/task/campo-erro";
import { alvoAposExclusaoDeNota, focar } from "@/components/task/foco";
import {
  gravarRascunhoNota,
  lerRascunhoNota,
  limparRascunhoNota,
} from "@/components/task/rascunho-nota";
import { useAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { TaskNote } from "@/types/canonical";

export interface NotasPainelProps {
  taskId: string;
  notas: readonly TaskNote[];
}

/** 10 s — mesma janela do "Desfazer" da relação criada (`relacoes-painel.tsx`). */
const JANELA_DESFAZER_MS = 10_000;

/**
 * Notas em lista (mais recente primeiro — o servidor já entrega ordenado) +
 * o formulário "nova nota", que é a AÇÃO PRIMÁRIA desta página (régua de
 * UI/UX: uma ação primária por tela) — é por isso que o botão usa o
 * destaque dourado que o resto da página não usa.
 *
 * [MÉDIO #9, crítico 13/09] este comentário era FALSO: "Salvar átomos"
 * (atomos-form.tsx) usava o mesmo destaque dourado — 2 botões primários na
 * mesma tela. Corrigido rebaixando aquele para outline; a frase acima só
 * voltou a ser verdade depois desse ajuste.
 *
 * [BAIXO #5 + MÉDIO #2, rodada 5] O painel — não a linha — é quem guarda o
 * "Excluída. Desfazer" e quem entrega o FOCO depois de uma exclusão: a linha
 * excluída SOME do DOM (junto com o botão que o operador acabou de apertar),
 * então nem a mensagem nem o foco podem morar dentro dela. A exclusão era, até
 * esta rodada, a única operação irreversível e silenciosa da página — a
 * criação é que tinha ganhado "Desfazer".
 */
export function NotasPainel({ taskId, notas }: NotasPainelProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Botões "excluir" por índice — o alvo do foco quando a nota some. */
  const botoesExcluirRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const [excluida, setExcluida] = useState<{ texto: string; autor: string | null } | null>(null);
  const [erroDesfazer, setErroDesfazer] = useState<string | undefined>(undefined);
  // `number` (não `ReturnType<typeof window.setTimeout>`) — mesma nota de
  // `mensagem-sucesso.tsx`: neste tsconfig o TIPO da propriedade discorda da
  // CHAMADA, e é a chamada que devolve o valor real no navegador.
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const { pendente: desfazendo, disparar: dispararDesfazer } = useAcaoTarefa(
    notaAddAction,
    () => {
      limparTimer();
      setErroDesfazer(undefined);
      setExcluida(null);
      // O botão "Desfazer" some agora — entrega o foco antes de sair.
      focar(textareaRef.current);
    },
    () => {
      // [MÉDIO #1, rodada 5] falha do desfazer NUNCA é silenciosa: frase em
      // português, `role="alert"`, ao lado do botão — que continua na tela
      // para uma segunda tentativa (a nota segue excluída no banco, e é isso
      // que a lista acima mostra).
      limparTimer();
      setErroDesfazer("Não foi possível desfazer — a nota continua excluída.");
    },
  );

  function aoExcluirComSucesso(nota: TaskNote, indice: number): void {
    // (1) FOCO primeiro: o `<li>` desta nota sai da árvore no `router.refresh()`
    // que vem logo em seguida. Alvo: a nota seguinte; se era a última, a
    // textarea da nota nova (`alvoAposExclusaoDeNota`, função pura testada).
    const alvo = alvoAposExclusaoDeNota(indice, notas.length);
    if (alvo.tipo === "nota") focar(botoesExcluirRef.current.get(alvo.indice));
    else focar(textareaRef.current);
    // (2) só então a janela de desfazer.
    limparTimer();
    setErroDesfazer(undefined);
    setExcluida({ texto: nota.texto, autor: nota.autor ?? null });
    timerRef.current = window.setTimeout(() => {
      setExcluida(null);
      // Se o foco estava no "Desfazer" que acabou de sumir, devolve à textarea.
      if (
        typeof document !== "undefined" &&
        botaoDesfazerRef.current !== null &&
        document.activeElement === botaoDesfazerRef.current
      ) {
        focar(textareaRef.current);
      }
    }, JANELA_DESFAZER_MS);
  }

  function desfazerExclusao(): void {
    if (!excluida || desfazendo) return;
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("texto", excluida.texto);
    if (excluida.autor !== null) form.set("autor", excluida.autor);
    dispararDesfazer(form);
  }

  return (
    <div className="space-y-3">
      <FormularioNovaNota taskId={taskId} textareaRef={textareaRef} />
      {/* [MÉDIO #3, rodada 5] região viva PERSISTENTE: nasce no DOM vazia (sem
          margem, sem altura) e o texto entra por troca de conteúdo — é isso
          que `aria-live="polite"` escuta. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          excluida ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {excluida ? (
          <>
            {/* [MÉDIO #1, rodada 5] desfazer que falhou: a notícia velha sai
                da região viva; ficam o botão (para tentar de novo) e o alerta. */}
            {erroDesfazer ? "" : "Excluída. "}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazerExclusao}
              aria-busy={desfazendo ? true : undefined}
              aria-disabled={desfazendo ? true : undefined}
              className={`underline underline-offset-2 hover:text-gold-300 ${
                desfazendo ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
        ) : (
          ""
        )}
      </p>
      <CampoErro mensagem={erroDesfazer} />
      {notas.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma nota ainda.</p>
      ) : (
        <ol className="space-y-2">
          {notas.map((n, indice) => (
            <NotaLinha
              key={n.id}
              nota={n}
              taskId={taskId}
              indice={indice}
              refDoBotao={(el) => {
                if (el) botoesExcluirRef.current.set(indice, el);
                else botoesExcluirRef.current.delete(indice);
              }}
              aoExcluir={aoExcluirComSucesso}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function FormularioNovaNota({
  taskId,
  textareaRef,
}: {
  taskId: string;
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
}): JSX.Element {
  const [texto, setTexto] = useState("");
  const [autor, setAutor] = useState("");
  const { estado, pendente, disparar } = useAcaoTarefa(notaAddAction, () => {
    setTexto("");
    // [BAIXO #6, rodada 5] salvou: o rascunho deixou de existir.
    limparRascunhoNota(taskId);
  });

  /**
   * [BAIXO #6, rodada 5] o rascunho volta ao voltar. Restaurado no EFEITO (não
   * no `useState` inicial) de propósito: `sessionStorage` não existe no
   * servidor, e ler no render faria o HTML do servidor divergir do primeiro
   * render do cliente (hidratação quebrada). Nada de `beforeunload` — decisão
   * do operador.
   */
  useEffect(() => {
    const rascunho = lerRascunhoNota(taskId);
    if (rascunho.length > 0) setTexto(rascunho);
  }, [taskId]);

  function aoDigitar(valor: string): void {
    setTexto(valor);
    gravarRascunhoNota(taskId, valor);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (pendente) return; // [MÉDIO #2, rodada 5] duplo envio recusado sem `disabled`.
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("texto", texto);
    form.set("autor", autor);
    disparar(form);
  }

  return (
    <form onSubmit={aoEnviar} className="space-y-2">
      <label className="block text-xs font-semibold text-bone-300">
        Nova nota
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
          rows={3}
          placeholder="Escreva o que aconteceu, o que decidiu, o que falta…"
          className="mt-1 w-full rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="autor (opcional)"
          className="w-40 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          // `disabled` SÓ pela validade (nota vazia) — nunca pelo `pendente`
          // (MÉDIO #2, rodada 5: era ele que mandava o foco para o `<body>`).
          disabled={texto.trim().length === 0}
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente || texto.trim().length === 0 ? true : undefined}
          className={`inline-flex min-h-[40px] items-center rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-navy-950 disabled:opacity-50 ${
            pendente ? "opacity-50" : ""
          }`}
        >
          Salvar nota
        </button>
      </div>
      <CampoErro mensagem={estado.erro} />
    </form>
  );
}

function NotaLinha({
  nota,
  taskId,
  indice,
  refDoBotao,
  aoExcluir,
}: {
  nota: TaskNote;
  taskId: string;
  indice: number;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  aoExcluir: (nota: TaskNote, indice: number) => void;
}): JSX.Element {
  const { estado, pendente, disparar } = useAcaoTarefa(notaDelAction, () =>
    aoExcluir(nota, indice),
  );
  const [confirmando, setConfirmando] = useState(false);

  function excluir(): void {
    if (pendente) return; // [MÉDIO #2, rodada 5]
    if (!confirmando) {
      setConfirmando(true);
      window.setTimeout(() => setConfirmando(false), 3000);
      return;
    }
    setConfirmando(false);
    const form = new FormData();
    form.set("id", nota.id);
    form.set("task_id", taskId);
    disparar(form);
  }

  return (
    <li className="rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-relaxed text-bone-100">{nota.texto}</p>
        <button
          ref={refDoBotao}
          type="button"
          onClick={excluir}
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente ? true : undefined}
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
            pendente ? "opacity-50" : ""
          } ${
            confirmando
              ? "bg-state-blocked/12 text-state-blocked"
              : "text-bone-400 hover:bg-state-blocked/10 hover:text-state-blocked"
          }`}
        >
          {confirmando ? "confirmar exclusão?" : "excluir"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-bone-400">
        {nota.autor ?? "sem autor"} · {formatRelativeTime(nota.createdAt)}
      </p>
      <CampoErro mensagem={estado.erro} />
    </li>
  );
}

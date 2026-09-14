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
import {
  concluirEscrita,
  decidirEscrita,
  recusarEscrita,
  type SinaisDeEscrita,
} from "@/components/task/escrita";
import { alvoAposExclusaoDeNota } from "@/components/task/foco";
import { MensagemSucesso, useMensagemSucesso } from "@/components/task/mensagem-sucesso";
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
 * então nem a mensagem nem o foco podem morar dentro dela.
 *
 * [ALTO #1 + MÉDIO #2, rodada 6] Nenhum botão daqui usa mais `disabled`, nem
 * por validade: era o `disabled={texto vazio}` de "Salvar nota" que, no
 * instante do sucesso (quando o `aoSucesso` esvazia a textarea), fazia o
 * navegador desfocar o botão e o foco cair no `<body>` — medido em 5 de 5
 * criações, a 1280 e a 390. Agora toda escrita passa por `decidirEscrita`
 * (antes) e `concluirEscrita` (depois), que entrega o foco e anuncia.
 */
export function NotasPainel({ taskId, notas }: NotasPainelProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Botões "excluir" por índice — o alvo do foco quando a nota some. */
  const botoesExcluirRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const [excluida, setExcluida] = useState<{ texto: string; autor: string | null } | null>(null);
  const [erroDesfazer, setErroDesfazer] = useState<string | undefined>(undefined);
  // A região viva do PAINEL: "Excluída." (persistente, junto do botão
  // Desfazer) e "Nota restaurada (como nova)." (4 s) saem daqui.
  const { mensagem, mostrar, limpar } = useMensagemSucesso();
  // `number` (não `ReturnType<typeof window.setTimeout>`) — mesma nota de
  // `mensagem-sucesso.tsx`: neste tsconfig o TIPO da propriedade discorda da
  // CHAMADA, e é a chamada que devolve o valor real no navegador.
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const sinais: SinaisDeEscrita = { anunciar: (t) => mostrar(t), alertar: setErroDesfazer };

  const {
    pendente: desfazendo,
    disparar: dispararDesfazer,
    emVooAgora: desfazerEmVoo,
  } = useAcaoTarefa(
    notaAddAction,
    () => {
      limparTimer();
      setErroDesfazer(undefined);
      setExcluida(null);
      // O botão "Desfazer" some agora — entrega o foco antes de sair, e diz o
      // que aconteceu. [BAIXO #5, rodada 6] "(como nova)": o desfazer INSERE
      // uma nota nova (id novo, data de agora) porque é só isso que a RPC
      // `nota_add` sabe fazer — ela não aceita `criado_em`. Por isso a nota
      // restaurada aparece no TOPO da lista, e por isso a frase avisa.
      concluirEscrita("nota_desfazer", textareaRef.current, null, (t) => mostrar(t));
    },
    () => {
      // [MÉDIO #1, rodada 5] falha do desfazer NUNCA é silenciosa: frase em
      // português, `role="alert"`, ao lado do botão — que continua na tela
      // para uma segunda tentativa (a nota segue excluída no banco, e é isso
      // que a lista acima mostra).
      limparTimer();
      limpar(); // a notícia velha ("Excluída.") sai da região viva.
      setErroDesfazer("Não foi possível desfazer — a nota continua excluída.");
    },
  );

  function aoExcluirComSucesso(nota: TaskNote, indice: number): void {
    // (1) FOCO primeiro: o `<li>` desta nota sai da árvore no `router.refresh()`
    // que vem logo em seguida. Alvo: a nota seguinte; se era a última, a
    // textarea da nota nova (`alvoAposExclusaoDeNota`, função pura testada).
    const alvo = alvoAposExclusaoDeNota(indice, notas.length);
    const alvoElemento =
      alvo.tipo === "nota" ? botoesExcluirRef.current.get(alvo.indice) : textareaRef.current;
    limparTimer();
    setErroDesfazer(undefined);
    concluirEscrita("nota_excluir", alvoElemento, textareaRef.current, (t) =>
      // Persistente: o texto tem de durar a janela inteira de 10 s, junto do
      // botão "Desfazer" que ele explica.
      mostrar(t, { persistente: true }),
    );
    // (2) só então a janela de desfazer.
    setExcluida({ texto: nota.texto, autor: nota.autor ?? null });
    timerRef.current = window.setTimeout(() => {
      setExcluida(null);
      limpar();
      // Se o foco estava no "Desfazer" que acabou de sumir, devolve à textarea.
      if (
        typeof document !== "undefined" &&
        botaoDesfazerRef.current !== null &&
        document.activeElement === botaoDesfazerRef.current
      ) {
        textareaRef.current?.focus();
      }
    }, JANELA_DESFAZER_MS);
  }

  function desfazerExclusao(): void {
    const decisao = decidirEscrita({
      pendente: desfazendo || desfazerEmVoo(),
      valido: excluida !== null,
    });
    if (decisao !== "gravar") {
      recusarEscrita("nota_desfazer", decisao, sinais);
      return;
    }
    if (!excluida) return; // defensivo: `valido` acima já garante.
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
          mensagem || excluida
            ? "text-xs font-medium text-state-done"
            : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {mensagem ? `${mensagem} ` : ""}
        {excluida ? (
          <button
            ref={botaoDesfazerRef}
            type="button"
            onClick={desfazerExclusao}
            aria-busy={desfazendo ? true : undefined}
            aria-disabled={desfazendo ? true : undefined}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
              desfazendo ? "opacity-50" : ""
            }`}
          >
            Desfazer
          </button>
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
              avisar={(t) => mostrar(t)}
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
  const [aviso, setAviso] = useState<string | undefined>(undefined);
  // [MÉDIO #2, rodada 6] as 8 regiões vivas da página não incluíam ESTA — a
  // ação primária da tela salvava em silêncio para quem não vê a lista mudar.
  const { mensagem, mostrar } = useMensagemSucesso();
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(notaAddAction, () => {
    setTexto("");
    // [BAIXO #6, rodada 5] salvou: o rascunho deixou de existir.
    limparRascunhoNota(taskId);
    // [ALTO #1, rodada 6] o campo que ficou vazio é para onde o trabalho
    // continua — e é o foco que o `disabled` levava para o `<body>`.
    concluirEscrita("nota_criar", textareaRef.current, null, (t) => mostrar(t));
  });

  /**
   * [BAIXO #6, rodada 5] o rascunho volta ao voltar. Restaurado no EFEITO (não
   * no `useState` inicial) de propósito: `sessionStorage` não existe no
   * servidor, e ler no render faria o HTML do servidor divergir do primeiro
   * render do cliente (hidratação quebrada).
   */
  useEffect(() => {
    const rascunho = lerRascunhoNota(taskId);
    if (rascunho.length > 0) setTexto(rascunho);
  }, [taskId]);

  function aoDigitar(valor: string): void {
    setTexto(valor);
    setAviso(undefined);
    gravarRascunhoNota(taskId, valor);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const decisao = decidirEscrita({
      pendente: pendente || emVooAgora(),
      valido: texto.trim().length > 0,
    });
    if (decisao !== "gravar") {
      recusarEscrita("nota_criar", decisao, { anunciar: (t) => mostrar(t), alertar: setAviso });
      return;
    }
    setAviso(undefined);
    const form = new FormData();
    form.set("task_id", taskId);
    form.set("texto", texto);
    form.set("autor", autor);
    disparar(form);
  }

  const vazia = texto.trim().length === 0;

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
          aria-label="Autor da nota (opcional)"
          className="min-h-[44px] w-40 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          // [ALTO #1, rodada 6] SEM `disabled` — nem por validade. Era ele que
          // tirava o foco do botão no instante do sucesso (o campo esvazia →
          // o botão vira `disabled` → o navegador desfoca → `<body>`). A
          // recusa mora em `aoEnviar`, e explica.
          aria-busy={pendente ? true : undefined}
          aria-disabled={pendente || vazia ? true : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-navy-950 ${
            pendente || vazia ? "opacity-50" : ""
          }`}
        >
          Salvar nota
        </button>
      </div>
      <CampoErro mensagem={estado.erro ?? aviso} />
      <MensagemSucesso mensagem={mensagem} />
    </form>
  );
}

function NotaLinha({
  nota,
  taskId,
  indice,
  refDoBotao,
  avisar,
  aoExcluir,
}: {
  nota: TaskNote;
  taskId: string;
  indice: number;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  /** A região viva do PAINEL — a linha não tem uma (ela some no sucesso). */
  avisar: (texto: string) => void;
  aoExcluir: (nota: TaskNote, indice: number) => void;
}): JSX.Element {
  const { estado, pendente, disparar, emVooAgora } = useAcaoTarefa(notaDelAction, () =>
    aoExcluir(nota, indice),
  );
  const [confirmando, setConfirmando] = useState(false);

  function excluir(): void {
    const decisao = decidirEscrita({ pendente: pendente || emVooAgora() });
    if (decisao !== "gravar") {
      recusarEscrita("nota_excluir", decisao, { anunciar: avisar, alertar: avisar });
      return;
    }
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
          className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 text-xs font-semibold ${
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

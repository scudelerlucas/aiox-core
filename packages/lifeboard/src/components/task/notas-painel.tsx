"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject,
} from "react";

import { CampoErro } from "@/components/task/campo-erro";
import {
  anuncioComDesfazerPerdido,
  MENSAGEM_INVALIDO,
  saidaPorConfirmacao,
  transicaoDeConfirmacao,
} from "@/components/task/escrita";
import { alvoAposExclusaoDeNota, type Focavel } from "@/components/task/foco";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita, type RegiaoViva } from "@/components/task/porta-de-escrita";
import {
  gravarRascunhoAutorNota,
  gravarRascunhoNota,
  lerRascunhoAutorNota,
  lerRascunhoNota,
} from "@/components/task/rascunho-nota";
import { dataCurtaNoFusoDoOperador } from "@/lib/fuso";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { TaskNote } from "@/types/canonical";

export interface NotasPainelProps {
  taskId: string;
  notas: readonly TaskNote[];
  /**
   * ═════════════════════════════════════════════════════ MÉDIO #4, rodada 12 ═
   * O INSTANTE DO SERVIDOR, VIAJANDO JUNTO COM O HTML.
   *
   * `NotaLinha` chamava `formatRelativeTime(nota.createdAt)`, e essa função
   * usa `Date.now()` quando ninguém lhe dá um `now`. Este é um componente
   * CLIENTE: o servidor o renderiza com o relógio dele e o navegador o
   * hidrata com o dele, mais tarde. Qualquer fronteira de arredondamento
   * atravessada entre os dois momentos ("agora mesmo" → "há 1 min") produz
   * textos diferentes, e o React joga fora a árvore inteira do servidor e
   * refaz tudo no cliente.
   *
   * Medido no Chromium, sem mexer em relógio nenhum: salvar uma nota, esperar
   * 45 s, recarregar com os scripts atrasados em 20 s (celular em rede ruim)
   * → `pageerror` *"Hydration failed because the server rendered text didn't
   * match the client"*, com o próprio React apontando o nó (`<NotaLinha>`) e
   * a troca (`+ há 1 min` / `- agora mesmo`) e nomeando a causa: *"Variable
   * input such as `Date.now()`"*.
   *
   * A correção é a que o próprio React recomenda no lugar de `suppressHydration
   * Warning`: **mandar o instantâneo junto com o HTML**. O servidor decide que
   * horas são, o número viaja no payload, e as duas renderizações fazem a
   * MESMA conta — independentemente de quanto tempo passar entre elas.
   */
  agora: number;
}

/** 10 s — mesma janela do "Desfazer" da relação criada (`relacoes-painel.tsx`). */
const JANELA_DESFAZER_MS = 10_000;

/**
 * A janela de desfazer, como UM valor.
 *
 * [BAIXO #6, rodada 9] O texto e o botão vivem no mesmo objeto de propósito:
 * na rodada 8 eram dois estados independentes, e um `limpar()` (desfazer que
 * falhou) apagava o texto e deixava o botão — a região viva ficava com o
 * conteúdo `"Desfazer"`, sozinho, sem dizer desfazer O QUÊ. Agora "um botão
 * sem frase" não é um estado que o tipo permita construir.
 */
interface JanelaDeDesfazerNota {
  texto: string;
  nota: { texto: string; autor: string | null; criadoEm: string };
}

/**
 * Notas em lista (mais recente primeiro — o servidor já entrega ordenado) +
 * o formulário "nova nota", que é a AÇÃO PRIMÁRIA desta página (régua de
 * UI/UX: uma ação primária por tela).
 *
 * [ALTO #1, rodada 9] Nenhuma escrita daqui tem despacho próprio: as três
 * (`nota_criar`, `nota_excluir`, `nota_desfazer`) são portas
 * (`usarPortaDeEscrita`), e a porta é o transporte — não há `disparar` cru a
 * obter, e a Server Action não aceita nada que não tenha vindo dela.
 *
 * [BAIXO #7, rodada 9] DUAS regiões vivas, com papéis distintos:
 *  - a região de ANÚNCIOS (`MensagemSucesso`) leva as transições de
 *    confirmação, as recusas e "Nota restaurada.";
 *  - a região do DESFAZER leva "Excluída." colada ao próprio botão.
 * Antes eram a mesma, e o pedido de confirmação da 2ª exclusão era lido
 * colado ao "Desfazer" da 1ª: *"Confirme: clique de novo em excluir para
 * apagar a nota. Desfazer"*.
 */
export function NotasPainel({ taskId, notas, agora }: NotasPainelProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Botões "excluir" por índice — o alvo do foco quando a nota some. */
  const botoesExcluirRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const [desfazer, setDesfazer] = useState<JanelaDeDesfazerNota | null>(null);
  const desfazerRef = useRef<JanelaDeDesfazerNota | null>(null);
  desfazerRef.current = desfazer;
  /**
   * [MÉDIO #5, rodada 7] Qual linha está em "confirmar exclusão?" — UMA por
   * painel. Mora aqui, e não dentro da linha, porque "outra ação começou" é
   * justamente uma linha vizinha entrar em confirmação.
   */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  // `number` (não `ReturnType<typeof window.setTimeout>`) — mesma nota de
  // `mensagem-sucesso.tsx`: neste tsconfig o TIPO da propriedade discorda da
  // CHAMADA, e é a chamada que devolve o valor real no navegador.
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const portaDesfazer = usarPortaDeEscrita({
    op: "nota_desfazer",
    alvo: () => textareaRef.current,
    aoSucesso: () => {
      limparTimer();
      setDesfazer(null);
    },
    // [MÉDIO #1, rodada 5] falha do desfazer NUNCA é silenciosa: frase em
    // português, `role="alert"`, ao lado do botão — que continua na tela (a
    // nota segue excluída no banco, e é isso que a frase diz). A região do
    // desfazer NÃO é apagada: era esse apagamento que deixava o botão
    // "Desfazer" sozinho na região viva (BAIXO #6).
    textoDeFalha: () => "Não foi possível desfazer — a nota continua excluída.",
  });

  /** A região viva de ANÚNCIOS do painel — confirmações, recusas, restauração. */
  const regiaoDeAnuncios: RegiaoViva = {
    mensagem: portaDesfazer.mensagem,
    mostrar: (t, o) => {
      portaDesfazer.anunciar(t, o);
    },
    limpar: () => {
      portaDesfazer.limparAnuncio();
    },
  };

  function pedirConfirmacao(id: string): void {
    const t = transicaoDeConfirmacao("nota_excluir", confirmandoId, id);
    if (t.anuncio !== null) regiaoDeAnuncios.mostrar(t.anuncio);
    setConfirmandoId(t.confirmandoId);
  }

  function cancelarConfirmacao(): void {
    const t = transicaoDeConfirmacao("nota_excluir", confirmandoId, null);
    if (t.anuncio !== null) regiaoDeAnuncios.mostrar(t.anuncio);
    setConfirmandoId(t.confirmandoId);
  }

  /**
   * [MÉDIO #3, rodada 9] O 2º clique — o que APAGA. Saída silenciosa: quem
   * fala é o sucesso da exclusão. A rodada 8 usava aqui a mesma porta do
   * cancelamento, e a região viva anunciava "Exclusão cancelada — a nota
   * continua." no clique que apagava a nota; com 1,2 s de latência de RPC a
   * frase falsa ficava 1.240 ms sozinha.
   */
  function confirmacaoExecutada(): void {
    const t = saidaPorConfirmacao("nota_excluir", confirmandoId);
    setConfirmandoId(t.confirmandoId);
  }

  function aoExcluirComSucesso(nota: TaskNote, texto: string): void {
    limparTimer();
    setDesfazer({
      texto,
      nota: { texto: nota.texto, autor: nota.autor ?? null, criadoEm: nota.createdAt },
    });
    timerRef.current = window.setTimeout(() => {
      setDesfazer(null);
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
    const janela = desfazerRef.current;
    portaDesfazer.escrever(
      {
        task_id: taskId,
        texto: janela?.nota.texto ?? "",
        autor: janela?.nota.autor ?? "",
        // [MÉDIO #4, rodada 7] a data original vai junto: `nota_add`
        // (migration 0017) recoloca a nota no instante em que ela nasceu, e a
        // lista — que ordena por `created_at desc` — a devolve à posição.
        criado_em: janela?.nota.criadoEm ?? "",
      },
      { valido: janela !== null },
    );
  }

  return (
    <div className="space-y-3">
      <FormularioNovaNota taskId={taskId} textareaRef={textareaRef} />
      {/* Região viva do DESFAZER: nasce vazia no DOM e recebe o texto por
          troca de conteúdo. O texto e o botão saem do MESMO valor — nunca um
          sem o outro (BAIXO #6). */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          desfazer ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {desfazer ? (
          <>
            {`${desfazer.texto} `}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazerExclusao}
              aria-busy={portaDesfazer.pendente ? true : undefined}
              aria-disabled={portaDesfazer.pendente ? true : undefined}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
                portaDesfazer.pendente ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
        ) : (
          ""
        )}
      </p>
      {/* Região viva de ANÚNCIOS — separada da de cima desde a rodada 9. */}
      <MensagemSucesso mensagem={portaDesfazer.mensagem} />
      <CampoErro mensagem={portaDesfazer.erroDoCampo} />
      {notas.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma nota ainda.</p>
      ) : (
        <ol className="space-y-2">
          {notas.map((n, indice) => (
            <NotaLinha
              key={n.id}
              nota={n}
              taskId={taskId}
              agora={agora}
              indice={indice}
              total={notas.length}
              refDoBotao={(el) => {
                if (el) botoesExcluirRef.current.set(indice, el);
                else botoesExcluirRef.current.delete(indice);
              }}
              regiao={regiaoDeAnuncios}
              temDesfazerPendente={() => desfazerRef.current !== null}
              alvoDoFoco={() => {
                // (1) FOCO primeiro: o `<li>` desta nota sai da árvore no
                // `router.refresh()` que vem logo em seguida. Alvo: a nota
                // seguinte; se era a última, a textarea da nota nova.
                const alvo = alvoAposExclusaoDeNota(indice, notas.length);
                return alvo.tipo === "nota"
                  ? botoesExcluirRef.current.get(alvo.indice)
                  : textareaRef.current;
              }}
              alternativaDoFoco={() => textareaRef.current}
              confirmando={confirmandoId === n.id}
              aoPedirConfirmacao={pedirConfirmacao}
              aoCancelarConfirmacao={cancelarConfirmacao}
              aoConfirmarExecutado={confirmacaoExecutada}
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
  /**
   * ═════════════════════════════════════════════════════════ ALTO #4, rodada 13 ═
   * SÓ SE ESVAZIA O CAMPO QUE AINDA TEM O QUE FOI ENVIADO.
   *
   * `aoSucesso` roda depois do `await` e esvaziava a caixa sem olhar o que
   * havia nela. Medido no Chromium com 2,5 s de latência: escrever "primeira
   * nota", clicar "Salvar nota" e continuar escrevendo 300 ms depois — quando
   * a resposta chegava, "segunda nota que eu estava escrevendo" virava `""` e
   * o rascunho do `sessionStorage` ia junto para `null`.
   *
   * O rascunho existe desde a rodada 5 exatamente para *"escrever meia nota e
   * não perder"*. Ele protegia contra NAVEGAR e não protegia contra SALVAR —
   * e salvar é o que o operador faz o tempo todo.
   *
   * Estes dois refs são o espelho do que está NA CAIXA agora (o `useState` lido
   * por `aoSucesso` seria o do render em que a closure nasceu) e o que de fato
   * foi enviado. Campo intacto: esvazia e apaga o rascunho dele. Campo mexido:
   * não se toca em nenhum dos dois — o que a pessoa está escrevendo é dela.
   */
  const naCaixaRef = useRef({ texto, autor });
  naCaixaRef.current = { texto, autor };
  const enviadoRef = useRef<{ texto: string; autor: string } | null>(null);
  const porta = usarPortaDeEscrita({
    op: "nota_criar",
    // [ALTO #1, rodada 6] o campo que ficou vazio é para onde o trabalho
    // continua — e é o foco que o `disabled` levava para o `<body>`.
    alvo: () => textareaRef.current,
    aoSucesso: () => {
      const enviado = enviadoRef.current;
      if (enviado === null) return;
      const textoIntacto = naCaixaRef.current.texto === enviado.texto;
      const autorIntacto = naCaixaRef.current.autor === enviado.autor;
      if (textoIntacto) {
        setTexto("");
        // [BAIXO #6, rodada 5] salvou: o rascunho daquele campo deixou de
        // existir. Valor vazio já é `removeItem` em `gravarRascunhoNota`.
        gravarRascunhoNota(taskId, "");
      }
      if (autorIntacto) {
        setAutor("");
        gravarRascunhoAutorNota(taskId, "");
      }
    },
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
    // [BAIXO, rodada 11] o autor volta junto: o texto sobrevivia ao F5 e o
    // autor não, e meio formulário restaurado em silêncio é pior que nenhum.
    const autorSalvo = lerRascunhoAutorNota(taskId);
    if (autorSalvo.length > 0) setAutor(autorSalvo);
  }, [taskId]);

  function aoDigitar(valor: string): void {
    setTexto(valor);
    porta.aoMudarCampo();
    gravarRascunhoNota(taskId, valor);
  }

  function aoDigitarAutor(valor: string): void {
    setAutor(valor);
    porta.aoMudarCampo();
    gravarRascunhoAutorNota(taskId, valor);
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // Mesma lei dos CRÍTICOs #1/#2: o ref do que foi enviado só se escreve
    // depois do veredito. Uma recusa não pode passar por cima do que está em voo.
    const decisao = porta.escrever(
      { task_id: taskId, texto, autor },
      { valido: texto.trim().length > 0 },
    );
    if (decisao === "gravar") enviadoRef.current = { texto, autor };
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
          onChange={(e) => {
            aoDigitarAutor(e.target.value);
          }}
          placeholder="autor (opcional)"
          aria-label="Autor da nota (opcional)"
          className="min-h-[44px] w-40 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        />
        <button
          type="submit"
          // [ALTO #1, rodada 6] SEM `disabled` — nem por validade. Era ele que
          // tirava o foco do botão no instante do sucesso. A recusa mora na
          // porta, e explica.
          //
          // [MÉDIO #3, rodada 7] E SEM `aria-disabled` por VALIDADE: a árvore
          // de acessibilidade anunciava "indisponível", e a tecnologia
          // assistiva recusava o clique que mouse e teclado faziam. Os dois
          // atributos ficam só enquanto a gravação está em curso; a exigência
          // virou o texto abaixo, ligado por `aria-describedby`.
          aria-busy={porta.pendente ? true : undefined}
          aria-disabled={porta.pendente ? true : undefined}
          aria-describedby={vazia ? "dica-nova-nota" : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-b from-gold-400 to-gold-600 px-4 text-sm font-semibold text-navy-950 ${
            porta.pendente ? "opacity-50" : ""
          }`}
        >
          Salvar nota
        </button>
      </div>
      {vazia ? (
        <p id="dica-nova-nota" className="text-xs text-bone-400">
          {MENSAGEM_INVALIDO.nota_criar}
        </p>
      ) : null}
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
    </form>
  );
}

/**
 * [MÉDIO #6, rodada 7] PURA — o nome acessível do botão "excluir" de UMA
 * linha. Medido pelo crítico: depois de excluir, o foco aterrissava num botão
 * chamado só "excluir", idêntico ao das outras linhas — quem ouve não sabia
 * excluir O QUÊ.
 *
 * Três peças: a POSIÇÃO ("2 de 5"), o autor e a data curta. A posição existe
 * porque autor + data não bastam: a medição da rodada 7, contra o fixture
 * semeado, achou DUAS notas do mesmo autor no mesmo dia. A data é curta
 * (dd/mm/aaaa), nunca "há 67 dias": duas notas da mesma semana teriam o mesmo
 * relativo.
 */
export function rotuloDoBotaoDeExcluir(
  nota: Pick<TaskNote, "autor" | "createdAt">,
  indice: number,
  total: number,
  confirmando: boolean,
): string {
  const quem = nota.autor ?? "sem autor";
  const quando = dataCurtaNoFusoDoOperador(nota.createdAt);
  const posicao = `a nota ${String(indice + 1)} de ${String(total)}`;
  const alvo = quando === null ? `${posicao}, de ${quem}` : `${posicao}, de ${quem}, de ${quando}`;
  // O texto VISÍVEL ("excluir" / "confirmar exclusão?") continua contido no
  // nome acessível — é o que WCAG 2.5.3 (Label in Name) pede.
  return confirmando ? `confirmar exclusão d${alvo}` : `excluir ${alvo}`;
}

function NotaLinha({
  nota,
  taskId,
  agora,
  indice,
  total,
  refDoBotao,
  regiao,
  temDesfazerPendente,
  alvoDoFoco,
  alternativaDoFoco,
  confirmando,
  aoPedirConfirmacao,
  aoCancelarConfirmacao,
  aoConfirmarExecutado,
  aoExcluir,
}: {
  nota: TaskNote;
  taskId: string;
  /** [MÉDIO #4, rodada 12] o relógio do SERVIDOR — ver `NotasPainelProps`. */
  agora: number;
  indice: number;
  /** Quantas notas a lista tem — o "de 5" do rótulo (MÉDIO #6). */
  total: number;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  /** A região de ANÚNCIOS do painel — a linha some no sucesso, não pode ter uma. */
  regiao: RegiaoViva;
  temDesfazerPendente: () => boolean;
  alvoDoFoco: () => Focavel | null | undefined;
  alternativaDoFoco: () => Focavel | null | undefined;
  /** [MÉDIO #5, rodada 7] quem manda na confirmação é o painel (uma por vez). */
  confirmando: boolean;
  /**
   * [MÉDIO #3, rodada 9] TRÊS portas distintas para três coisas distintas —
   * pedir, desistir e executar. Na rodada 8 havia uma só (`aoConfirmar(id |
   * null)`), e o caminho que APAGAVA chamava `aoConfirmar(null)`: a mesma
   * porta do cancelamento, com a mesma frase de cancelamento.
   */
  aoPedirConfirmacao: (id: string) => void;
  aoCancelarConfirmacao: () => void;
  aoConfirmarExecutado: () => void;
  aoExcluir: (nota: TaskNote, texto: string) => void;
}): JSX.Element {
  const porta = usarPortaDeEscrita({
    op: "nota_excluir",
    regiao,
    alvo: alvoDoFoco,
    alternativa: alternativaDoFoco,
    // [BAIXO #8, rodada 7] já havia um desfazer pendente? Ele acabou de ser
    // atropelado — e some sem aviso. A frase entra JUNTO com "Excluída.",
    // numa string só: duas chamadas de anúncio no mesmo manipulador viram um
    // render só e a primeira nunca chega ao DOM (medido).
    texto: () => anuncioComDesfazerPerdido("nota_excluir", temDesfazerPendente()),
    // O sucesso é dito na região do DESFAZER, colado ao botão que ele explica.
    anunciarSucesso: (t) => {
      aoExcluir(nota, t);
    },
  });

  function excluir(): void {
    if (confirmando) {
      // [MÉDIO #3, rodada 9] o 2º clique sai da confirmação SEM anunciar
      // cancelamento — quem fala é o sucesso da exclusão.
      // [CRÍTICO #1/#2, varredura de gêmeos, rodada 13] A SAÍDA DA CONFIRMAÇÃO
      // também é estado, e também só acontece depois do veredito: com uma
      // gravação em voo a porta recusa ("Aguarde…") e o 2º clique NÃO apaga —
      // sair da confirmação ali deixava a linha de volta em "excluir", como se
      // o clique tivesse sido cancelado, e o operador tinha de recomeçar os
      // dois cliques sem nada explicar por quê.
      if (porta.escrever({ id: nota.id, task_id: taskId }) === "gravar") aoConfirmarExecutado();
      return;
    }
    // [MÉDIO #5, rodada 7] 1º clique: sem `setTimeout`, o pedido fica até
    // Escape, até o foco sair, ou até outra ação começar. `valido: false`
    // faz a porta NUNCA gravar aqui (e a recusa por validade desta operação é
    // silenciosa por desenho); o que ela ainda faz é falar quando há uma
    // gravação em voo — a única recusa que precisa de voz neste clique.
    if (porta.escrever({ id: nota.id, task_id: taskId }, { valido: false }) === "aguardar") return;
    aoPedirConfirmacao(nota.id);
  }

  return (
    <li className="rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="flex items-start justify-between gap-2">
        {/*
          [ALTO #5, rodada 13] `min-w-0` + `break-words`: um item de flex nasce
          com `min-width: auto`, então ele se recusa a ficar menor que a
          palavra mais longa que contém. Um e-mail dentro da nota
          (`lucas.scudeler@pandoratreinamentos.com.br`) empurrava a linha
          inteira e o `<li>` estourava a viewport — medido a 390 px:
          `scrollWidth` 435 contra `clientWidth` 390, e quem saía da tela era
          justamente o botão "excluir" DESTA nota (borda direita em 435 px), a
          única forma de apagá-la. Um SHA de 40 caracteres dava 459; um token
          de 64, 632.

          [MÉDIO #9, rodada 13] `whitespace-pre-line`: o banco guarda
          `"linha um\nlinha dois\n\n- item a\n- item b"` e a tela devolvia
          tudo numa frase corrida (uma linha de 23 px de altura, medida no
          Chromium) — uma lista de 4 itens virava parágrafo. `pre-line`
          preserva a quebra que o operador digitou e continua quebrando o
          texto longo sozinho, ao contrário de `pre`.
        */}
        <p className="min-w-0 whitespace-pre-line break-words text-sm leading-relaxed text-bone-100">
          {nota.texto}
        </p>
        <button
          ref={refDoBotao}
          type="button"
          onClick={excluir}
          // [MÉDIO #5, rodada 7] as duas saídas da confirmação que não são o
          // 2º clique: Escape, e o foco deixar o botão. Nenhum relógio.
          onKeyDown={(e) => {
            if (e.key === "Escape" && confirmando) {
              e.preventDefault();
              aoCancelarConfirmacao();
            }
          }}
          onBlur={() => {
            if (confirmando) aoCancelarConfirmacao();
          }}
          aria-busy={porta.pendente ? true : undefined}
          aria-disabled={porta.pendente ? true : undefined}
          // [MÉDIO #6, rodada 7] cada linha diz QUAL nota ela apaga.
          aria-label={rotuloDoBotaoDeExcluir(nota, indice, total, confirmando)}
          className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md px-2 text-xs font-semibold ${
            porta.pendente ? "opacity-50" : ""
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
        {/* [MÉDIO #4, rodada 12] `agora` vem do servidor: o texto é o mesmo
            no HTML e na hidratação, por mais tarde que ela aconteça. */}
        {nota.autor ?? "sem autor"} · <time dateTime={nota.createdAt}>
          {formatRelativeTime(nota.createdAt, agora)}
        </time>
      </p>
      <CampoErro mensagem={porta.erroDoCampo} />
    </li>
  );
}

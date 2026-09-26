"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MutableRefObject,
} from "react";

import { CampoErro } from "@/components/task/campo-erro";
import { AvisoNaoSalvo, AVISO_COM_RASCUNHO } from "@/components/task/aviso-nao-salvo";
import { CampoNumerico } from "@/components/task/campo-numerico";
import { ControleSegmentado, type OpcaoSegmentada } from "@/components/task/controle-segmentado";
import {
  anuncioComDesfazerPerdido,
  MENSAGEM_INVALIDO,
  saidaPorConfirmacao,
  transicaoDeConfirmacao,
} from "@/components/task/escrita";
import type { Focavel } from "@/components/task/foco";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita, type RegiaoViva } from "@/components/task/porta-de-escrita";
import {
  CAMPOS_COM_RASCUNHO,
  gravarRascunho,
  lerRascunho,
} from "@/components/task/rascunho";
import type { EdgeTipo, TaskEdge } from "@/types/canonical";

const ROTULO_TIPO: Record<EdgeTipo, string> = {
  predecessor: "predecessor",
  correlacao: "correlação",
  sinergia: "sinergia",
  obsolescencia: "obsolescência",
};

const OPCOES_TIPO: readonly OpcaoSegmentada<EdgeTipo>[] = [
  { valor: "predecessor", rotulo: "predecessor" },
  { valor: "correlacao", rotulo: "correlação" },
  { valor: "sinergia", rotulo: "sinergia" },
  { valor: "obsolescencia", rotulo: "obsolescência" },
];

/** 10 s — mesma janela do "Desfazer" da nota excluída (`notas-painel.tsx`). */
const JANELA_DESFAZER_MS = 10_000;

export interface OpcaoTarefaRelacao {
  id: string;
  title: string;
  /**
   * [MÉDIO A6, rodada 11] Os tipos de relação que o SERVIDOR recusaria contra
   * esta candidata — porque já existe uma relação daquele tipo entre as duas,
   * ou porque um `predecessor` daqui para lá fecharia um ciclo. Prevenir
   * antes de avisar (F5 da régua): o `<select>` não oferece o que vai voltar
   * com erro. Calculado no servidor, em `page.tsx`, com a MESMA régua da
   * gravação.
   */
  bloqueadaPara: readonly EdgeTipo[];
}

/**
 * [ALTO A5, rodada 11] Um elo de precedência que o CRONOGRAMA usa e que esta
 * tela não consegue editar: ele nasce dos campos `predecessorIds`/
 * `successorIds` da própria tarefa, não de uma aresta. Antes esses elos
 * simplesmente não apareciam — o caminho crítico `task-setup → task-build →
 * task-deploy` era invisível na mesma tela que estampava "folga 0 · crítico".
 */
export interface EloDerivado {
  origem: string;
  destino: string;
}

export interface RelacoesPainelProps {
  taskId: string;
  /** Arestas em que esta tarefa é a ORIGEM (aponta para fora). */
  saindo: readonly TaskEdge[];
  /** Arestas em que esta tarefa é o DESTINO (apontam para cá). */
  entrando: readonly TaskEdge[];
  /** Os elos de precedência desta tarefa que não vêm de uma aresta (A5). */
  elosDerivados: readonly EloDerivado[];
  /** Candidatas a destino — o chamador já exclui a própria tarefa. */
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  tituloPorId: ReadonlyMap<string, string>;
}

/**
 * O payload que recria uma aresta idêntica (achado BAIXO #5, rodada 5).
 *
 * [CRÍTICO, rodada 12] `nota` ENTROU AQUI. Antes a janela guardava cinco
 * campos e a nota da relação não era um deles: `arestaAdd` lê `nota` de
 * `campos`, o campo não chegava, `textoOuNulo` devolvia `null` — e a relação
 * renascia SEM a nota, com a tela dizendo "Relação restaurada.". Medido no
 * Chromium em `/tarefa/task-docs`: a aresta `edge-docs-correlaciona-build`
 * voltou com `"nota": null` no lugar de *"Documentação e motor andam juntos,
 * sem ordem."*. O gêmeo em `notas-painel.tsx` já carregava texto, autor E
 * data — era a relação que esquecia um campo que o modelo (`TaskEdge.nota`),
 * a semente (as 6 arestas têm nota) e o servidor (`ARESTA_NOTA_MAX`) tratam
 * como dado de verdade. **Campo do modelo que o desfazer não carrega é campo
 * que o botão "Desfazer" apaga.**
 */
interface ArestaExcluida {
  origem: string;
  destino: string;
  tipo: EdgeTipo;
  peso: number;
  /** A nota da relação — `null` quando a relação não tinha nota. */
  nota: string | null;
  /** [MÉDIO #4, rodada 7] a data ORIGINAL — devolve a relação à sua posição. */
  criadoEm: string;
}

/**
 * [BAIXO #6, rodada 9] Texto e botão do "Desfazer" num valor só — ver a nota
 * gêmea em `notas-painel.tsx`. Um botão sem frase deixou de ser construível.
 */
interface JanelaDeDesfazerAresta {
  texto: string;
  aresta: ArestaExcluida;
}

interface JanelaDeDesfazerCriacao {
  texto: string;
  id: string;
}

/**
 * [MÉDIO #6, rodada 7] PURA — o nome acessível do "excluir" de UMA linha de
 * relação. Medido: o foco entregue depois de excluir aterrissava num botão
 * chamado só "excluir", idêntico em todas as linhas.
 */
export function rotuloDoBotaoDeExcluirRelacao(
  tipo: EdgeTipo,
  rotuloOutraPonta: string,
  indice: number,
  total: number,
  confirmando: boolean,
): string {
  // A posição entra pelo mesmo motivo da nota: duas relações do MESMO tipo
  // com a MESMA outra ponta existem (uma saindo, outra entrando) e teriam o
  // mesmo nome sem ela.
  const alvo =
    `a relação ${String(indice + 1)} de ${String(total)}, de ${ROTULO_TIPO[tipo]} ` +
    `com ${rotuloOutraPonta}`;
  return confirmando ? `confirmar exclusão d${alvo}` : `excluir ${alvo}`;
}

export function RelacoesPainel({
  taskId,
  saindo,
  entrando,
  elosDerivados,
  opcoesDestino,
  tituloPorId,
}: RelacoesPainelProps): JSX.Element {
  const selectDestinoRef = useRef<HTMLSelectElement | null>(null);
  const botaoAdicionarRef = useRef<HTMLButtonElement | null>(null);
  /** Botões "excluir" por índice — o alvo do foco quando a linha some. */
  const botoesExcluirRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const [desfazer, setDesfazer] = useState<JanelaDeDesfazerAresta | null>(null);
  const desfazerRef = useRef<JanelaDeDesfazerAresta | null>(null);
  desfazerRef.current = desfazer;
  /** [MÉDIO #5, rodada 7] uma linha em confirmação por painel — sem relógio. */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  function limparTimer(): void {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => limparTimer, []);

  const portaDesfazer = usarPortaDeEscrita({
    op: "relacao_desfazer_exclusao",
    alvo: () => selectDestinoRef.current,
    aoSucesso: () => {
      limparTimer();
      setDesfazer(null);
    },
    // [MÉDIO #1 + BAIXO #5, rodada 5] falha do desfazer nunca é silenciosa —
    // e a região do desfazer NÃO é apagada (BAIXO #6, rodada 9).
    textoDeFalha: () => "Não foi possível desfazer — a relação continua excluída.",
  });

  const regiaoDeAnuncios: RegiaoViva = {
    mensagem: portaDesfazer.mensagem,
    mostrar: (t, o) => {
      portaDesfazer.anunciar(t, o);
    },
    limpar: () => {
      portaDesfazer.limparAnuncio();
    },
  };

  const linhas = [
    ...saindo.map((e) => ({ aresta: e, direcao: "saindo" as const, outraPonta: e.destino })),
    ...entrando.map((e) => ({ aresta: e, direcao: "entrando" as const, outraPonta: e.origem })),
  ];

  function pedirConfirmacao(id: string): void {
    const t = transicaoDeConfirmacao("relacao_excluir", confirmandoId, id);
    if (t.anuncio !== null) regiaoDeAnuncios.mostrar(t.anuncio);
    setConfirmandoId(t.confirmandoId);
  }

  function cancelarConfirmacao(): void {
    const t = transicaoDeConfirmacao("relacao_excluir", confirmandoId, null);
    if (t.anuncio !== null) regiaoDeAnuncios.mostrar(t.anuncio);
    setConfirmandoId(t.confirmandoId);
  }

  /** [MÉDIO #3, rodada 9] o clique que APAGA sai da confirmação em silêncio. */
  function confirmacaoExecutada(): void {
    const t = saidaPorConfirmacao("relacao_excluir", confirmandoId);
    setConfirmandoId(t.confirmandoId);
  }

  function aoExcluirComSucesso(aresta: TaskEdge, texto: string): void {
    limparTimer();
    setDesfazer({
      texto,
      aresta: {
        origem: aresta.origem,
        destino: aresta.destino,
        tipo: aresta.tipo,
        peso: aresta.peso,
        nota: aresta.nota,
        criadoEm: aresta.createdAt,
      },
    });
    timerRef.current = window.setTimeout(() => {
      setDesfazer(null);
      if (
        typeof document !== "undefined" &&
        botaoDesfazerRef.current !== null &&
        document.activeElement === botaoDesfazerRef.current
      ) {
        selectDestinoRef.current?.focus();
      }
    }, JANELA_DESFAZER_MS);
  }

  function desfazerExclusao(): void {
    const janela = desfazerRef.current;
    if (janela === null) {
      // Sem janela não há o que restaurar. `valido: false` NUNCA grava; o que
      // a porta ainda faz neste clique é falar se houver gravação em voo.
      portaDesfazer.escrever({}, { valido: false });
      return;
    }
    const a = janela.aresta;
    const campos: Record<string, string> = {
      origem: a.origem,
      destino: a.destino,
      tipo: a.tipo,
      // [CRÍTICO, rodada 12] a nota volta junto — ver `ArestaExcluida`.
      nota: a.nota ?? "",
      // [MÉDIO #4, rodada 7] a data original volta junto (migration 0017) —
      // a lista de relações ordena por `created_at`, então a posição também.
      criado_em: a.criadoEm,
    };
    // [ALTO A2, rodada 11 + revisão da rodada 12] `peso` AUSENTE é o neutro 1;
    // `peso` VAZIO é recusa. `String(peso ?? "")` mandava a string vazia para
    // qualquer peso que não fosse um número — e o desfazer virava uma recusa
    // que o operador não pediu. Aqui só se manda o peso quando ele É um
    // número; do contrário o campo não vai, e o servidor usa o neutro.
    if (Number.isFinite(a.peso)) campos.peso = String(a.peso);
    const decisao = portaDesfazer.escrever(campos, { valido: true });
    /*
     * [ALTO #1, rodada 15] A QUARTA JANELA — a que o crítico não nomeou.
     *
     * O achado dele cobria três painéis; este é o quarto desfazer da página, no
     * mesmo arquivo e com o mesmo desenho, e fechar só os três nomeados seria a
     * 5ª forma viciada desta base ("confere o caso, não a classe"). Aqui a
     * aresta inteira — tipo, peso, nota e a data original — existe num lugar
     * só, `desfazer.aresta`, e o relógio de 10 s a descartava no meio da
     * chamada. O relógio para no despacho, como nos outros três.
     */
    if (decisao === "gravar") limparTimer();
  }

  return (
    <div className="space-y-3">
      {linhas.length === 0 && elosDerivados.length === 0 ? (
        <p className="text-sm text-bone-400">Nenhuma relação ainda.</p>
      ) : (
        <ul className="space-y-2">
          {linhas.map((linha, indice) => (
            <LinhaAresta
              key={linha.aresta.id}
              aresta={linha.aresta}
              taskId={taskId}
              indice={indice}
              total={linhas.length}
              direcao={linha.direcao}
              rotuloOutraPonta={tituloPorId.get(linha.outraPonta) ?? linha.outraPonta}
              outraPontaId={linha.outraPonta}
              refDoBotao={(el) => {
                if (el) botoesExcluirRef.current.set(indice, el);
                else botoesExcluirRef.current.delete(indice);
              }}
              regiao={regiaoDeAnuncios}
              temDesfazerPendente={() => desfazerRef.current !== null}
              alvoDoFoco={() => botoesExcluirRef.current.get(indice + 1)}
              alternativaDoFoco={() => selectDestinoRef.current}
              confirmando={confirmandoId === linha.aresta.id}
              aoPedirConfirmacao={pedirConfirmacao}
              aoCancelarConfirmacao={cancelarConfirmacao}
              aoConfirmarExecutado={confirmacaoExecutada}
              aoExcluir={aoExcluirComSucesso}
            />
          ))}
          {/* [ALTO A5] os elos que o CRONOGRAMA usa e esta tela não edita —
              visíveis, com o motivo escrito, em vez de ausentes. */}
          {elosDerivados.map((elo) => (
            <LinhaEloDerivado
              key={`derivado:${elo.origem}:${elo.destino}`}
              elo={elo}
              taskId={taskId}
              tituloPorId={tituloPorId}
            />
          ))}
        </ul>
      )}
      {/* Região viva do DESFAZER (nasce vazia no DOM): texto e botão saem do
          MESMO valor — nunca um sem o outro (BAIXO #6). */}
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
      {/* Região viva de ANÚNCIOS — separada da de cima desde a rodada 9
          (BAIXO #7: o pedido de confirmação era lido colado ao "Desfazer"). */}
      <MensagemSucesso mensagem={portaDesfazer.mensagem} />
      <CampoErro mensagem={portaDesfazer.erroDoCampo} />
      <FormularioNovaAresta
        taskId={taskId}
        opcoesDestino={opcoesDestino}
        selectDestinoRef={selectDestinoRef}
        botaoAdicionarRef={botaoAdicionarRef}
      />
    </div>
  );
}

/**
 * [ALTO A5, rodada 11] Uma linha SOMENTE-LEITURA: o elo existe no cronograma,
 * a tela mostra, e diz em português por que o botão "excluir" não está aqui.
 * Um elo invisível é pior do que um elo que a tela declara não editar — era
 * esse o achado.
 */
function LinhaEloDerivado({
  elo,
  taskId,
  tituloPorId,
}: {
  elo: EloDerivado;
  taskId: string;
  tituloPorId: ReadonlyMap<string, string>;
}): JSX.Element {
  const saindo = elo.origem === taskId;
  const outraPontaId = saindo ? elo.destino : elo.origem;
  const rotulo = tituloPorId.get(outraPontaId) ?? outraPontaId;
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-navy-700 bg-navy-850 p-3">
      <div className="min-w-0 flex-1">
        <span className="mr-2 rounded-full bg-navy-800 px-2 py-0.5 font-mono text-xs font-semibold text-bone-300">
          predecessor
        </span>
        <span className="text-xs text-bone-400">{saindo ? "→" : "←"}</span>{" "}
        <Link
          href={`/tarefa/${outraPontaId}`}
          prefetch={false}
          className="inline-flex min-h-[44px] items-center text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
        >
          {rotulo}
        </Link>
        <p className="mt-1 text-xs text-bone-400">
          O cronograma usa esta ordem, mas ela não se edita aqui: ela vem da lista de
          tarefas anteriores/seguintes da própria tarefa, e esta tela só edita relações
          criadas no formulário abaixo.
        </p>
      </div>
    </li>
  );
}

function LinhaAresta({
  aresta,
  taskId,
  indice,
  total,
  direcao,
  rotuloOutraPonta,
  outraPontaId,
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
  aresta: TaskEdge;
  taskId: string;
  indice: number;
  /** Quantas relações a lista tem — o "de 2" do rótulo (MÉDIO #6). */
  total: number;
  direcao: "saindo" | "entrando";
  rotuloOutraPonta: string;
  outraPontaId: string;
  refDoBotao: (el: HTMLButtonElement | null) => void;
  /** A região de ANÚNCIOS do painel — a linha some no sucesso. */
  regiao: RegiaoViva;
  temDesfazerPendente: () => boolean;
  alvoDoFoco: () => Focavel | null | undefined;
  alternativaDoFoco: () => Focavel | null | undefined;
  /** [MÉDIO #5, rodada 7] a confirmação é do painel: uma linha por vez. */
  confirmando: boolean;
  /** [MÉDIO #3, rodada 9] pedir, desistir e executar são portas distintas. */
  aoPedirConfirmacao: (id: string) => void;
  aoCancelarConfirmacao: () => void;
  aoConfirmarExecutado: () => void;
  aoExcluir: (aresta: TaskEdge, texto: string) => void;
}): JSX.Element {
  const porta = usarPortaDeEscrita({
    op: "relacao_excluir",
    regiao,
    alvo: alvoDoFoco,
    alternativa: alternativaDoFoco,
    // [BAIXO #8, rodada 7] numa frase só — ver `notas-painel.tsx`.
    texto: () => anuncioComDesfazerPerdido("relacao_excluir", temDesfazerPendente()),
    anunciarSucesso: (t) => {
      aoExcluir(aresta, t);
    },
  });

  function excluir(): void {
    if (confirmando) {
      // [CRÍTICO #1/#2, varredura de gêmeos, rodada 13] A SAÍDA DA CONFIRMAÇÃO
      // também é estado, e também só acontece depois do veredito: com uma
      // gravação em voo a porta recusa ("Aguarde…") e o 2º clique NÃO apaga —
      // sair da confirmação ali deixava a linha de volta em "excluir", como se
      // o clique tivesse sido cancelado, e o operador tinha de recomeçar os
      // dois cliques sem nada explicar por quê.
      if (porta.escrever({ id: aresta.id, task_id: taskId }) === "gravar") aoConfirmarExecutado();
      return;
    }
    // `valido: false` nunca grava; o que a porta ainda faz neste clique é
    // falar quando há gravação em voo (BAIXO #4, rodada 6).
    if (porta.escrever({ id: aresta.id, task_id: taskId }, { valido: false }) === "aguardar") {
      return;
    }
    aoPedirConfirmacao(aresta.id);
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-navy-700 bg-navy-850 p-3">
      <div className="min-w-0 flex-1">
        <span className="mr-2 rounded-full bg-navy-800 px-2 py-0.5 font-mono text-xs font-semibold text-gold-300">
          {ROTULO_TIPO[aresta.tipo]}
        </span>
        <span className="text-xs text-bone-400">{direcao === "saindo" ? "→" : "←"}</span>{" "}
        <Link
          href={`/tarefa/${outraPontaId}`}
          prefetch={false}
          // [BAIXO #6, rodada 6] alvo de toque de 44 px sem quebrar a linha.
          // [ALTO #5, rodada 13] e o título da outra ponta quebra palavra —
          // no `<span>`, que é quem de fato contém o texto.
          className="inline-flex min-h-[44px] min-w-0 items-center text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
        >
          <span className="min-w-0 break-words">{rotuloOutraPonta}</span>
        </Link>
        {aresta.tipo === "sinergia" ? (
          <span className="ml-2 font-mono text-xs text-bone-400">desconto {aresta.peso}</span>
        ) : null}
        {/* [CRÍTICO, rodada 12] A NOTA DA RELAÇÃO, NA TELA. Ela existia no
            modelo, na semente e na validação do servidor, e não era
            desenhada em lugar nenhum do app — então o operador não tinha como
            perceber que o "Desfazer" a apagava. Mesmo tratamento que a nota
            da tarefa já recebe em `notas-painel.tsx`: o texto, em uma linha
            abaixo, sem enfeite. */}
        {aresta.nota !== null && aresta.nota.length > 0 ? (
          // [ALTO #5, rodada 13] a nota da relação nasceu na rodada 12 sem
          // quebra de palavra — mesmo e-mail, mesmo estouro.
          <p className="mt-1 whitespace-pre-line break-words text-xs text-bone-400">{aresta.nota}</p>
        ) : null}
      </div>
      <button
        ref={refDoBotao}
        type="button"
        onClick={excluir}
        // [MÉDIO #5, rodada 7] Escape e a saída do foco cancelam — sem relógio.
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
        // [MÉDIO #6, rodada 7] cada linha diz QUAL relação ela apaga.
        aria-label={rotuloDoBotaoDeExcluirRelacao(
          aresta.tipo,
          rotuloOutraPonta,
          indice,
          total,
          confirmando,
        )}
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
      <CampoErro mensagem={porta.erroDoCampo} />
    </li>
  );
}

function FormularioNovaAresta({
  taskId,
  opcoesDestino,
  selectDestinoRef,
  botaoAdicionarRef,
}: {
  taskId: string;
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  selectDestinoRef: MutableRefObject<HTMLSelectElement | null>;
  botaoAdicionarRef: MutableRefObject<HTMLButtonElement | null>;
}): JSX.Element {
  // [MÉDIO #3, rodada 4] começa VAZIO — antes, o `<select>` nascia com a 1ª
  // opção já selecionada e o botão já `enabled`: um único clique cego criava
  // uma aresta de verdade contra a 1ª tarefa da lista.
  const [destino, setDestino] = useState("");
  const [tipo, setTipo] = useState<EdgeTipo>("predecessor");
  /**
   * [MÉDIO A6, rodada 11] AS CANDIDATAS QUE ESTE TIPO ACEITA. O `<select>`
   * oferecia as que o servidor recusaria — escolher uma ia à rede e voltava
   * com "Essa aresta criaria um ciclo de dependências" ou "Já existe uma
   * aresta desse tipo…". A régua pede prevenir antes de avisar: a lista não
   * mostra o que não dá, e uma linha embaixo diz quantas ficaram de fora e
   * por quê (sumir em silêncio seria o outro defeito).
   */
  const disponiveis = opcoesDestino.filter((o) => !o.bloqueadaPara.includes(tipo));
  const ocultas = opcoesDestino.length - disponiveis.length;
  const [peso, setPeso] = useState("0.5");
  /**
   * [BAIXO #12, rodada 13] A NOTA DA RELAÇÃO GANHA ONDE SER ESCRITA.
   *
   * A rodada 12 pôs a nota na lista e o servidor sempre a validou
   * (`ARESTA_NOTA_MAX`), mas nenhuma relação criada pela tela podia ter uma:
   * não havia campo. Um dado que o modelo guarda, a semente traz e o
   * "Desfazer" restaura, e que a tela só sabia ler.
   */
  const [nota, setNota] = useState("");
  const [criada, setCriada] = useState<JanelaDeDesfazerCriacao | null>(null);
  /**
   * [MÉDIO #1, rodada 14] O RASCUNHO CHEGA AOS DOIS CAMPOS DESTE FORMULÁRIO.
   * A "Nota da relação" nasceu na rodada 13 sem a proteção que a nota da tarefa
   * tem desde a rodada 5 — e cada linha da lista acima é um link para outra
   * tarefa. Restaurado no EFEITO: `sessionStorage` não existe no servidor.
   */
  useEffect(() => {
    const n = lerRascunho(taskId, CAMPOS_COM_RASCUNHO.relacaoNota);
    if (n.length > 0) setNota(n);
    const d = lerRascunho(taskId, CAMPOS_COM_RASCUNHO.relacaoDesconto);
    if (d.length > 0) setPeso(d);
  }, [taskId]);
  /**
   * [BAIXO #8, rodada 7] A verdade sobre "já existe um Desfazer pendente" no
   * instante em que o sucesso roda (depois do `await`) — o estado lido pela
   * closure seria o do render em que ela nasceu.
   */
  const criadaRef = useRef<JanelaDeDesfazerCriacao | null>(null);
  criadaRef.current = criada;
  const botaoDesfazerRef = useRef<HTMLButtonElement | null>(null);
  const desfazerTimeoutRef = useRef<number | null>(null);

  function limparDesfazer(): void {
    if (desfazerTimeoutRef.current !== null) window.clearTimeout(desfazerTimeoutRef.current);
    desfazerTimeoutRef.current = null;
  }

  useEffect(() => limparDesfazer, []);

  /**
   * [MÉDIO #1, rodada 5] O desfazer da CRIAÇÃO é uma porta própria, com o seu
   * `textoDeFalha`: a chamada pode falhar (rede caída, RPC recusando) e a tela
   * não pode seguir mostrando "Relação criada. Desfazer" como se nada tivesse
   * acontecido.
   */
  const portaDesfazerCriacao = usarPortaDeEscrita({
    op: "relacao_desfazer_criacao",
    // O "Desfazer" some agora: entrega o foco ao botão "Adicionar relação" —
    // e, se ele não aceitar (nó já fora da árvore), ao `<select>` de destino.
    alvo: () => botaoAdicionarRef.current,
    alternativa: () => selectDestinoRef.current,
    aoSucesso: () => {
      limparDesfazer();
      setCriada(null);
    },
    aoFalha: () => {
      limparDesfazer(); // não esconde o botão: o operador ainda vai querer tentar.
    },
    textoDeFalha: () => "Não foi possível desfazer — a relação continua.",
  });

  /** O `id` que o servidor devolveu — lido pelo anúncio, logo depois. */
  const idDoSucessoRef = useRef<string | null>(null);

  const porta = usarPortaDeEscrita({
    op: "relacao_criar",
    // [ALTO #1, rodada 6] o `<select>` de destino é o campo que ficou vazio —
    // e o botão "Adicionar relação" era o que virava `disabled` no instante do
    // sucesso, mandando o foco para o `<body>`.
    alvo: () => selectDestinoRef.current,
    alternativa: () => botaoAdicionarRef.current,
    regiao: {
      mensagem: portaDesfazerCriacao.mensagem,
      mostrar: (t, o) => {
        portaDesfazerCriacao.anunciar(t, o);
      },
      limpar: () => {
        portaDesfazerCriacao.limparAnuncio();
      },
    },
    // [BAIXO #8, rodada 7] havia um "Desfazer" pendente da criação anterior?
    // Ele acabou de ser substituído — a frase entra JUNTO, numa string só.
    texto: () => anuncioComDesfazerPerdido("relacao_criar", criadaRef.current !== null),
    antesDeGravar: () => {
      limparDesfazer();
      setCriada(null);
    },
    anunciarSucesso: (t) => {
      // `id` só falta se o backend (RPC live) não devolver — degrada de forma
      // graciosa: a relação foi criada (a lista ao lado já mostra), só sem
      // "Desfazer" nesta resposta específica. E aí o texto vai para a região
      // de anúncios, que some sozinha em 4 s, como os demais sucessos.
      const id = idDoSucessoRef.current;
      if (id === null) {
        portaDesfazerCriacao.anunciar(t);
        return;
      }
      setCriada({ texto: t, id });
      desfazerTimeoutRef.current = window.setTimeout(() => {
        setCriada(null);
        if (
          typeof document !== "undefined" &&
          botaoDesfazerRef.current !== null &&
          document.activeElement === botaoDesfazerRef.current
        ) {
          botaoAdicionarRef.current?.focus();
        }
      }, JANELA_DESFAZER_MS);
    },
    aoSucesso: (estado) => {
      // [ALTO #4, rodada 13] só esvazia a escolha se ela ainda for a que foi
      // enviada — trocar de destino durante a gravação não pode ser desfeito
      // pela resposta que chega depois.
      if (naCaixaRef.current === enviadoRef.current) setDestino("");
      if (naNotaRef.current === notaEnviadaRef.current) {
        setNota("");
        // O rascunho daquele campo sai junto — senão volta como fantasma.
        gravarRascunho(taskId, CAMPOS_COM_RASCUNHO.relacaoNota, "");
      }
      idDoSucessoRef.current =
        typeof estado.id === "string" && estado.id.length > 0 ? estado.id : null;
    },
  });

  /**
   * ════════════════════════════════════════════════════════ MÉDIO #7, rodada 13 ═
   * O `<select>` NÃO PODE MENTIR SOBRE O QUE VAI ENVIAR.
   *
   * `destino` é estado local; `disponiveis` vem do servidor e muda sozinho a
   * cada `router.refresh()` (toda escrita da página dispara um). Quando a
   * candidata escolhida deixava de estar disponível por causa de OUTRA escrita,
   * o `<select>` voltava a exibir "Escolha a tarefa…" — porque o valor não
   * casa com opção nenhuma —, mas `destino` continuava preenchido: a dica
   * sumia, `podeEnviar` seguia `true` e o botão disparava contra um alvo que a
   * tela não mostrava. A troca de TIPO já zerava o campo; a troca vinda do
   * servidor, não.
   *
   * Aqui o valor exibido, o valor enviado e a guarda saem do MESMO lugar: a
   * escolha só existe enquanto ela estiver na lista.
   */
  const destinoEfetivo = disponiveis.some((o) => o.id === destino) ? destino : "";
  const naCaixaRef = useRef(destinoEfetivo);
  naCaixaRef.current = destinoEfetivo;
  const enviadoRef = useRef<string | null>(null);
  const naNotaRef = useRef(nota);
  naNotaRef.current = nota;
  const notaEnviadaRef = useRef<string | null>(null);

  const podeEnviar = destinoEfetivo !== "";

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // [MÉDIO #3, rodada 4] a guarda que impede a aresta cega: sem destino
    // escolhido, NADA é criado. O que mudou na rodada 6 é que a recusa FALA,
    // em vez de um botão cinza que não responde.
    const campos: Record<string, string> = {
      origem: taskId,
      destino: destinoEfetivo,
      tipo,
    };
    if (tipo === "sinergia") campos.peso = peso;
    // [BAIXO #12, rodada 13] a nota da relação, quando há uma. Ausente é
    // diferente de vazia só no `peso`; para a nota, `textoOuNulo` no servidor
    // já trata vazio como "sem nota".
    if (nota.trim().length > 0) campos.nota = nota;
    const decisao = porta.escrever(campos, { valido: podeEnviar });
    if (decisao === "gravar") {
      enviadoRef.current = destinoEfetivo;
      notaEnviadaRef.current = nota;
    }
  }

  function desfazer(): void {
    const janela = criadaRef.current;
    const decisao = portaDesfazerCriacao.escrever(
      { id: janela?.id ?? "", task_id: taskId },
      { valido: janela !== null },
    );
    /*
     * ══════════════════════════════════════════════════════ ALTO #1, rodada 15 ═
     * O RELÓGIO DA JANELA PARA NO INSTANTE EM QUE O DESFAZER É DESPACHADO.
     *
     * O texto, o botão e o DADO A RESTAURAR saíam todos do mesmo valor, e o
     * `setTimeout(JANELA_DESFAZER_MS)` apagava esse valor sozinho aos 10 s —
     * inclusive com uma chamada de desfazer EM VOO. Medido pelo crítico da
     * rodada 15, com a rota segurando o POST 3 s e abortando, clique aos
     * 8,5 s: a tela dizia "Não foi possível desfazer…", havia ZERO botões de
     * Desfazer, e a nota do operador — cujo texto existia num lugar só — tinha
     * ido embora. O `aoFalha` que promete "não esconde o botão" chegava tarde:
     * não havia o que não esconder.
     *
     * A correção é uma linha e uma ordem: quem clica em Desfazer FECHA a
     * janela, e só depois a chamada parte. A partir daí o valor só sai da tela
     * por decisão — sucesso, ou uma limpeza/criação nova que o substitua.
     * Falhar deixa botão, texto e dado exatamente onde estavam.
     */
    if (decisao === "gravar") limparDesfazer();
  }

  if (opcoesDestino.length === 0) {
    return <p className="text-xs text-bone-400">Não há outra tarefa para relacionar.</p>;
  }

  return (
    // [ALTO #4, crítico 13/09] `noValidate`: o desconto (`peso`) tem
    // min/max/step nativos que disparariam validação em inglês do Chrome.
    //
    // [BAIXO #11, crítico 13/09, rodada 2] a ordem é a do preenchimento:
    // destino → tipo → (desconto, só sinergia) → botão.
    <form onSubmit={aoEnviar} noValidate className="space-y-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Destino
        <select
          ref={selectDestinoRef}
          // [MÉDIO #7] o que se vê é o que se envia — ver `destinoEfetivo`.
          value={destinoEfetivo}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setDestino(e.target.value);
            porta.aoMudarCampo();
          }}
          className="min-h-[44px] w-56 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        >
          <option value="">Escolha a tarefa…</option>
          {disponiveis.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      {ocultas > 0 ? (
        <p className="text-xs text-bone-400">
          {ocultas === 1
            ? "1 tarefa está fora desta lista"
            : `${String(ocultas)} tarefas estão fora desta lista`}
          : já existe uma relação deste tipo com ela, ou a ordem criaria um ciclo (A
          depende de B e B depende de A).
        </p>
      ) : null}
      <ControleSegmentado
        rotuloGrupo="Tipo de relação"
        opcoes={OPCOES_TIPO}
        valorAtual={tipo}
        // Trocar o tipo pode tirar da lista a tarefa que já estava escolhida
        // (um `predecessor` que fecharia ciclo, por exemplo). Nesse caso o
        // campo volta a "Escolha a tarefa…" em vez de ficar com um valor que
        // não está mais entre as opções — um `<select>` mentindo sobre o que
        // vai enviar.
        aoMudar={(novoTipo) => {
          setTipo(novoTipo);
          if (opcoesDestino.some((o) => o.id === destino && o.bloqueadaPara.includes(novoTipo))) {
            setDestino("");
          }
          porta.aoMudarCampo();
        }}
        desabilitado={porta.pendente}
      />
      {/* [BAIXO #12, rodada 13] a nota da relação — opcional, e a única
          adição de funcionalidade desta rodada. A lista já mostrava a nota
          (rodada 12) e o servidor já a validava; faltava onde escrevê-la. */}
      <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
        Nota da relação (opcional)
        <textarea
          value={nota}
          onChange={(e) => {
            setNota(e.target.value);
            porta.aoMudarCampo();
            gravarRascunho(taskId, CAMPOS_COM_RASCUNHO.relacaoNota, e.target.value);
          }}
          rows={2}
          placeholder="ex.: Documentação e motor andam juntos, sem ordem."
          className="w-full rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm font-normal text-bone-100 outline-none focus:border-gold-500"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        {tipo === "sinergia" ? (
          <>
          {/* [CRÍTICO + ALTO A2, rodada 11] aqui o estrago era o pior dos
             três: com `0.5e` na caixa o programa recebia `""` e gravava o
             DEFAULT `1` — o extremo oposto da escala — e isso entrava na
             conta do HIERARQ com a tela anunciando "Relação criada.". */}
          <CampoNumerico
            rotulo="Desconto (0–1 — quanto a sinergia barateia a outra tarefa)"
            descricaoId="relacao-desconto-nao-salvo"
            valor={peso}
            aoMudar={(texto) => {
              setPeso(texto);
              porta.aoMudarCampo();
              gravarRascunho(taskId, CAMPOS_COM_RASCUNHO.relacaoDesconto, texto);
            }}
            classeDoCampo="min-h-[44px] w-24 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
          />
          {/* [MÉDIO #1, rodada 15] o terceiro campo numérico da página. Ele
              guarda rascunho, e a frase diz isso — a régua derivada exige um
              aviso em TODO arquivo com `<CampoNumerico>`, para o quarto campo
              não nascer mudo. */}
          <AvisoNaoSalvo
            id="relacao-desconto-nao-salvo"
            mostrar={peso.trim().length > 0}
            texto={AVISO_COM_RASCUNHO}
          />
          </>
        ) : null}
        <button
          ref={botaoAdicionarRef}
          type="submit"
          // [ALTO #1, rodada 6] SEM `disabled` — nem por validade. Um botão que
          // vira `disabled` no instante do sucesso é desfocado pelo navegador,
          // e o foco cai no `<body>`. A guarda continua na porta, e ela fala.
          //
          // [MÉDIO #3, rodada 7] `aria-disabled` só enquanto grava.
          aria-busy={porta.pendente ? true : undefined}
          aria-disabled={porta.pendente ? true : undefined}
          aria-describedby={!podeEnviar ? "dica-nova-relacao" : undefined}
          className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 hover:border-gold-600 ${
            porta.pendente ? "opacity-50" : ""
          }`}
        >
          Adicionar relação
        </button>
      </div>
      {!podeEnviar ? (
        <p id="dica-nova-relacao" className="text-xs text-bone-400">
          {MENSAGEM_INVALIDO.relacao_criar}
        </p>
      ) : null}
      <CampoErro mensagem={porta.erroDoCampo} />
      {/* Região viva do DESFAZER da criação — texto e botão no mesmo valor. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          criada ? "text-xs font-medium text-state-done" : "m-0 min-h-0 text-xs text-state-done"
        }
      >
        {criada ? (
          <>
            {`${criada.texto} `}
            <button
              ref={botaoDesfazerRef}
              type="button"
              onClick={desfazer}
              aria-busy={portaDesfazerCriacao.pendente ? true : undefined}
              aria-disabled={portaDesfazerCriacao.pendente ? true : undefined}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 underline underline-offset-2 hover:text-gold-300 ${
                portaDesfazerCriacao.pendente ? "opacity-50" : ""
              }`}
            >
              Desfazer
            </button>
          </>
        ) : (
          ""
        )}
      </p>
      {/* Região de ANÚNCIOS deste formulário ("Relação desfeita.", recusas). */}
      <MensagemSucesso mensagem={portaDesfazerCriacao.mensagem} />
      <CampoErro mensagem={portaDesfazerCriacao.erroDoCampo} />
    </form>
  );
}

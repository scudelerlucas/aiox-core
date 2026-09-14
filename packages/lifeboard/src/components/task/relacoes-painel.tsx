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
}

export interface RelacoesPainelProps {
  taskId: string;
  /** Arestas em que esta tarefa é a ORIGEM (aponta para fora). */
  saindo: readonly TaskEdge[];
  /** Arestas em que esta tarefa é o DESTINO (apontam para cá). */
  entrando: readonly TaskEdge[];
  /** Candidatas a destino — o chamador já exclui a própria tarefa. */
  opcoesDestino: readonly OpcaoTarefaRelacao[];
  tituloPorId: ReadonlyMap<string, string>;
}

/** O payload que recria uma aresta idêntica (achado BAIXO #5, rodada 5). */
interface ArestaExcluida {
  origem: string;
  destino: string;
  tipo: EdgeTipo;
  peso: number;
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
    portaDesfazer.escrever(
      {
        origem: janela?.aresta.origem ?? "",
        destino: janela?.aresta.destino ?? "",
        tipo: janela?.aresta.tipo ?? "",
        peso: String(janela?.aresta.peso ?? ""),
        // [MÉDIO #4, rodada 7] a data original volta junto (migration 0017) —
        // a lista de relações ordena por `created_at`, então a posição também.
        criado_em: janela?.aresta.criadoEm ?? "",
      },
      { valido: janela !== null },
    );
  }

  return (
    <div className="space-y-3">
      {linhas.length === 0 ? (
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
      aoConfirmarExecutado();
      porta.escrever({ id: aresta.id, task_id: taskId });
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
          className="inline-flex min-h-[44px] items-center text-sm text-bone-100 underline-offset-2 hover:text-gold-300 hover:underline"
        >
          {rotuloOutraPonta}
        </Link>
        {aresta.tipo === "sinergia" ? (
          <span className="ml-2 font-mono text-xs text-bone-400">desconto {aresta.peso}</span>
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
  const [peso, setPeso] = useState("0.5");
  const [criada, setCriada] = useState<JanelaDeDesfazerCriacao | null>(null);
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
      setDestino("");
      idDoSucessoRef.current =
        typeof estado.id === "string" && estado.id.length > 0 ? estado.id : null;
    },
  });

  const podeEnviar = destino !== "";

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // [MÉDIO #3, rodada 4] a guarda que impede a aresta cega: sem destino
    // escolhido, NADA é criado. O que mudou na rodada 6 é que a recusa FALA,
    // em vez de um botão cinza que não responde.
    const campos: Record<string, string> = {
      origem: taskId,
      destino,
      tipo,
    };
    if (tipo === "sinergia") campos.peso = peso;
    porta.escrever(campos, { valido: podeEnviar });
  }

  function desfazer(): void {
    const janela = criadaRef.current;
    portaDesfazerCriacao.escrever(
      { id: janela?.id ?? "", task_id: taskId },
      { valido: janela !== null },
    );
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
          value={destino}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setDestino(e.target.value);
            porta.aoMudarCampo();
          }}
          className="min-h-[44px] w-56 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
        >
          <option value="">Escolha a tarefa…</option>
          {opcoesDestino.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <ControleSegmentado
        rotuloGrupo="Tipo de relação"
        opcoes={OPCOES_TIPO}
        valorAtual={tipo}
        aoMudar={setTipo}
        desabilitado={porta.pendente}
      />
      <div className="flex flex-wrap items-end gap-2">
        {tipo === "sinergia" ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-bone-300">
            Desconto (0–1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={peso}
              onChange={(e) => {
                setPeso(e.target.value);
                porta.aoMudarCampo();
              }}
              className="min-h-[44px] w-24 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
            />
          </label>
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

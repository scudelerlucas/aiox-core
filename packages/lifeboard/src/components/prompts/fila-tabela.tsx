"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  ajustarCustoPromptAction,
  cancelarPromptAction,
  type EstadoAcaoPrompt,
} from "@/app/prompts/actions";
import { AjustarCustoBotao, type EstadoDoAjuste } from "@/components/prompts/ajustar-custo-botao";
import { CancelarBotao } from "@/components/prompts/cancelar-botao";
import { EstadoFilaChip } from "@/components/prompts/estado-fila-chip";
import { MensagemDaFila } from "@/components/prompts/mensagem-da-fila";
import { useAcaoPrompt } from "@/components/prompts/usar-acao-prompt";
import { focarComAlternativa } from "@/components/task/foco";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { hojeNoFusoDoOperador } from "@/lib/fuso";
import type { ItemFilaPrompt } from "@/core/prompts/tipos";
import {
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  descricaoExecucao,
  formatarUsd,
  origemDoCusto,
  semSinal,
  textoOrigemDoCusto,
  textoSemAjuste,
} from "@/core/prompts/tipos";

const LIMITE_PREVIA = 90;

/**
 * O prompt chega TRUNCADO em 300 caracteres da RPC (D8) — `promptTamanho` diz
 * o tamanho real. A tabela mostra 90 caracteres; "ver tudo" abre o que veio, e
 * quando o original é maior que isso a linha diz quanto ficou de fora (em vez
 * de fingir que aquele é o prompt inteiro).
 */
function CelulaPrompt({ item }: { item: ItemFilaPrompt }): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const recebido = item.prompt;
  const truncadoNoBanco = item.promptTamanho > recebido.length;
  const precisaTruncar = recebido.length > LIMITE_PREVIA;

  if (!precisaTruncar && !truncadoNoBanco) {
    return <p className="text-xs text-bone-300">{recebido}</p>;
  }

  return (
    <div className="text-xs text-bone-300">
      <p>{aberto || !precisaTruncar ? recebido : `${recebido.slice(0, LIMITE_PREVIA)}…`}</p>
      {aberto && truncadoNoBanco ? (
        <p className="mt-1 text-[11px] text-bone-400">
          são {item.promptTamanho} caracteres no total; a tela mostra os {recebido.length} primeiros.
        </p>
      ) : null}
      {precisaTruncar ? (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="mt-1 min-h-[24px] text-[11px] font-medium text-gold-300 hover:underline"
        >
          {aberto ? "recolher" : "ver tudo"}
        </button>
      ) : null}
    </div>
  );
}

/** D7: a frase de vida do item em execução (ou o aviso de que ele emudeceu). */
function Execucao({ item, agora }: { item: ItemFilaPrompt; agora: number }): JSX.Element | null {
  const frase = descricaoExecucao(item, agora);
  if (!frase) return null;
  const mudo = semSinal(item, agora);
  return (
    <p className={`mt-0.5 text-[11px] ${mudo ? "text-state-blocked" : "text-bone-400"}`}>
      {frase}
      {item.tentativas > 1 ? ` · tentativa ${item.tentativas} de ${item.maxTentativas}` : ""}
    </p>
  );
}

function podeCancelar(item: ItemFilaPrompt): boolean {
  // D7: `pega` deixou de ser beco sem saída — o operador pode parar o que está
  // rodando, e o worker descobre pelo heartbeat.
  return item.estado === "na_fila" || item.estado === "pega";
}

/**
 * MÉDIO 6 (rodada 9): quanto o cancelamento DESTE item vai lançar no gasto de
 * hoje. Espelho literal de `fila_prompts_cancelar` (0019 §13, cláusula D12):
 * item que JÁ TEVE DONO — está em execução, ou voltou para a fila depois de
 * pelo menos uma tentativa — lança o custo estimado, limitado a 500. Item que
 * nunca foi pego não lança nada; item que já tem custo gravado também não.
 */
function custoAoCancelar(item: ItemFilaPrompt): number {
  const jaTeveDono = item.estado === "pega" || item.tentativas > 0;
  if (!jaTeveDono) return 0;
  if (item.custoUsd !== null) return 0;
  return Math.min(item.custoEstimadoUsd, 500);
}

/**
 * D20: só item cujo custo é ESTIMATIVA DA CASA ganha o botão de ajuste —
 * `falhou` por expiração ou `cancelada` em execução. MÉDIO 3 (rodada 5) + D25
 * (rodada 6): e só item FECHADO HOJE (o ajuste de um item de ontem era aceito
 * sem mover número nenhum, coroado com uma mensagem de sucesso).
 *
 * MÉDIO 4 (rodada 7): UMA exceção, testada dos dois lados (aqui e no banco) —
 * custo MEDIDO igual a ZERO também é ajustável. É o modo de falha conhecido: a
 * sessão fechou sem conseguir ler o usage. Zero não é medição; é a ausência
 * dela com cara de número, e sem esta porta o item ficava cravado em US$ 0,00
 * para sempre. Medido > 0 continua fechado, aqui e no `fila_prompts_ajustar_custo`.
 *
 * MÉDIO 4 (rodada 8): e o que o OPERADOR ajustou continua ajustável. O crítico
 * mediu a porta de mão única: 120 (estimativa) → ajustado para 3 → o segundo
 * ajuste, para 30, era recusado com "este foi medido" — culpando uma sessão
 * que nunca reportou nada. Quem decide agora é `custo_origem` (o banco grava
 * `operador` no ajuste), não o valor; e por isso ajustar para exatamente 0
 * deixou de ser a porta dos fundos que reabria tudo.
 */
export function podeAjustarCusto(item: ItemFilaPrompt, agora: number): boolean {
  const origem = origemDoCusto(item);
  if (origem !== "estimativa" && origem !== "medido-zero" && origem !== "ajustado") return false;
  if (item.estado !== "falhou" && item.estado !== "cancelada") return false;
  if (item.concluidoEm === null) return false;
  const dia = Date.parse(item.concluidoEm);
  if (Number.isNaN(dia)) return false;
  return hojeNoFusoDoOperador(new Date(dia)) === hojeNoFusoDoOperador(new Date(agora));
}

/**
 * D20 + MÉDIO 4 (rodada 7): a célula de custo diz DE ONDE o número veio — e
 * "medido pela sessão" é uma frase, não um silêncio.
 */
function CelulaCusto({ item }: { item: ItemFilaPrompt }): JSX.Element {
  if (item.custoUsd === null) return <span className="text-bone-500">—</span>;
  const origem = origemDoCusto(item);
  const nota = textoOrigemDoCusto(item);
  const atencao = origem === "estimativa" || origem === "medido-zero";
  return (
    <span className={atencao ? "text-state-progress" : undefined}>
      {formatarUsd(item.custoUsd)}
      {nota ? (
        <span
          className={`block text-[11px] ${atencao ? "text-state-progress" : "text-bone-400"}`}
        >
          {nota}
        </span>
      ) : null}
    </span>
  );
}

/**
 * D22 (rodada 5) + BAIXO 4 (rodada 5) + MÉDIO 3/BAIXO 10 (rodada 7): a linha é
 * a dona do estado.
 *
 * Medido, em três rodadas: toda ação chama `router.refresh()` no sucesso, o
 * item muda de estado e qualquer coisa guardada DENTRO do botão morre com ele —
 * primeiro morreu a frase da resposta (rodada 5), depois ela sobreviveu mas o
 * que o operador estava DIGITANDO não (rodada 6: abrir o ajuste em 390 px,
 * digitar, ir para 1280 px → painel fechado e campos vazios, porque a tabela e
 * o cartão são DUAS instâncias). Agora a linha guarda tudo: a resposta, o
 * painel aberto, o valor e o id de sessão — e os dois hooks de ação.
 *
 * BAIXO 10: e por isso existe UMA região `role="status"` por linha, no lugar
 * das 4 de antes (2 ações × 2 breakpoints).
 */
interface RespostasDaLinha {
  cancelar?: EstadoAcaoPrompt;
  ajustar?: EstadoAcaoPrompt;
  /** Qual das duas respondeu por último — é ela que a região viva mostra. */
  ultima?: "cancelar" | "ajustar";
}

const AJUSTE_VAZIO: EstadoDoAjuste = { aberto: false, valor: "", sessao: "" };

/**
 * O estado com que o painel de "ajustar custo" NASCE para um item.
 *
 * O valor de partida é o custo atual do item — e ele NÃO entra no mapa de
 * estados até o operador mexer, para o `router.refresh()` não sobrescrever o
 * que ele acabou de digitar.
 *
 * CRÍTICO 2 (rodada 12): a SESSÃO de partida é a que o item JÁ TEM. O campo
 * nascia vazio mesmo com sessão vinculada — e um campo de digitação livre que
 * nasce vazio convida a digitar outra coisa. Foi por essa porta que o crítico
 * mediu "um item de US$ 30 custando US$ 80 no dia": o ajuste trocava a sessão
 * e o dinheiro da antiga ficava sem dono. O banco já não deixa mais isso
 * acontecer (a fusão de entidade da migration 0027 §7 esvazia a entidade
 * antiga); aqui a tela para de PROPOR a troca.
 */
export function estadoInicialDoAjuste(item: ItemFilaPrompt): EstadoDoAjuste {
  return {
    ...AJUSTE_VAZIO,
    valor: item.custoUsd === null ? "" : item.custoUsd.toFixed(2),
    sessao: item.sessionId ?? "",
  };
}

function temTexto(estado: EstadoAcaoPrompt | undefined): boolean {
  return Boolean(estado && (estado.mensagem || estado.erro));
}

function AcoesDaLinha({
  item,
  agora,
  respostas,
  aoResponder,
  ajuste,
  aoMudarAjuste,
  confirmandoCancelar,
  aoMudarConfirmarCancelar,
}: {
  item: ItemFilaPrompt;
  agora: number;
  respostas: RespostasDaLinha | undefined;
  aoResponder: (id: string, qual: "cancelar" | "ajustar", estado: EstadoAcaoPrompt) => void;
  ajuste: EstadoDoAjuste;
  aoMudarAjuste: (id: string, patch: Partial<EstadoDoAjuste>) => void;
  /** BAIXO 2 (rodada 8): a confirmação de cancelar também mora na LINHA. */
  confirmandoCancelar: boolean;
  aoMudarConfirmarCancelar: (id: string, armado: boolean) => void;
}): JSX.Element {
  const mensagemRef = useRef<HTMLParagraphElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const [ultimaLocal, setUltimaLocal] = useState<"cancelar" | "ajustar" | null>(null);
  const [pedidoDeFocoCancelar, setPedidoDeFocoCancelar] = useState(0);
  const [pedidoDeFocoAjuste, setPedidoDeFocoAjuste] = useState(0);

  const ajustavel = podeAjustarCusto(item, agora);

  const acaoCancelar = useAcaoPrompt(
    cancelarPromptAction,
    () => setPedidoDeFocoCancelar((n) => n + 1),
    (estado) => {
      setUltimaLocal("cancelar");
      aoResponder(item.id, "cancelar", estado);
    },
  );
  const acaoAjustar = useAcaoPrompt(
    ajustarCustoPromptAction,
    () => {
      aoMudarAjuste(item.id, { aberto: false });
      setPedidoDeFocoAjuste((n) => n + 1);
    },
    (estado) => {
      setUltimaLocal("ajustar");
      aoResponder(item.id, "ajustar", estado);
    },
  );

  // BAIXO 3 (rodada 6, preservado): o `<button>` some do DOM com o foco nele.
  // O foco é ENTREGUE — para a região viva da linha (cancelar) ou para o
  // gatilho que reaparece, com a região como alternativa (ajuste). Nunca o
  // `<body>`. `ajustavel` está nas dependências de propósito: depois do
  // `router.refresh()` o item deixa de ser ajustável e o gatilho some.
  useEffect(() => {
    if (pedidoDeFocoCancelar === 0) return;
    focarComAlternativa(mensagemRef.current, caixaRef.current);
  }, [pedidoDeFocoCancelar]);
  useEffect(() => {
    if (pedidoDeFocoAjuste === 0) return;
    focarComAlternativa(gatilhoRef.current, mensagemRef.current);
  }, [pedidoDeFocoAjuste, ajustavel]);

  function dispararCancelar(id: string): void {
    const form = new FormData();
    form.set("id", id);
    acaoCancelar.disparar(form);
  }
  function dispararAjuste(id: string, custoUsd: string, sessionId: string): void {
    const form = new FormData();
    form.set("id", id);
    form.set("custo_usd", custoUsd);
    form.set("session_id", sessionId);
    acaoAjustar.disparar(form);
  }

  // A resposta compartilhada pela LINHA vence; o estado local só aparece antes
  // de o mapa ter sido escrito (primeiro render depois da ação, e a renderização
  // estática dos testes, que substituem o encanamento do hook).
  const doMapa = respostas?.ultima ? respostas[respostas.ultima] : undefined;
  const local =
    ultimaLocal === "ajustar"
      ? acaoAjustar.estado
      : ultimaLocal === "cancelar"
        ? acaoCancelar.estado
        : temTexto(acaoCancelar.estado)
          ? acaoCancelar.estado
          : acaoAjustar.estado;
  const visivel = doMapa ?? local;

  return (
    <div ref={caixaRef} tabIndex={-1} className="flex flex-col items-end gap-1 focus:outline-none">
      <CancelarBotao
        id={item.id}
        emExecucao={item.estado === "pega"}
        podeCancelar={podeCancelar(item)}
        custoAoCancelarUsd={custoAoCancelar(item)}
        pendente={acaoCancelar.pendente}
        confirmando={confirmandoCancelar}
        aoMudarConfirmando={aoMudarConfirmarCancelar}
        aoConfirmar={dispararCancelar}
      />
      <AjustarCustoBotao
        id={item.id}
        podeAjustar={ajustavel}
        pendente={acaoAjustar.pendente}
        estado={ajuste}
        aoMudarEstado={(patch) => aoMudarAjuste(item.id, patch)}
        aoSalvar={dispararAjuste}
        fraseSemAjuste={ajustavel ? null : textoSemAjuste(item)}
        refDaMensagem={mensagemRef}
        refDoGatilho={gatilhoRef}
      />
      <MensagemDaFila
        mensagem={visivel.mensagem}
        erro={visivel.erro}
        tom={visivel.tom}
        refDaMensagem={mensagemRef}
      />
    </div>
  );
}

/**
 * OS-LIFEBOARD · P7 — a tabela da fila: estado (com "sem sinal"), conta,
 * complexidade/modelo, prompt (prévia + "ver tudo"), idades, custo, link da
 * sessão e as ações. Mobile: vira lista de cartões (tabela larga rolando de
 * lado quebraria a régua de gutter ≥16px).
 */
export function FilaTabela({
  itens,
  agora,
  temMais,
  limiteAtual,
  proximoAntesDe,
  proximoAntesId,
  emPaginaSeguinte,
}: {
  itens: readonly ItemFilaPrompt[];
  agora: number;
  temMais?: boolean;
  limiteAtual?: number;
  /** D15: cursor `(criadoEm, id)` do último item desta página. */
  proximoAntesDe?: string | null;
  proximoAntesId?: string | null;
  /** D15: já estamos numa página seguinte (há um "voltar ao começo" a oferecer). */
  emPaginaSeguinte?: boolean;
}): JSX.Element {
  const [respostas, setRespostas] = useState<Record<string, RespostasDaLinha>>({});
  // MÉDIO 3 (rodada 7): o que o operador está DIGITANDO mora aqui — uma entrada
  // por id, lida pelas duas instâncias da linha (tabela e cartão).
  const [ajustes, setAjustes] = useState<Record<string, EstadoDoAjuste>>({});
  // BAIXO 2 (rodada 8): o MESMO defeito que MÉDIO 3 corrigiu para o ajuste,
  // uma linha abaixo e uma rodada depois — a confirmação de cancelar armada em
  // 390 px sumia ao ir para 1280 px, porque cada instância da linha guardava o
  // próprio `confirmando`. Agora ela mora aqui, com as outras.
  const [confirmandoCancelar, setConfirmandoCancelar] = useState<Record<string, boolean>>({});

  function registrarResposta(
    id: string,
    qual: "cancelar" | "ajustar",
    estado: EstadoAcaoPrompt,
  ): void {
    setRespostas((atual) => ({ ...atual, [id]: { ...atual[id], [qual]: estado, ultima: qual } }));
  }
  function mudarConfirmarCancelar(id: string, armado: boolean): void {
    setConfirmandoCancelar((atual) => ({ ...atual, [id]: armado }));
  }
  function mudarAjuste(id: string, patch: Partial<EstadoDoAjuste>): void {
    setAjustes((atual) => ({ ...atual, [id]: { ...(atual[id] ?? AJUSTE_VAZIO), ...patch } }));
  }
  function ajusteDe(item: ItemFilaPrompt): EstadoDoAjuste {
    const guardado = ajustes[item.id];
    if (guardado) return guardado;
    return estadoInicialDoAjuste(item);
  }

  const limite = limiteAtual ?? 50;
  // D15: o link do "mostrar mais" carrega o CURSOR, não um limite maior. Com
  // `?limite=` crescendo, uma fila de 205 itens tinha 5 inalcançáveis (a RPC
  // trava em 200); com cursor, cada clique abre os 50 seguintes, sem teto.
  const proxima =
    temMais === true && proximoAntesDe && proximoAntesId
      ? `/prompts?limite=${limite}&antes=${encodeURIComponent(proximoAntesDe)}&antesId=${encodeURIComponent(proximoAntesId)}`
      : null;

  if (itens.length === 0) {
    return (
      <div className="mt-4">
        <p className="rounded-lg border border-navy-700 bg-navy-850 px-4 py-6 text-center text-sm text-bone-400">
          {emPaginaSeguinte === true
            ? "Acabou a fila — não há itens mais antigos que este ponto."
            : "Nenhum prompt na fila ainda."}
        </p>
        {emPaginaSeguinte === true ? (
          <div className="mt-3 text-center">
            <Link
              href="/prompts"
              prefetch={false}
              className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
            >
              voltar ao começo da fila
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Desktop/tablet: tabela de verdade. */}
      <div className="hidden overflow-x-auto rounded-lg border border-navy-700 sm:block">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-700 bg-navy-900 text-xs uppercase tracking-wide text-bone-400">
              <th className="px-3 py-2">estado</th>
              <th className="px-3 py-2">conta</th>
              <th className="px-3 py-2">complexidade / modelo</th>
              <th className="px-3 py-2">prompt</th>
              <th className="px-3 py-2">criado</th>
              <th className="px-3 py-2">custo</th>
              <th className="px-3 py-2">sessão</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id} className="border-b border-navy-800 last:border-0">
                <td className="px-3 py-2.5 align-top">
                  <EstadoFilaChip estado={item.estado} semSinal={semSinal(item, agora)} />
                  <Execucao item={item} agora={agora} />
                  {item.motivoFalha ? (
                    <p className="mt-0.5 text-[11px] text-bone-400">{item.motivoFalha}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top text-bone-100">{ROTULO_CONTA[item.conta]}</td>
                <td className="px-3 py-2.5 align-top text-bone-300">
                  {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
                </td>
                <td className="max-w-[280px] px-3 py-2.5 align-top">
                  <CelulaPrompt item={item} />
                </td>
                <td className="px-3 py-2.5 align-top text-bone-400">
                  {formatRelativeTime(item.criadoEm, agora)}
                </td>
                <td className="px-3 py-2.5 align-top text-bone-300">
                  <CelulaCusto item={item} />
                </td>
                <td className="px-3 py-2.5 align-top">
                  {item.sessaoUrl ? (
                    <a
                      href={item.sessaoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-gold-300 hover:underline"
                    >
                      abrir
                    </a>
                  ) : (
                    <span className="text-bone-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top text-right">
                  <AcoesDaLinha
                    item={item}
                    agora={agora}
                    respostas={respostas[item.id]}
                    aoResponder={registrarResposta}
                    ajuste={ajusteDe(item)}
                    aoMudarAjuste={mudarAjuste}
                    confirmandoCancelar={confirmandoCancelar[item.id] === true}
                    aoMudarConfirmarCancelar={mudarConfirmarCancelar}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cartões (nada de tabela rolando de lado). */}
      <div className="flex flex-col gap-3 sm:hidden">
        {itens.map((item) => (
          <div key={item.id} className="rounded-lg border border-navy-700 bg-navy-850 p-3">
            <div className="flex items-center justify-between gap-2">
              <EstadoFilaChip estado={item.estado} semSinal={semSinal(item, agora)} />
              <span className="text-xs text-bone-400">{formatRelativeTime(item.criadoEm, agora)}</span>
            </div>
            <Execucao item={item} agora={agora} />
            {item.motivoFalha ? (
              <p className="mt-0.5 text-[11px] text-bone-400">{item.motivoFalha}</p>
            ) : null}
            <p className="mt-2 text-sm text-bone-100">{ROTULO_CONTA[item.conta]}</p>
            <p className="mt-0.5 text-xs text-bone-300">
              {ROTULO_COMPLEXIDADE[item.complexidade]} · {item.modeloSugerido}
            </p>
            <div className="mt-2">
              <CelulaPrompt item={item} />
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <p className="text-xs text-bone-400">
                {item.custoUsd !== null
                  ? `${formatarUsd(item.custoUsd)}${
                      textoOrigemDoCusto(item) ? ` (${textoOrigemDoCusto(item)})` : ""
                    }`
                  : "sem custo ainda"}
                {item.sessaoUrl ? (
                  <>
                    {" · "}
                    <a href={item.sessaoUrl} target="_blank" rel="noreferrer" className="text-gold-300 hover:underline">
                      abrir sessão
                    </a>
                  </>
                ) : null}
              </p>
              <AcoesDaLinha
                item={item}
                agora={agora}
                respostas={respostas[item.id]}
                aoResponder={registrarResposta}
                ajuste={ajusteDe(item)}
                aoMudarAjuste={mudarAjuste}
                confirmandoCancelar={confirmandoCancelar[item.id] === true}
                aoMudarConfirmarCancelar={mudarConfirmarCancelar}
              />
            </div>
          </div>
        ))}
      </div>

      {/* D15: "mostrar mais" anda com o CURSOR do último item desta página
          (link real, sem estado de cliente: a página é Server Component). */}
      {proxima !== null || emPaginaSeguinte === true ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {emPaginaSeguinte === true ? (
            <Link
              href="/prompts"
              prefetch={false}
              className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
            >
              voltar ao começo da fila
            </Link>
          ) : null}
          {proxima !== null ? (
            <Link
              href={proxima}
              prefetch={false}
              className="inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
            >
              mostrar mais {limite}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

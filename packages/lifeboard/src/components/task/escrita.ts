"use client";

import { useRef, useState } from "react";

import {
  OPERACOES_DE_ESCRITA,
  type EstadoAcaoTarefa,
  type OperacaoDeEscrita,
} from "@/app/tarefa/pedido";
import {
  documentoAtual,
  focarComAlternativa,
  type DocumentoComFoco,
  type Focavel,
} from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P6 — a LISTA das operações de escrita desta página, e o que
 * cada uma faz quando termina.
 *
 * [ALTO #1 + MÉDIO #2/#3/#4, rodada 6 do crítico] O padrão que ele nomeou:
 * "consertou os 5 caminhos que mediu e deixou os 3 gêmeos". A rodada 5
 * consertou o foco em 5 operações (desfazer, limpar átomos, excluir nota,
 * Enter no status, troca de mãe) e deixou intactas as 3 CRIAÇÕES — que
 * jogavam o foco no `<body>` por outro motivo: o botão tinha
 * `disabled={campo vazio}`, o `aoSucesso` esvaziava o campo, o botão virava
 * `disabled` NO INSTANTE DO SUCESSO e o navegador o desfocava.
 *
 * A resposta desta rodada não é consertar mais três casos: é parar de ter
 * casos. Toda escrita da página passa por DUAS funções deste arquivo —
 * `decidirEscrita` (antes de gravar) e `concluirEscrita` (depois do sucesso)
 * — e a lista `OPERACOES_DE_ESCRITA` abaixo é a fonte que o teste-varredura
 * percorre (`tests/unit/tarefa-escritas-varredura.test.ts`). Operação nova
 * que não entre nesta lista falha o teste; operação da lista cujo componente
 * não chame as duas funções também.
 */
export { OPERACOES_DE_ESCRITA };
export type { OperacaoDeEscrita };

/**
 * [MÉDIO #2, rodada 6] O que a região viva (`role="status"`) recebe quando a
 * operação dá certo. Salvar nota e adicionar subtarefa não anunciavam NADA —
 * as 8 regiões vivas da página existiam, e nenhuma pertencia aos dois
 * formulários de criação. Texto em português, frase inteira, sem jargão.
 *
 * [MÉDIO #4, rodada 7] `nota_desfazer`/`relacao_desfazer_exclusao` diziam
 * "(como nova)" porque a RPC não sabia recolocar a data. A migration 0017
 * ensinou (`criado_em` opcional em `nota_add`/`aresta_add`), a linha volta à
 * data e à posição originais, e a frase voltou a ser a verdade curta.
 */
export const ANUNCIO_DE_SUCESSO: Record<OperacaoDeEscrita, string> = {
  nota_criar: "Nota salva.",
  nota_excluir: "Excluída.",
  nota_desfazer: "Nota restaurada.",
  subtarefa_criar: "Subtarefa criada.",
  relacao_criar: "Relação criada.",
  relacao_excluir: "Excluída.",
  relacao_desfazer_criacao: "Relação desfeita.",
  relacao_desfazer_exclusao: "Relação restaurada.",
  status: "Status atualizado.",
  mae: "Tarefa mãe atualizada.",
  meta: "Meta atualizada.",
  duracao: "Duração salva.",
  atomos_salvar: "Átomos salvos.",
  atomos_limpar: "Átomos limpos.",
};

/**
 * [BAIXO #8, rodada 7] Duas exclusões seguidas e só a segunda tinha volta: a
 * janela da primeira era substituída EM SILÊNCIO (o `setExcluida` novo
 * atropelava o anterior). Quando um desfazer pendente é trocado por outro, a
 * região viva diz que o anterior acabou — quem não vê a tela não fica
 * esperando um botão que não existe mais.
 */
export const MENSAGEM_DESFAZER_PERDIDO = "A exclusão anterior não pode mais ser desfeita.";

/**
 * O texto que a região viva recebe quando um sucesso ATROPELA um desfazer
 * pendente — uma frase só, pelo mesmo motivo de `transicaoDeConfirmacao`:
 * dois `mostrar()` no mesmo manipulador viram um render só, e a primeira
 * frase morre antes de existir no DOM.
 */
export function anuncioComDesfazerPerdido(op: OperacaoDeEscrita, perdeu: boolean): string {
  return perdeu ? `${MENSAGEM_DESFAZER_PERDIDO} ${ANUNCIO_DE_SUCESSO[op]}` : ANUNCIO_DE_SUCESSO[op];
}

/**
 * [MÉDIO #5, rodada 7] A confirmação de exclusão era uma janela de 3 s,
 * silenciosa: medido, o rótulo voltou sozinho a "excluir" em 3061 ms com ZERO
 * anúncios, e um 2º Enter depois da janela só re-armava, também em silêncio.
 * O temporizador morreu; as DUAS transições falam.
 */
export const ANUNCIO_DE_CONFIRMACAO: Record<
  "nota_excluir" | "relacao_excluir",
  { entrou: string; saiu: string }
> = {
  nota_excluir: {
    entrou: "Confirme: clique de novo em excluir para apagar a nota.",
    saiu: "Exclusão cancelada — a nota continua.",
  },
  relacao_excluir: {
    entrou: "Confirme: clique de novo em excluir para apagar a relação.",
    saiu: "Exclusão cancelada — a relação continua.",
  },
};

/**
 * [BAIXO #4, rodada 6] Segunda edição enquanto a primeira ainda está em voo
 * era descartada EM SILÊNCIO (`if (pendente) return`). Agora a recusa fala.
 */
export const MENSAGEM_AGUARDE = "Aguarde: a gravação anterior ainda está em andamento.";

/**
 * [BAIXO, rodada 11] O TEXTO QUE FALTAVA DURANTE A GRAVAÇÃO.
 *
 * Medido: numa gravação de 2,5 s a tela mudava `aria-busy`, `aria-disabled` e
 * a opacidade do botão — e as regiões `role="status"` ficavam com ZERO texto.
 * Quem usa leitor de tela não recebe opacidade: só descobria que tinha
 * acontecido alguma coisa no fim, quando "Duração salva." chegava. Entre o
 * clique e a resposta havia silêncio.
 *
 * É `persistente` (sem relógio de 4 s): enquanto a gravação não volta, a
 * frase é verdade. Quem a apaga é a própria porta, no instante em que a
 * resposta chega — e é esse apagamento que também tirou da tela o par
 * contraditório *"Excluída. Desfazer"* + *"Confirme: clique de novo em
 * excluir…"*, que ficava 2,6 s junto porque o pedido de confirmação só sumia
 * por relógio.
 */
export const MENSAGEM_GRAVANDO = "Salvando…";

/**
 * [ALTO #1, rodada 6] O que substitui o `disabled` por validade: o botão
 * continua clicável (e focável — `disabled` é justamente o que tirava o foco
 * dele), o handler recusa, e ESTA frase explica por quê. Antes, um clique no
 * botão cinza não produzia nada, nem explicação.
 */
export const MENSAGEM_INVALIDO: Partial<Record<OperacaoDeEscrita, string>> = {
  nota_criar: "Escreva a nota antes de salvar.",
  subtarefa_criar: "Dê um título à subtarefa antes de adicionar.",
  relacao_criar: "Escolha a tarefa de destino antes de adicionar a relação.",
  atomos_salvar: "Escolha os três átomos antes de salvar.",
};

/**
 * [MÉDIO #3, rodada 6] 6 Enters no segmentado de status já selecionado
 * mandavam 6 POSTs idênticos. Gravar o que já está gravado não é salvar: é
 * gastar rede e arriscar um erro onde não havia nada a mudar. Quando o
 * controle é de SELEÇÃO (status, mãe, meta) a recusa é silenciosa — o que o
 * operador pediu já está na tela. Quando ele APERTOU um botão "salvar"
 * (duração, átomos), o silêncio seria um botão morto: a região viva responde.
 */
export const MENSAGEM_SEM_MUDANCA: Partial<Record<OperacaoDeEscrita, string>> = {
  duracao: "A duração já está salva assim — nada mudou.",
  atomos_salvar: "Os átomos já estão salvos assim — nada mudou.",
};

/**
 * [MÉDIO #5, rodada 7] PURA — a transição da confirmação de exclusão, com o
 * que ela ANUNCIA. Entrar e sair falam; entrar numa linha enquanto outra já
 * estava confirmando fala as duas coisas (a anterior saiu, a nova entrou).
 * Repetir o mesmo id não é transição e não anuncia nada.
 *
 * Existe como função para poder ser provada: a versão anterior era um
 * `setTimeout(…, 3000)` dentro do componente — o crítico mediu o rótulo
 * voltando sozinho a "excluir" em 3061 ms com ZERO anúncios, e um 2º Enter
 * depois da janela apenas re-armando, também em silêncio.
 */
export type MotivoDaSaida = "cancelou" | "confirmou";

export interface TransicaoDeConfirmacao {
  confirmandoId: string | null;
  anuncio: string | null;
}

export function transicaoDeConfirmacao(
  op: "nota_excluir" | "relacao_excluir",
  atual: string | null,
  proximo: string | null,
  /**
   * [MÉDIO #3, rodada 9] POR QUE a confirmação saiu. `"cancelou"` é o
   * caminho que DESISTE (Escape, foco fora, outra linha) e é o único que
   * pode dizer "Exclusão cancelada". `"confirmou"` é o 2º clique — o que
   * APAGA: a saída é real, mas a frase de cancelamento ali é falsa, e ficava
   * 1.240 ms sozinha na região viva antes de "Excluída." chegar (medido pelo
   * crítico com 1,2 s de latência de RPC).
   */
  motivo: MotivoDaSaida = "cancelou",
): TransicaoDeConfirmacao {
  if (atual === proximo) return { confirmandoId: atual, anuncio: null };
  const partes: string[] = [];
  if (atual !== null && motivo === "cancelou") partes.push(ANUNCIO_DE_CONFIRMACAO[op].saiu);
  if (proximo !== null) partes.push(ANUNCIO_DE_CONFIRMACAO[op].entrou);
  // UMA frase, não duas: dois `mostrar()` no mesmo manipulador viram um só
  // render (React agrupa), e a primeira frase nunca chegaria ao DOM — a
  // região viva anunciaria só a última. Medido na rodada 7, no navegador.
  return { confirmandoId: proximo, anuncio: partes.length === 0 ? null : partes.join(" ") };
}

/**
 * [MÉDIO #3, rodada 9] O 2º clique — o que apaga. Existe como função PRÓPRIA
 * (e não como `transicaoDeConfirmacao(..., null)`) porque o defeito nasceu
 * de os dois caminhos chamarem a MESMA porta: `aoConfirmar(null)` antes do
 * despacho parecia "sair da confirmação", e a porta, vendo `atual !== null`
 * e `proximo === null`, cumpria o seu contrato e anunciava o cancelamento.
 * Aqui a saída por confirmação é um estado distinto, e ele é MUDO — quem
 * fala é o sucesso da exclusão.
 */
export function saidaPorConfirmacao(
  op: "nota_excluir" | "relacao_excluir",
  atual: string | null,
): TransicaoDeConfirmacao {
  return transicaoDeConfirmacao(op, atual, null, "confirmou");
}

export type DecisaoDeEscrita = "gravar" | "aguardar" | "invalido" | "sem_mudanca";

/**
 * A ÚNICA porta de entrada de toda escrita da página. Ordem das recusas:
 *
 *  1. `pendente` — a gravação anterior ainda não voltou (a trava que antes
 *     morava no `disabled={pendente}`, e que era a causa medida do foco no
 *     `<body>`);
 *  2. `valido` — a regra de validade do formulário (nota vazia, subtarefa sem
 *     título, relação sem destino, átomos incompletos), que antes morava no
 *     `disabled={campo vazio}` — a causa medida das 3 CRIAÇÕES perderem o
 *     foco no instante do sucesso;
 *  3. `mudou` — o valor pedido é igual ao último CONFIRMADO pelo servidor.
 *
 * Pura de propósito: é o que dá para provar sem DOM (o repositório não tem
 * jsdom nem `@testing-library`, e instalar está proibido nesta rodada).
 */
export function decidirEscrita(params: {
  pendente: boolean;
  valido?: boolean;
  mudou?: boolean;
}): DecisaoDeEscrita {
  if (params.pendente) return "aguardar";
  if (params.valido === false) return "invalido";
  if (params.mudou === false) return "sem_mudanca";
  return "gravar";
}

/** A frase que a recusa devolve — `null` quando a recusa é (por desenho) silenciosa. */
export function mensagemDeRecusa(
  op: OperacaoDeEscrita,
  decisao: DecisaoDeEscrita,
): string | null {
  if (decisao === "aguardar") return MENSAGEM_AGUARDE;
  if (decisao === "invalido") return MENSAGEM_INVALIDO[op] ?? null;
  if (decisao === "sem_mudanca") return MENSAGEM_SEM_MUDANCA[op] ?? null;
  return null;
}

export interface SinaisDeEscrita {
  /** Região viva `role="status"` do próprio formulário (não interrompe o leitor de tela). */
  anunciar: (texto: string) => void;
  /** `role="alert"` ao lado do campo — para o que o operador precisa corrigir. */
  alertar: (texto: string) => void;
}

/**
 * Escreve a recusa onde ela é lida: erro de preenchimento vai para o alerta
 * (é uma correção a fazer); "aguarde" e "nada mudou" vão para a região viva
 * (são notícia, não erro).
 */
export function recusarEscrita(
  op: OperacaoDeEscrita,
  decisao: DecisaoDeEscrita,
  sinais: SinaisDeEscrita,
): void {
  const texto = mensagemDeRecusa(op, decisao);
  if (texto === null) return;
  if (decisao === "invalido") sinais.alertar(texto);
  else sinais.anunciar(texto);
}

/**
 * O fim de TODA escrita bem-sucedida: entrega o foco a um controle vivo e
 * anuncia o que aconteceu — nesta ordem, e antes de o `router.refresh()`
 * remontar a árvore.
 *
 * `alvo` é o controle onde o trabalho continua (o campo que ficou vazio numa
 * criação; a linha seguinte numa exclusão). `alternativa` é o plano B para
 * quando o alvo não aceita foco (saiu do DOM). Se os dois falharem o foco
 * fica onde estava — o que nunca é o `<body>`, porque nenhum controle desta
 * página vira `disabled` durante a gravação (ver `decidirEscrita`).
 */
export function concluirEscrita(
  op: OperacaoDeEscrita,
  alvo: Focavel | null | undefined,
  alternativa: Focavel | null | undefined,
  anunciar: (texto: string) => void,
  texto: string = ANUNCIO_DE_SUCESSO[op],
  /** Injetável só para o teste-varredura — em produção é sempre o `document`. */
  documento: DocumentoComFoco | null = documentoAtual(),
): void {
  focarComAlternativa(alvo, alternativa, documento);
  anunciar(texto);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * [ALTO #2, rodada 7] O ERRO VELHO DO SERVIDOR ENGOLIA A RECUSA NOVA.
 *
 * Os 4 formulários de criação escreviam `<CampoErro mensagem={estado.erro ??
 * aviso} />`. `estado.erro` só morre quando a ação SEGUINTE resolve, e
 * `aoDigitar` limpava `aviso`, não `estado.erro`. Medido pelo crítico: nota
 * de 10.001 caracteres → "A nota não pode passar de 10000 caracteres.";
 * esvaziar o campo e clicar → a tela CONTINUAVA na frase dos 10.000, em vez
 * de "Escreva a nota antes de salvar."; reescrever com 23 caracteres → a
 * frase dos 10.000 continuava lá. Mesmo defeito em subtarefa e em relação.
 *
 * A decisão: uma função PURA decide o que aparece, e ela tem duas leis —
 *  1. a recusa local (`aviso`) SEMPRE vence o erro antigo do servidor;
 *  2. mexer no campo DESCARTA o erro do servidor (não só o aviso).
 *
 * Pura de propósito: é o que dá para provar sem DOM (o repositório não tem
 * jsdom nem `@testing-library`). A sequência inteira do crítico roda contra
 * esta função em `tarefa-campo-de-erro.test.ts`, e de novo no navegador.
 */
export interface EntradaDoCampo {
  /** A recusa LOCAL desta tentativa (validade, "aguarde"). */
  aviso?: string;
  /** O que a última ação do servidor devolveu em `estado.erro`. */
  erroDoServidor?: string;
  /** O campo mudou desde que esse erro do servidor chegou? */
  descartado: boolean;
}

export function mensagemDoCampo({
  aviso,
  erroDoServidor,
  descartado,
}: EntradaDoCampo): string | undefined {
  // Lei 1 — a recusa local é sobre o que o operador acabou de fazer; o erro
  // do servidor é sobre uma tentativa que já passou. A nova sempre vence.
  if (aviso !== undefined && aviso.length > 0) return aviso;
  // Lei 2 — campo mexido, erro velho descartado.
  if (descartado) return undefined;
  if (erroDoServidor !== undefined && erroDoServidor.length > 0) return erroDoServidor;
  return undefined;
}

export interface CampoDeErro {
  /** O que o `<CampoErro>` do formulário deve mostrar AGORA. */
  mensagem: string | undefined;
  /** Chamar em toda mudança de campo: descarta aviso E erro do servidor. */
  aoMudarCampo: () => void;
  /** A recusa local desta tentativa (é o `alertar` de `SinaisDeEscrita`). */
  avisar: (texto: string) => void;
}

/**
 * A cola entre a função pura e o React. O "descartado" não pode ser um
 * booleano solto: o erro SEGUINTE do servidor precisa aparecer mesmo que o
 * texto seja idêntico ao descartado. Por isso o que se guarda é a IDENTIDADE
 * do objeto `estado` cujo erro já foi descartado — cada resposta de ação é um
 * objeto novo (`setEstado(resultado)` em `usar-acao-tarefa.ts`), então um
 * erro novo nunca nasce descartado.
 */
export function useCampoDeErro(estado: EstadoAcaoTarefa): CampoDeErro {
  const [aviso, setAviso] = useState<string | undefined>(undefined);
  const [estadoDescartado, setEstadoDescartado] = useState<EstadoAcaoTarefa | null>(null);
  // Só para não recriar as funções a cada render sem necessidade de memo.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const mensagem = mensagemDoCampo({
    aviso,
    erroDoServidor: estado.erro,
    descartado: estadoDescartado === estado,
  });

  return {
    mensagem,
    aoMudarCampo: (): void => {
      setAviso(undefined);
      setEstadoDescartado(estadoRef.current);
    },
    avisar: (texto: string): void => {
      setAviso(texto);
      // A recusa local também aposenta o erro velho: se o operador corrigir o
      // campo em seguida, não há erro de servidor esperando para ressurgir.
      setEstadoDescartado(estadoRef.current);
    },
  };
}

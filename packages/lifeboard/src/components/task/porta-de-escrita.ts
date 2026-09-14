"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type MutableRefObject } from "react";

import { escreverTarefaAction } from "@/app/tarefa/actions";
import type {
  EstadoAcaoTarefa,
  OperacaoDeEscrita,
  PedidoDeEscrita,
} from "@/app/tarefa/pedido";
import {
  concluirEscrita,
  decidirEscrita,
  recusarEscrita,
  useCampoDeErro,
  type DecisaoDeEscrita,
} from "@/components/task/escrita";
import type { Focavel } from "@/components/task/foco";
import { useMensagemSucesso } from "@/components/task/mensagem-sucesso";
import { executarAcaoTarefa } from "@/components/task/usar-acao-tarefa";
import { useAvisoDeSaida } from "@/components/task/usar-aviso-de-saida";

/**
 * OS-LIFEBOARD · P6 — A PORTA DE ESCRITA. Não é um lugar por onde a escrita
 * deve passar: é o único lugar de onde ela pode sair.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * [ALTO #1, rodada 9] POR QUE a garantia deixou de ser léxica.
 *
 * Até a rodada 8 a regra era "todo `disparar(form)` precisa estar dentro de
 * um handler com `decidirEscrita` e `concluirEscrita`", e quem conferia era
 * um scanner de texto. O crítico passou 7 de 12 formas de escrita por ele —
 * a decisiva (M8) citava a porta no handler e despachava cru: varredura
 * verde, 1126/1126 verdes, e a duração apagada no servidor em silêncio.
 *
 * Aqui a porta é o TRANSPORTE:
 *  - `escreverTarefaAction` só aceita `PedidoDeEscrita`, cujo selo é um
 *    `unique symbol` ambiente e não exportado (`pedido.ts`). A única fábrica
 *    é a função `selar` abaixo, PRIVADA deste módulo;
 *  - esta porta não devolve despacho cru: `escrever(campos)` já decide, já
 *    recusa com frase, já anuncia o sucesso e já entrega o foco. Um bloco que
 *    cite a porta sem usá-la não tem por onde escrever;
 *  - o `<CampoErro>` de quem usa a porta lê `erroDoCampo`, nunca `estado.erro`
 *    — a porta não expõe `estado` (ALTO #2: em 6 dos 10 sítios o erro velho
 *    do servidor engolia a recusa nova).
 *
 * A varredura derivada continua existindo como SEGUNDA rede
 * (`tests/unit/tarefa-varredura-derivada.ts`), agora sem os 4 buracos de
 * regex e cobrindo `src/` inteiro, `app/api/**` incluído.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * A única fábrica de `PedidoDeEscrita` do `src/`. Não é exportada: quem
 * quiser um pedido tem de passar por `usarPortaDeEscrita`.
 *
 * A conversão é inevitável (o selo é um símbolo ambiente — não existe em
 * runtime, e por isso nenhum objeto literal "tem" a chave). O que impede a
 * cópia é a segunda rede: nenhum outro arquivo de `src/` pode conter
 * `as unknown as PedidoDeEscrita`, e nenhum outro pode importar
 * `escreverTarefaAction`.
 */
function selar(op: OperacaoDeEscrita, campos: Record<string, string>): PedidoDeEscrita {
  return { op, campos: { ...campos } } as unknown as PedidoDeEscrita;
}

/** Onde um texto é dito. A porta escreve; o componente decide o recipiente. */
export interface RegiaoViva {
  mensagem: string | null;
  mostrar: (texto: string, opcoes?: { persistente?: boolean }) => void;
  limpar: () => void;
}

export interface GuardasDaEscrita {
  /** A regra de validade do formulário (campo vazio, trio incompleto…). */
  valido?: boolean;
  /** `false` = o valor pedido é igual ao último CONFIRMADO pelo servidor. */
  mudou?: boolean;
}

export interface ConfigDaPorta {
  /** Qual das 14 escritas da página é esta. Viaja até o servidor. */
  op: OperacaoDeEscrita;
  /** Para onde o foco vai quando a escrita dá certo (avaliado no sucesso). */
  alvo: () => Focavel | null | undefined;
  /** Plano B, quando o alvo não aceita foco (nó já fora da árvore). */
  alternativa?: () => Focavel | null | undefined;
  /**
   * Região viva das RECUSAS ("Aguarde…", "nada mudou"). Por padrão, a região
   * própria desta porta (`mensagem`); painéis passam a sua para falar num
   * lugar só.
   */
  regiao?: RegiaoViva;
  /**
   * Onde o SUCESSO é dito, quando não é na região das recusas — é o caso das
   * exclusões, cujo texto mora colado ao botão "Desfazer" (BAIXO #6/#7).
   */
  anunciarSucesso?: (texto: string) => void;
  /** O texto do sucesso, quando não é o padrão de `ANUNCIO_DE_SUCESSO`. */
  texto?: (estado: EstadoAcaoTarefa) => string;
  /** O texto fica até alguém limpar (janela de desfazer de 10 s). */
  persistente?: (estado: EstadoAcaoTarefa) => boolean;
  /** Efeitos do sucesso (esvaziar campo, abrir janela de desfazer…). */
  aoSucesso?: (estado: EstadoAcaoTarefa) => void;
  /** Efeitos imediatamente antes de gravar (fechar janelas, limpar timers). */
  antesDeGravar?: () => void;
  /** Efeitos da recusa do servidor (reverter controle otimista). */
  aoFalha?: (estado: EstadoAcaoTarefa) => void;
  /**
   * A frase do `role="alert"` quando o servidor recusa, quando ela não é o
   * `estado.erro` cru — é o caso do "Desfazer" que falhou.
   */
  textoDeFalha?: (estado: EstadoAcaoTarefa) => string;
  /**
   * [P2 do Codex, rodada 10] TRAVA DE VOO COMPARTILHADA entre portas irmãs.
   *
   * Duas portas sobre o MESMO dado (salvar átomos × limpar átomos) tinham cada
   * uma o seu `emVooRef`. Começada a gravação por uma, a outra só ficava
   * `aria-disabled` no visual: a porta dela continuava se achando ociosa e
   * despachava uma escrita conflitante. Com a latência de sempre, clicar os
   * dois botões em sequência fazia o valor final no banco depender da ordem
   * das respostas, e podia deixar o estado confirmado local inconsistente.
   *
   * Quando as portas irmãs recebem o MESMO ref, a trava vale para as duas — e
   * é um ref, não estado, porque a decisão acontece no clique, antes de
   * qualquer re-renderização. Sem isto, cada porta usa a sua.
   */
  travaDeVoo?: MutableRefObject<boolean>;
}

export interface PortaDeEscrita {
  /** Há gravação desta porta em voo? (para `aria-busy`/`aria-disabled`.) */
  pendente: boolean;
  /**
   * A ÚNICA forma de escrever nesta página. Decide, recusa com frase,
   * despacha, anuncia e entrega o foco — nesta ordem, sempre.
   */
  escrever: (campos: Record<string, string>, guardas?: GuardasDaEscrita) => DecisaoDeEscrita;
  /** O que o `<CampoErro>` deve mostrar AGORA (recusa nova > erro velho). */
  erroDoCampo: string | undefined;
  /** Chamar em toda mudança de campo: descarta a recusa E o erro do servidor. */
  aoMudarCampo: () => void;
  /** A região viva PRÓPRIA desta porta (vazia quando ela usa a de outro). */
  mensagem: string | null;
  /** Dizer algo nesta região sem escrever (transições de confirmação…). */
  anunciar: (texto: string, opcoes?: { persistente?: boolean }) => void;
  /** Apagar o texto da região própria. */
  limparAnuncio: () => void;
}

export function usarPortaDeEscrita(config: ConfigDaPorta): PortaDeEscrita {
  const [estado, setEstado] = useState<EstadoAcaoTarefa>({});
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  const propria = useMensagemSucesso();
  const campo = useCampoDeErro(estado);
  /**
   * [BAIXO #4, rodada 6] A verdade sobre "tem gravação em voo AGORA" — o ref,
   * não o estado. `pendente` (do `useTransition`) só vira `true` no render
   * SEGUINTE: dois cliques no MESMO tick veriam `false` os dois, e o segundo
   * seria engolido em silêncio.
   */
  // A trava PRÓPRIA existe sempre (a ordem dos hooks não pode variar); quando
  // a config traz uma compartilhada, é ela que vale — ver `travaDeVoo`.
  const emVooProprioRef = useRef(false);
  const emVooRef = config.travaDeVoo ?? emVooProprioRef;
  // A config muda a cada render (closures novas); o despacho lê a mais nova.
  const configRef = useRef(config);
  configRef.current = config;
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const regiao: RegiaoViva = config.regiao ?? propria;

  function escrever(campos: Record<string, string>, guardas?: GuardasDaEscrita): DecisaoDeEscrita {
    const atual = configRef.current;
    const decisao = decidirEscrita({
      pendente: pendente || emVooRef.current,
      valido: guardas?.valido,
      mudou: guardas?.mudou,
    });
    if (decisao !== "gravar") {
      recusarEscrita(atual.op, decisao, {
        anunciar: (t) => regiao.mostrar(t),
        alertar: campo.avisar,
      });
      return decisao;
    }
    campo.aoMudarCampo();
    atual.antesDeGravar?.();
    emVooRef.current = true;
    const pedido = selar(atual.op, campos);
    startTransition(() => {
      void (async () => {
        const r = await executarAcaoTarefa(escreverTarefaAction, estadoRef.current, pedido);
        // Libera ANTES dos callbacks: `aoFalha` pode querer disparar de novo
        // (é o caso do "Desfazer" que falhou e o operador reclica).
        emVooRef.current = false;
        setEstado(r);
        const c = configRef.current;
        if (r.ok === true) {
          // O texto é calculado ANTES de `aoSucesso` — quem decide a frase
          // costuma depender do estado que `aoSucesso` vai justamente mudar
          // (havia um "Desfazer" pendente? — BAIXO #8 da rodada 7).
          const texto = c.texto?.(r);
          const persistente = c.persistente?.(r) ?? false;
          c.aoSucesso?.(r);
          const onde = c.anunciarSucesso;
          concluirEscrita(
            c.op,
            c.alvo(),
            c.alternativa?.(),
            onde === undefined ? (t) => regiao.mostrar(t, { persistente }) : onde,
            texto,
          );
          // `revalidatePath` (na action) só marca a rota como stale — quem
          // pede a foto nova é o cliente.
          router.refresh();
        } else {
          c.aoFalha?.(r);
          const proprio = c.textoDeFalha?.(r);
          if (proprio !== undefined) campo.avisar(proprio);
        }
      })();
    });
    // O veredito volta para quem chamou poder fazer o OTIMISMO na ordem certa
    // (só mexer no controle quando a escrita de fato saiu). Não é um atalho
    // para escrever: não há despacho a obter aqui.
    return "gravar";
  }

  // [BAIXO #7, rodada 6] enquanto esta escrita não volta, uma navegação DURA
  // (F5, URL digitada, fechar a aba) leva a gravação embora — o navegador
  // pergunta antes. Vive aqui porque TODA escrita da página passa por esta
  // porta: nenhuma operação nova pode esquecer.
  useAvisoDeSaida(pendente);

  return {
    pendente,
    escrever,
    erroDoCampo: campo.mensagem,
    aoMudarCampo: campo.aoMudarCampo,
    mensagem: propria.mensagem,
    anunciar: (t, o) => propria.mostrar(t, o),
    limparAnuncio: () => propria.limpar(),
  };
}

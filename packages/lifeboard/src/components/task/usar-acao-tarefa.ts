"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { EstadoAcaoTarefa } from "@/app/tarefa/actions";
import { useAvisoDeSaida } from "@/components/task/usar-aviso-de-saida";

/**
 * OS-LIFEBOARD · P6 — equivalente a `useFormState`/`useActionState` para esta
 * árvore.
 *
 * O repositório fixa `react`/`react-dom` em 18.3.1 (checado antes de escrever
 * este arquivo: nenhum dos dois exporta `useFormState` nem `useActionState`
 * — os dois só existem a partir do 18.3 canary/19). O padrão pedido pela
 * spec ("erro em português perto do campo, nunca JSON", "useActionState/
 * useFormState") é reproduzido com `useState` + `useTransition`: o estado
 * anterior entra na chamada da Server Action (mesmo contrato de
 * `useFormState`), o retorno vira o novo estado, e `startTransition` dá o
 * `pending` sem bloquear a UI. `<form action={disparar}>` continua
 * funcionando (React aceita uma função qualquer, não só uma Server Action,
 * em `action`) — é só quem chama a Server Action que muda.
 *
 * Detalhe que custou um round de debug (smoke test com Playwright contra o
 * build de produção): chamar a Server Action IMPERATIVAMENTE — fora de um
 * `<form action={acaoDoServidor}>` literal — faz a mutação rodar de verdade
 * no servidor (o store/RPC grava, `revalidatePath` marca a rota como stale),
 * mas NÃO reidrata a árvore sozinho. `useFormState`/`useActionState` fariam
 * isso por baixo dos panos; sem eles, o cliente continuava mostrando a foto
 * antiga até este hook chamar `router.refresh()` explicitamente após um
 * sucesso.
 */
type AcaoServidor = (estado: EstadoAcaoTarefa, form: FormData) => Promise<EstadoAcaoTarefa>;

export interface AcaoTarefaControlada {
  estado: EstadoAcaoTarefa;
  pendente: boolean;
  disparar: (form: FormData) => void;
  /**
   * [BAIXO #4, rodada 6] A verdade sobre "tem gravação em voo AGORA" — o ref,
   * não o estado. `pendente` (do `useTransition`) só vira `true` no render
   * SEGUINTE: dois disparos no MESMO tick veriam `pendente === false` os
   * dois, e o segundo seria engolido lá dentro, em silêncio. Os handlers
   * perguntam `pendente || emVooAgora()` para poder DIZER que recusaram.
   */
  emVooAgora: () => boolean;
}

/**
 * O MIOLO da chamada, sem React — extraído na rodada 5 (achado MÉDIO #4: 8
 * dos 9 componentes de P6 não tinham teste, e a parte mais cara de errar
 * aqui — "falha de rede vira frase em português", "recusa do servidor chama
 * `aoFalha`" — só existia dentro de um hook, que sem jsdom não dá para
 * montar. Como função pura, ela é testável direto (`tarefa-acao-executar.test.ts`).
 *
 * Nunca lança: uma falha de REDE de verdade (o fetch da Server Action
 * rejeita) não devolve `{erro}` nenhum — sem este `catch` o `await` do
 * chamador estouraria, o controle otimista ficaria preso no valor recusado
 * e nenhum `aoFalha`/`router.refresh()` rodaria. Mensagem genérica em
 * português; nunca a stack nem o erro cru na tela.
 */
export async function executarAcaoTarefa(
  acao: AcaoServidor,
  estado: EstadoAcaoTarefa,
  form: FormData,
): Promise<EstadoAcaoTarefa> {
  try {
    return await acao(estado, form);
  } catch {
    return { erro: "Não foi possível salvar agora — tente de novo." };
  }
}

/**
 * `aoFalha` (achado MÉDIO #1, rodada 3 do crítico 13/09): chamado quando a
 * action devolve `{erro}` (`ok !== true`) — antes disto, um controle
 * otimista (`MaeForm`/`StatusForm`/`MetaForm`, que chamam `setValor(novo)`
 * ANTES do resultado da action) ficava mostrando o valor RECUSADO pelo
 * servidor: em `/tarefa/task-setup`, escolher uma mãe que criaria ciclo
 * mostrava o erro certo, mas o `<select>` continuava na mãe recusada — só
 * voltava ao valor real depois de um reload manual. Este callback devolve o
 * controle ao chamador para reverter o estado local ao último valor
 * CONFIRMADO (o que o servidor de fato aceitou), sem precisar de reload.
 */
export function useAcaoTarefa(
  acao: AcaoServidor,
  aoSucesso?: (estado: EstadoAcaoTarefa) => void,
  aoFalha?: (estado: EstadoAcaoTarefa) => void,
): AcaoTarefaControlada {
  const [estado, setEstado] = useState<EstadoAcaoTarefa>({});
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  /**
   * [MÉDIO #2, rodada 5] a proteção contra DUPLO ENVIO morava no
   * `disabled={pendente}` dos botões — e era justamente ele que jogava o
   * foco no `<body>` a cada operação (o navegador desfoca o elemento que
   * vira `disabled`). Os controles agora usam `aria-busy`/`aria-disabled`
   * (visíveis para leitor de tela, invisíveis para o gerenciador de foco) e
   * quem recusa o segundo disparo é esta trava — um ref, não o estado:
   * `pendente` do `useTransition` só vira `true` no render SEGUINTE, então
   * dois cliques no mesmo tick passariam por uma checagem de estado.
   */
  const emVooRef = useRef(false);

  function disparar(form: FormData): void {
    if (emVooRef.current) return; // clique repetido durante a gravação: ignorado.
    emVooRef.current = true;
    startTransition(() => {
      void (async () => {
        const resultado = await executarAcaoTarefa(acao, estado, form);
        // Libera ANTES dos callbacks: `aoFalha` pode querer disparar de novo
        // (é o caso do "Desfazer" que falhou e o operador reclica).
        emVooRef.current = false;
        setEstado(resultado);
        if (resultado.ok === true) {
          aoSucesso?.(resultado);
          // `revalidatePath` (na action) só marca a rota como stale — quem
          // pede a foto nova é o cliente. Sem isto a lista de notas/
          // subtarefas/relações fica visualmente presa no estado anterior
          // mesmo com a gravação certa no servidor.
          router.refresh();
        } else {
          // [MÉDIO #1, rodada 3] a action recusou (erro de validação, ciclo
          // de hierarquia, falha de rede) — o controle otimista precisa
          // voltar ao último valor CONFIRMADO; quem chama decide o que isso
          // significa (revert de `useState` local).
          aoFalha?.(resultado);
        }
      })();
    });
  }

  // [BAIXO #7, rodada 6] enquanto esta escrita não volta, uma navegação DURA
  // (F5, URL digitada, fechar a aba) leva a gravação embora — o navegador
  // pergunta antes. Vive aqui, e não em cada formulário, porque TODA escrita
  // da página passa por este hook: nenhuma operação nova pode esquecer.
  useAvisoDeSaida(pendente);

  return { estado, pendente, disparar, emVooAgora: () => emVooRef.current };
}

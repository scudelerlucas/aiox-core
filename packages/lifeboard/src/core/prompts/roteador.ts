/**
 * OS-LIFEBOARD · P7 — roteador de conta (função PURA, camada O).
 *
 * "Poder promptar soluções pelo painel na conta que tem mais tokens
 * disponíveis para a complexidade da tarefa" (pedido do operador) — mas a
 * cota restante de uma conta Max não é mensurável por nenhuma API (R1 do
 * mapa !4z 13/09). O roteador usa o INVERSO medido: a conta com MENOR
 * consumo hoje, entre as que ainda têm HEADROOM (teto − medido − reservado)
 * suficiente para o custo estimado da complexidade escolhida.
 *
 * Espelha em TypeScript a mesma regra que o RPC `fila_prompts_enfileirar`
 * aplica em SQL (`supabase/migrations/0009_lifeboard_v3_fila_ajustes.sql`) —
 * duas implementações porque rodam em runtimes diferentes (o banco decide de
 * verdade, atomicamente; esta função é o que a TELA mostra ANTES de enviar,
 * para o operador ver o "porquê" ao vivo enquanto digita).
 *
 * Achado ALTO #8 do crítico hostil (rodada de correção, 13/09/2026): a v1
 * filtrava só `consumo < teto`, ignorando a complexidade — uma conta a
 * US$149,99 de US$150 "cabia" para uma tarefa Fable de US$120. A v2 filtra
 * por HEADROOM ≥ custo estimado (`CUSTO_ESTIMADO_POR_COMPLEXIDADE`, mesma
 * tabela que o SQL lê de `painel_custo_estimado`) e soma `reservado` (tudo
 * que já está `na_fila`/`pega` para aquela conta) — sem isso, o card "conta
 * escolhida" não refletia o que o banco realmente aceitaria.
 *
 * DECISÃO (onde o pedido era ambíguo): em empate de consumo entre as 3
 * contas ELEGÍVEIS — o caso mais comum é 0,00 nas três, começo do dia — o
 * desempate cai para `lucasscudeler@gmail.com` por padrão (a conta-sede do
 * painel; o painel não roda "dentro" de nenhuma das 3, então "esta conta"
 * não tem um sentido único — ver `preferida` abaixo para outra escolha).
 */

import type { Complexidade, Conta, ModeloSugerido } from "@/core/prompts/tipos";
import { CONTAS, MODELO_POR_COMPLEXIDADE, custoEstimadoParaComplexidade } from "@/core/prompts/tipos";

export interface EscolhaDeConta {
  conta: Conta | null;
  /** Frase em português — o "porquê" que a tela mostra ao lado do modelo. */
  motivo: string;
  modeloSugerido: ModeloSugerido;
}

/**
 * @param consumos   consumo MEDIDO do dia (US$) por conta — proxy medido (T1), nunca a cota real.
 * @param tetos      teto diário (US$) por conta (`painel_teto_diario`).
 * @param complexidade define o modelo sugerido (tabela `model-routing.md`) e o custo estimado.
 * @param reservados soma do custo ESTIMADO de itens `na_fila`/`pega` por conta (achado CRÍTICO #1).
 * @param preferida  desempate em caso de consumo igual entre 2+ contas elegíveis.
 */
export function escolherConta(
  consumos: Readonly<Partial<Record<Conta, number>>>,
  tetos: Readonly<Partial<Record<Conta, number>>>,
  complexidade: Complexidade,
  reservados: Readonly<Partial<Record<Conta, number>>> = {},
  preferida: Conta = "lucasscudeler@gmail.com",
): EscolhaDeConta {
  const modeloSugerido = MODELO_POR_COMPLEXIDADE[complexidade];
  const custoEstimado = custoEstimadoParaComplexidade(complexidade);

  const todas = CONTAS.map((conta) => {
    const consumo = consumos[conta] ?? 0;
    const teto = tetos[conta] ?? 150;
    const reservado = reservados[conta] ?? 0;
    return { conta, consumo, teto, reservado, headroom: teto - consumo - reservado };
  });

  const candidatas = todas.filter((c) => c.headroom >= custoEstimado);

  if (candidatas.length === 0) {
    // Achado ALTO #8: motivo agora nomeia o headroom que falta, não só "bateu
    // o teto" — uma conta pode ter espaço sobrando e ainda assim não caber a
    // complexidade pedida.
    const maisProxima = todas.reduce((melhor, atual) =>
      atual.headroom > melhor.headroom ? atual : melhor,
    );
    const falta = custoEstimado - maisProxima.headroom;
    return {
      conta: null,
      motivo:
        `nenhuma conta tem US$ ${custoEstimado.toFixed(2)} livres para uma tarefa ${complexidade} — ` +
        `falta US$ ${falta.toFixed(2)} até na conta mais próxima`,
      modeloSugerido,
    };
  }

  const menorConsumo = Math.min(...candidatas.map((c) => c.consumo));
  const empatadas = candidatas.filter((c) => c.consumo === menorConsumo);
  // `candidatas` nunca é vazio aqui (retornou antes, acima) e `filter` sobre
  // o próprio mínimo sempre acha ao menos 1 — `empatadas[0]` é seguro, mas
  // `noUncheckedIndexedAccess` não sabe disso: guarda explícita.
  const primeiraEmpatada = empatadas[0];
  if (!primeiraEmpatada) {
    return {
      conta: null,
      motivo: `nenhuma conta tem US$ ${custoEstimado.toFixed(2)} livres para uma tarefa ${complexidade}`,
      modeloSugerido,
    };
  }

  if (empatadas.length === 1) {
    return {
      conta: primeiraEmpatada.conta,
      motivo:
        `menor consumo hoje (US$ ${primeiraEmpatada.consumo.toFixed(2)} de US$ ${primeiraEmpatada.teto.toFixed(2)}), ` +
        `US$ ${primeiraEmpatada.headroom.toFixed(2)} livres`,
      modeloSugerido,
    };
  }

  const daPreferida = empatadas.find((c) => c.conta === preferida);
  const escolhida = daPreferida ?? primeiraEmpatada;
  const outrasEmpatadas = empatadas
    .filter((c) => c.conta !== escolhida.conta)
    .map((c) => c.conta)
    .join(", ");

  return {
    conta: escolhida.conta,
    motivo: daPreferida
      ? `empate em US$ ${escolhida.consumo.toFixed(2)} com ${outrasEmpatadas} — desempate para esta conta`
      : `empate em US$ ${escolhida.consumo.toFixed(2)} entre ${empatadas.map((c) => c.conta).join(", ")}`,
    modeloSugerido,
  };
}

/** Esta conta tem headroom (teto − medido − reservado) para a complexidade dada? */
export function contaTemEspacoPara(
  consumo: { consumoHojeUsd: number; reservadoUsd: number; tetoUsd: number },
  complexidade: Complexidade,
): boolean {
  const headroom = consumo.tetoUsd - consumo.consumoHojeUsd - consumo.reservadoUsd;
  return headroom >= custoEstimadoParaComplexidade(complexidade);
}

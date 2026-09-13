/**
 * OS-LIFEBOARD · P7 — roteador de conta (função PURA, camada O).
 *
 * "Poder promptar soluções pelo painel na conta que tem mais tokens
 * disponíveis para a complexidade da tarefa" (pedido do operador) — mas a
 * cota restante de uma conta Max não é mensurável por nenhuma API (R1 do
 * mapa !4z 13/09). O roteador usa o INVERSO medido: a conta com MENOR
 * consumo hoje, entre as que ainda não bateram o próprio teto diário.
 *
 * Espelha em TypeScript a mesma regra que o RPC `fila_prompts_enfileirar`
 * aplica em SQL (supabase/migrations/0007_lifeboard_v3_fila_prompts.sql) —
 * duas implementações porque rodam em runtimes diferentes (o banco decide de
 * verdade, atomicamente; esta função é o que a TELA mostra ANTES de enviar,
 * para o operador ver o "porquê" ao vivo enquanto digita).
 *
 * DECISÃO (onde o pedido era ambíguo): em empate de consumo entre as 3
 * contas — o caso mais comum é 0,00 nas três, começo do dia — o desempate
 * cai para `lucasscudeler@gmail.com` por padrão (a conta-sede do painel; o
 * painel não roda "dentro" de nenhuma das 3, então "esta conta" não tem um
 * sentido único — ver `preferida` abaixo para outra escolha).
 */

import type { Complexidade, Conta, ModeloSugerido } from "@/core/prompts/tipos";
import { CONTAS, MODELO_POR_COMPLEXIDADE } from "@/core/prompts/tipos";

export interface EscolhaDeConta {
  conta: Conta | null;
  /** Frase em português — o "porquê" que a tela mostra ao lado do modelo. */
  motivo: string;
  modeloSugerido: ModeloSugerido;
}

/**
 * @param consumos   consumo do dia (US$) por conta — proxy medido (T1), nunca a cota real.
 * @param tetos      teto diário (US$) por conta (`painel_teto_diario`).
 * @param complexidade define o modelo sugerido (tabela `model-routing.md`).
 * @param preferida  desempate em caso de consumo igual entre 2+ contas elegíveis.
 */
export function escolherConta(
  consumos: Readonly<Partial<Record<Conta, number>>>,
  tetos: Readonly<Partial<Record<Conta, number>>>,
  complexidade: Complexidade,
  preferida: Conta = "lucasscudeler@gmail.com",
): EscolhaDeConta {
  const modeloSugerido = MODELO_POR_COMPLEXIDADE[complexidade];

  const candidatas = CONTAS.map((conta) => ({
    conta,
    consumo: consumos[conta] ?? 0,
    teto: tetos[conta] ?? 150,
  })).filter((c) => c.consumo < c.teto);

  if (candidatas.length === 0) {
    return {
      conta: null,
      motivo: "as 3 contas já bateram o teto diário hoje",
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
    return { conta: null, motivo: "as 3 contas já bateram o teto diário hoje", modeloSugerido };
  }

  if (empatadas.length === 1) {
    return {
      conta: primeiraEmpatada.conta,
      motivo: `menor consumo hoje (US$ ${primeiraEmpatada.consumo.toFixed(2)} de US$ ${primeiraEmpatada.teto.toFixed(2)})`,
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

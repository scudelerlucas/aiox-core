/**
 * OS-LIFEBOARD · P5b — Fuso do operador (achado ALTO #10 do crítico hostil).
 *
 * `hoje` computado com `new Date().toISOString().slice(0,10)` (UTC) troca de
 * dia cedo demais para quem está em America/Sao_Paulo (UTC-3): entre 21h00 e
 * 23h59 no relógio do operador, a data UTC já virou o dia seguinte — a linha
 * "hoje" do Gantt (e qualquer outro cálculo de "hoje" do app) ficava um dia à
 * frente do calendário real dele.
 *
 * `Intl`/`toLocaleDateString` com `timeZone` fazem a conversão certa sem
 * dependência nova. O locale `"sv"` (sueco) é o truque canônico para receber
 * `AAAA-MM-DD` direto — é a mesma ordem ISO, só sem depender de `Intl.
 * DateTimeFormat` com opções extras.
 */

export const FUSO_DO_OPERADOR = "America/Sao_Paulo";

/**
 * `AAAA-MM-DD` de `agora` (default: momento real) no fuso do operador — nunca
 * UTC cru. `agora` existe para teste determinístico (nunca `Date.now()`
 * escondido sem parâmetro no caller que precisa reproduzir um instante fixo).
 */
export function hojeNoFusoDoOperador(agora: Date = new Date()): string {
  return agora.toLocaleDateString("sv", { timeZone: FUSO_DO_OPERADOR });
}

/**
 * [ALTO 2, rodada 13] `AAAA-MM-DD` — o DIA DE CALENDÁRIO de um instante ISO no
 * fuso do operador. É a conversão única: quem precisa saber "em que dia isto
 * aconteceu" chama daqui, nunca `iso.slice(0, 10)`.
 *
 * Por que `slice` estava errado: `slice(0, 10)` de `2026-09-22T02:00:00.000Z`
 * devolve `2026-09-22` — a data em UTC. Em America/São Paulo (UTC−3) aquele
 * instante é 21/09 às 23h. O "hoje" da tela já vinha de
 * `hojeNoFusoDoOperador` (São Paulo); as datas dos itens vinham do corte em
 * UTC. Duas pontas da mesma tela, dois calendários: um PR criado às 23h de
 * 21/09 era desenhado começando em 22/09, à direita da faixa do "Hoje".
 * Medido em `painel_frentes_prs` (865 linhas de produção): 121 têm dia de
 * criação diferente entre UTC e São Paulo (14,0%) e 111, dia de merge.
 *
 * `AAAA-MM-DD` sem hora entra e sai IGUAL: não há instante para converter, e
 * convertê-lo seria inventar um fuso que ninguém declarou (`2026-09-22` lido
 * como meia-noite UTC e convertido para São Paulo viraria 21/09 — mudar um
 * dia de calendário que já estava dito). ISO ilegível devolve `null` e o
 * chamador decide; esta função nunca lança.
 */
export function diaNoFusoDoOperador(iso: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sv", { timeZone: FUSO_DO_OPERADOR });
}

/**
 * `dd/mm/aaaa` de um instante ISO, no fuso do operador — para NOMEAR coisas
 * ("a nota de Claude de 12/07/2026"), onde "há 67 dias" não distingue duas
 * linhas na mesma semana. `pt-BR` dá a ordem dia/mês/ano com zeros à
 * esquerda; ISO inválido devolve `null` (o chamador decide o que dizer).
 */
export function dataCurtaNoFusoDoOperador(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", {
    timeZone: FUSO_DO_OPERADOR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * [MÉDIO #4, rodada 7] A régua do `criado_em` que um DESFAZER manda junto —
 * o instante ORIGINAL da nota/relação que está voltando. Mesma lei da
 * migration 0017, adiantada aqui em português para não gastar a chamada de
 * rede: precisa ser uma data de verdade, e não pode estar no futuro
 * (restaurar é devolver ao passado, nunca inventar um instante à frente). Um
 * minuto de folga cobre a diferença de relógio entre o navegador e o banco.
 *
 * Vive aqui, e não em `app/tarefa/actions.ts`, por uma razão do Next: um
 * arquivo `"use server"` só pode exportar funções assíncronas — uma função
 * pura exportada de lá quebra o build. Aqui ela é exportável e testável.
 */
export function dataOriginalValidaOuErro(
  bruto: string,
  agora: number = Date.now(),
): { iso: string } | { erro: string } {
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return { erro: "A data original não é uma data válida." };
  if (d.getTime() > agora + 60_000) {
    return { erro: "A data original não pode estar no futuro." };
  }
  return { iso: d.toISOString() };
}

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

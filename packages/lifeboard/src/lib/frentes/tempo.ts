/**
 * PAINEL DE ASSUNTOS — o tempo, num só lugar.
 *
 * `ms` e `maisRecente` moravam em dois arquivos com a mesma conta feita duas
 * vezes; agora existe UMA implementação, importada por quem precisar. Todas as
 * datas da tela saem no fuso da casa (São Paulo), não em UTC.
 */

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** Fuso da casa: as datas na tela são as de São Paulo. */
export const FUSO = "America/Sao_Paulo";

/** ISO → milissegundos; nulo, vazio ou inválido vale 0. */
export function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const valor = Date.parse(iso);
  return Number.isNaN(valor) ? 0 : valor;
}

/** A mais recente entre várias datas (ignora nulos e inválidas). */
export function maisRecente(...isos: (string | null | undefined)[]): string | null {
  let melhor: string | null = null;
  let melhorMs = -Infinity;
  for (const iso of isos) {
    if (!iso) continue;
    const valor = ms(iso);
    if (valor <= melhorMs) continue;
    melhorMs = valor;
    melhor = iso;
  }
  return melhor;
}

/** "há 3 dias" / "há 2 h" / "agora mesmo". */
export function tempoRelativo(iso: string | null, now: number): string {
  if (!iso) return "sem data";
  const quando = Date.parse(iso);
  if (Number.isNaN(quando)) return "sem data";
  const dif = Math.max(0, now - quando);
  if (dif < 60_000) return "agora mesmo";
  if (dif < HORA) return `há ${Math.round(dif / 60_000)} min`;
  if (dif < DIA) return `há ${Math.round(dif / HORA)} h`;
  const dias = Math.round(dif / DIA);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

const FORMATO_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: FUSO,
});

/** "11/09" no fuso de São Paulo. */
export function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return FORMATO_CURTO.format(data);
}

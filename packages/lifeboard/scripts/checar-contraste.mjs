/**
 * Régua de contraste (UI/UX §3: "contraste ≥ 4,5:1, placeholder e ajuda contam").
 *
 * Lê os tokens de `tailwind.config.ts` e verifica cada par texto × fundo que a
 * interface realmente usa. Falha com código 1 se algum par cair abaixo de 4,5:1
 * (3:1 para o que é só borda/ícone decorativo, conforme WCAG 1.4.11).
 *
 * Rodar: `node scripts/checar-contraste.mjs`
 */
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("../tailwind.config.ts", import.meta.url), "utf8");

/** Extrai os hex do arquivo de tokens por nome-do-grupo + chave. */
function tokens() {
  const mapa = {};
  let grupo = null;
  for (const linha of fonte.split("\n")) {
    const g = linha.match(/^\s{8}(\w+): \{/);
    if (g) grupo = g[1];
    const c = linha.match(/^\s{10}"?([\w-]+)"?:\s*"(#[0-9A-Fa-f]{6})"/);
    if (c && grupo) mapa[`${grupo}-${c[1]}`] = c[2];
  }
  return mapa;
}

const T = tokens();

const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** [texto, fundo, mínimo, onde aparece] */
const PARES = [
  ["bone-100", "navy-950", 4.5, "texto principal sobre o fundo da app"],
  ["bone-100", "navy-900", 4.5, "texto principal sobre painel"],
  ["bone-100", "navy-850", 4.5, "título do cartão"],
  ["bone-100", "navy-800", 4.5, "título do cartão em hover"],
  ["bone-300", "navy-850", 4.5, "texto secundário do cartão"],
  ["bone-300", "navy-900", 4.5, "texto secundário do painel"],
  ["bone-400", "navy-950", 4.5, "texto terciário / ajuda"],
  ["bone-400", "navy-850", 4.5, "motivo da ordem no cartão"],
  ["gold-300", "navy-850", 4.5, "rótulo da ação"],
  ["gold-400", "navy-900", 4.5, "marca e destaque do 1º lugar"],
  ["state-open", "navy-850", 4.5, "chip 'aberta'"],
  ["state-progress", "navy-850", 4.5, "chip 'em progresso'"],
  ["state-blocked", "navy-850", 4.5, "chip 'bloqueada'"],
  ["state-done", "navy-850", 4.5, "chip 'concluída'"],
  ["state-error-fg", "navy-850", 4.5, "aviso de ciclo"],
  ["state-neutral", "navy-850", 4.5, "estado desconhecido"],
  ["fonte-calendar", "navy-850", 4.5, "rótulo da fonte Agenda"],
  ["fonte-gmail", "navy-850", 4.5, "rótulo da fonte Gmail"],
  ["fonte-drive", "navy-850", 4.5, "rótulo da fonte Drive"],
  ["fonte-notes", "navy-850", 4.5, "rótulo da fonte Notas"],
  ["fonte-chat", "navy-850", 4.5, "rótulo da fonte Chats"],
  ["fonte-lms", "navy-850", 4.5, "rótulo da fonte Cativa"],
  ["fonte-neutra", "navy-850", 4.5, "rótulo de fonte desconhecida"],
  ["navy-700", "navy-950", 3, "borda de cartão (só borda: 3:1)"],
  ["navy-600", "navy-850", 3, "borda forte (só borda: 3:1)"],
];

let falhou = 0;
const linhas = [];
for (const [t, f, min, onde] of PARES) {
  if (!T[t] || !T[f]) {
    console.error(`token ausente: ${t} ou ${f}`);
    falhou++;
    continue;
  }
  const r = razao(T[t], T[f]);
  const ok = r >= min;
  if (!ok) falhou++;
  linhas.push(
    `${ok ? "ok  " : "FALHA"} ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${t} sobre ${f}  — ${onde}`,
  );
}

console.log(linhas.join("\n"));
console.log(
  falhou === 0
    ? `\n${PARES.length} pares verificados, todos dentro da régua.`
    : `\n${falhou} par(es) abaixo da régua.`,
);
process.exit(falhou === 0 ? 0 : 1);

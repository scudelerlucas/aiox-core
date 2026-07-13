#!/usr/bin/env node
/**
 * Espelha docs/arsenal/*.md deste repo para os repos IRMÃOS.
 * Vínculo permanente entre Lucas-Contexto-Geral, quiz-diagnosys e aiox-core:
 * editou o arsenal em QUALQUER um → roda este script (via hook PostToolUse) e
 * os outros recebem a mesma versão. Copia só o que mudou (idempotente).
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { dirname, join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOS = ["Lucas-Contexto-Geral", "quiz-diagnosys", "aiox-core"];

// Quando roda como hook (PostToolUse), recebe o evento JSON no stdin. Só age se
// o arquivo tocado estiver em docs/arsenal — assim o hook pode disparar a cada
// edição sem custo. Rodado à mão (stdin é TTY), sempre espelha.
async function eventoDoHook() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
const evt = await eventoDoHook();
if (evt) {
  const fp = String(
    evt?.tool_input?.file_path ?? evt?.tool_input?.filePath ?? "",
  );
  if (!fp.includes("/docs/arsenal/")) process.exit(0);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = dirname(repoRoot);
const self = basename(repoRoot);
const srcDir = join(repoRoot, "docs", "arsenal");

if (!existsSync(srcDir)) {
  console.log("[sync-arsenal] sem docs/arsenal aqui — nada a espelhar.");
  process.exit(0);
}

const arquivos = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
let mudou = 0;
for (const repo of REPOS) {
  if (repo === self) continue;
  const repoDir = join(parent, repo);
  if (!existsSync(repoDir)) continue; // repo não presente nesta máquina
  const destDir = join(repoDir, "docs", "arsenal");
  mkdirSync(destDir, { recursive: true });
  for (const f of arquivos) {
    const src = readFileSync(join(srcDir, f), "utf8");
    const destPath = join(destDir, f);
    const atual = existsSync(destPath) ? readFileSync(destPath, "utf8") : null;
    if (atual !== src) {
      writeFileSync(destPath, src);
      mudou++;
      console.log(`[sync-arsenal] → ${repo}/docs/arsenal/${f}`);
    }
  }
}
console.log(`[sync-arsenal] ${mudou} arquivo(s) espelhado(s) a partir de ${self}.`);

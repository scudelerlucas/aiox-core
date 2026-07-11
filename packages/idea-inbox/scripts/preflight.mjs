#!/usr/bin/env node
// @ts-check
/**
 * Preflight de deploy: valida prontidao ANTES de disparar `vercel deploy`.
 * Falhas duras (arquivo/sintaxe/resolucao) -> exit 1. Avisos de seguranca
 * (secrets de webhook ausentes) nao bloqueiam, mas sao reportados.
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hard = [];
const warn = [];
const ok = [];

// 1) arquivos essenciais
for (const f of ["vercel.json", "api/health.mjs", "api/ingest.mjs", "api/webhook/telegram.mjs", "api/webhook/whatsapp.mjs", "src/pipeline-sync.mjs"]) {
  if (existsSync(join(root, f))) ok.push(`arquivo ${f}`);
  else hard.push(`arquivo ausente: ${f}`);
}

// 2) sintaxe de todos os .mjs de api/ e src/
for (const f of ["api/_core.mjs", "api/health.mjs", "api/ingest.mjs", "api/webhook/telegram.mjs", "api/webhook/whatsapp.mjs", "src/pipeline-sync.mjs"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  try {
    execFileSync(process.execPath, ["--check", p], { stdio: "pipe" });
    ok.push(`sintaxe ${f}`);
  } catch (e) {
    hard.push(`sintaxe invalida: ${f}`);
  }
}

// 3) dependencia idea-forge resolve
try {
  await import("@aiox/idea-forge");
  ok.push("@aiox/idea-forge resolve");
} catch {
  hard.push("@aiox/idea-forge nao resolve (rode `npm install` no workspace)");
}

// 4) secrets de webhook (seguranca — nao bloqueia)
if (!process.env.TELEGRAM_WEBHOOK_SECRET) warn.push("TELEGRAM_WEBHOOK_SECRET ausente: /webhook/telegram aceitara sem verificar assinatura (modo dev)");
if (!process.env.WHATSAPP_APP_SECRET) warn.push("WHATSAPP_APP_SECRET ausente: /webhook/whatsapp aceitara sem verificar HMAC (modo dev)");

// 5) auth de deploy
if (!process.env.VERCEL_TOKEN) warn.push("VERCEL_TOKEN ausente: `vercel deploy` exigira login interativo ou --token");

// relatorio
const line = (s) => console.log("  " + s);
console.log("\n🔎 Preflight idea-inbox\n");
console.log(`OK (${ok.length}):`);
ok.forEach((s) => line("✓ " + s));
if (warn.length) {
  console.log(`\nAvisos (${warn.length}):`);
  warn.forEach((s) => line("⚠ " + s));
}
if (hard.length) {
  console.log(`\nFalhas duras (${hard.length}):`);
  hard.forEach((s) => line("✗ " + s));
  console.log("\nResultado: NAO PRONTO\n");
  process.exit(1);
}
console.log(`\nResultado: PRONTO PARA DEPLOY${warn.length ? " (com avisos)" : ""}\n`);

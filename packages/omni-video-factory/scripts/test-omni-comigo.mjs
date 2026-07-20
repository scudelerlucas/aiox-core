#!/usr/bin/env node
/**
 * test-omni-comigo.mjs — PRIMEIRO TESTE do Google OMNI/Veo com a SUA foto.
 *
 * Pega 1 foto sua + um comando de texto e gera um vídeo curto seu (image-to-video)
 * via Gemini API. Zero dependências (Node >= 18 tem fetch nativo).
 *
 * ── COMO USAR ────────────────────────────────────────────────────────────────
 *   1) Pegue a chave em https://aistudio.google.com/apikey (com faturamento ativo).
 *   2) No terminal:
 *        export GEMINI_API_KEY="cole_sua_chave_aqui"
 *        node test-omni-comigo.mjs minha-foto.jpg "falando para a câmera, sorrindo, luz suave"
 *
 *   Flags opcionais:
 *        --ratio 9:16        (vertical, padrão) | 16:9 (YouTube) | 1:1
 *        --seconds 8         (duração, 4–8)
 *        --model veo-3.1-generate-preview   (padrão; troque p/ testar outro)
 *
 * Saída: um arquivo omni-comigo-<hora>.mp4 na pasta atual.
 *
 * Observações honestas:
 *  - Custa (Veo é pago por segundo de vídeo) — este teste gera ~1 clipe curto.
 *  - O Google tem trava de segurança para gerar pessoas reais a partir de foto;
 *    se vier erro de "person/safety", é política do Google, não bug do script.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extname, basename } from "node:path";

const API_BASE = process.env.OMNI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

main().catch((e) => { fail(e.message); });

async function main() {
  const { foto, prompt, ratio, seconds, model } = parseArgs(process.argv.slice(2));

  if (!KEY) fail('Sem chave. Rode:  export GEMINI_API_KEY="sua_chave"  (pegue em https://aistudio.google.com/apikey)');
  if (!foto) fail('Faltou a foto. Ex:  node test-omni-comigo.mjs minha-foto.jpg "falando para a câmera"');

  const ext = extname(foto).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) fail(`Formato de imagem não suportado: ${ext}. Use .jpg, .png ou .webp`);

  let bytes;
  try { bytes = readFileSync(foto); }
  catch { fail(`Não achei a foto: ${foto}`); }

  const b64 = bytes.toString("base64");
  log(`🖼  Foto: ${basename(foto)} (${(bytes.length / 1024).toFixed(0)} KB)`);
  log(`🎬 Modelo: ${model} · ${ratio} · ${seconds}s`);
  log(`📝 Comando: "${prompt}"`);
  log("");

  // 1) Dispara a geração (long-running operation)
  const startUrl = `${API_BASE}/models/${model}:predictLongRunning?key=${KEY}`;
  const body = {
    instances: [{ prompt, image: { bytesBase64Encoded: b64, mimeType } }],
    parameters: { aspectRatio: ratio, durationSeconds: Number(seconds), sampleCount: 1, personGeneration: "allow_adult" },
  };
  log("⏳ Enviando para o Google…");
  const op = await postJson(startUrl, body);
  if (!op?.name) fail(`Resposta inesperada ao iniciar: ${JSON.stringify(op).slice(0, 300)}`);
  log(`✓ Job criado: ${op.name.split("/").pop()}`);

  // 2) Polling até terminar (Veo leva ~1–3 min)
  log("⏳ Gerando o vídeo (pode levar 1–3 min)…");
  const done = await poll(`${API_BASE}/${op.name}?key=${KEY}`);
  const uri = pickUri(done);
  if (!uri) fail(`Terminou sem link de vídeo: ${JSON.stringify(done).slice(0, 300)}`);

  // 3) Baixa o mp4
  log("⬇  Baixando o vídeo…");
  const dl = uri.includes("key=") ? uri : `${uri}${uri.includes("?") ? "&" : "?"}key=${KEY}`;
  const res = await fetch(dl);
  if (!res.ok) fail(`Download falhou (HTTP ${res.status})`);
  const out = `omni-comigo-${stamp()}.mp4`;
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  log("");
  log(`🎉 PRONTO! Seu primeiro vídeo com o OMNI:  ${out}`);
  log("   Abra e veja. Se ficou bom, dá pra escalar isso pela fábrica (omni-video).");
}

async function poll(url, timeoutMs = 6 * 60_000, everyMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (let i = 0; ; i++) {
    const r = await getJson(url);
    if (r?.done) {
      if (r.error) fail(`O Google recusou: ${JSON.stringify(r.error).slice(0, 300)}`);
      return r;
    }
    if (Date.now() > deadline) fail(`Tempo esgotado após ${i} tentativas. Rode de novo.`);
    process.stdout.write("   ·\n");
    await sleep(everyMs);
  }
}

function pickUri(op) {
  const r = op?.response || {};
  return r?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
    || r?.generatedSamples?.[0]?.video?.uri
    || r?.generatedVideos?.[0]?.video?.uri
    || r?.videos?.[0]?.uri || null;
}

async function postJson(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return handle(r);
}
async function getJson(url) { return handle(await fetch(url, { headers: { "content-type": "application/json" } })); }

async function handle(r) {
  const text = await r.text();
  if (!r.ok) {
    let hint = "";
    if (r.status === 400 && /person|safety|policy/i.test(text)) hint = "\n   → Trava de segurança do Google para gerar pessoas a partir de foto.";
    if (r.status === 401 || r.status === 403) hint = "\n   → Chave inválida ou sem faturamento ativo (ative em aistudio.google.com).";
    if (r.status === 404) hint = "\n   → Modelo indisponível na sua conta. Tente --model veo-3.0-generate-preview.";
    if (r.status === 429) hint = "\n   → Limite de uso atingido. Espere um pouco e tente de novo.";
    fail(`HTTP ${r.status}: ${text.slice(0, 250)}${hint}`);
  }
  try { return JSON.parse(text); } catch { fail(`Resposta não-JSON: ${text.slice(0, 200)}`); }
}

function parseArgs(argv) {
  const out = { ratio: "9:16", seconds: "8", model: "veo-3.1-generate-preview", _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ratio") out.ratio = argv[++i];
    else if (a === "--seconds") out.seconds = argv[++i];
    else if (a === "--model") out.model = argv[++i];
    else out._.push(a);
  }
  out.foto = out._[0];
  out.prompt = out._[1] || "a mesma pessoa da foto falando diretamente para a câmera, expressão natural, luz suave, fundo desfocado";
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const log = (m) => process.stdout.write(m + "\n");
function fail(m) { process.stderr.write(`\n✖ ${m}\n`); process.exit(1); }

#!/usr/bin/env node
// @ts-check
/**
 * IdeaInbox CLI — sobe o servidor de captura (Telegram/WhatsApp/generico).
 * CLI First: nenhuma UI e necessaria para operar o inbox.
 *
 * Uso:
 *   idea-inbox [--port 8787] [--dir .idea-inbox]
 *
 * Env:
 *   PORT                      porta (default 8787, sobrescrita por --port)
 *   TELEGRAM_WEBHOOK_SECRET   secret do header x-telegram-bot-api-secret-token
 *   WHATSAPP_APP_SECRET       secret do HMAC x-hub-signature-256
 */
import { join } from "node:path";
import { Store } from "../../idea-forge/src/index.mjs";
import { createServer } from "../src/server.mjs";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.PORT || 8787);
  const dir = args.dir ? String(args.dir) : join(process.cwd(), ".idea-inbox");

  // Garante o store/dir antes de subir o servidor (createServer cria o seu proprio, mas
  // instanciar aqui tambem valida cedo que o diretorio e gravavel e falha rapido se nao for).
  const store = new Store(dir);

  const server = createServer({ dir });
  server.listen(port, () => {
    console.log(`\n📬 IdeaInbox — capture front-door do IdeaForge`);
    console.log(`   ouvindo em http://localhost:${port}`);
    console.log(`   store: ${store.baseDir}`);
    console.log(`   modo secrets: telegram=${process.env.TELEGRAM_WEBHOOK_SECRET ? "verificado" : "dev (sem verificacao)"} whatsapp=${process.env.WHATSAPP_APP_SECRET ? "verificado" : "dev (sem verificacao)"}`);
    console.log(`\n   Rotas:`);
    console.log(`     GET  /health`);
    console.log(`     POST /webhook/telegram`);
    console.log(`     POST /webhook/whatsapp`);
    console.log(`     POST /ingest            body: { text, audioRef?, source? }`);
    console.log("");
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}

main();

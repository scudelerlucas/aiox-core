// @ts-check
import { makeHandler } from "../_core.mjs";

// Tenta desabilitar o body-parser da plataforma para preservar os BYTES CRUS,
// necessarios ao HMAC do WhatsApp (N3). Se a plataforma ainda pre-parsear o
// corpo, o handler detecta (reconstructed) e rejeita (401) em vez de gerar um
// HMAC incorreto — fail-closed. Para WhatsApp com HMAC garantido, use o servidor
// standalone (bin/idea-inbox.mjs). Ver README > Deploy.
export const config = { api: { bodyParser: false } };

export default makeHandler("whatsapp");

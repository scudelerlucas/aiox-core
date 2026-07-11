import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config Vitest do OS-LIFEBOARD (compartilhada E2 ‖ E3).
 * - alias `@/*` → `./src/*` (espelha tsconfig paths).
 * - alias `server-only` → stub vazio (rede de segurança; nenhum teste desta
 *   rodada importa `client.mcp.ts`, que é PAUSADO). O kill-switch nº 3 segue
 *   ativo no build real (react-server condition).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});

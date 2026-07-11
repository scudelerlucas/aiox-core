/**
 * Declaração ambiente para o pacote `server-only` (kill-switch nº 3 do PRD).
 *
 * O pacote não expõe tipos; esta declaração deixa o `tsc` resolver o
 * `import 'server-only'` no topo de `client.mcp.ts` e de qualquer módulo das
 * camadas O/G. Em runtime de teste, o `server-only` é aliasado para um stub vazio
 * (ver `vitest.config.ts`) — mas nenhum teste desta rodada importa `client.mcp.ts`.
 */
declare module "server-only";

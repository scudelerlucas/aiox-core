/**
 * Stub vazio de `server-only` para o ambiente de teste (Vitest).
 *
 * O pacote real `server-only` lança em runtime quando importado fora de um módulo
 * de servidor. Nenhum teste desta rodada importa `client.mcp.ts` (PAUSADO), mas
 * aliasamos `server-only` para este stub em `vitest.config.ts` como rede de
 * segurança, para que a `factory` possa ser testada no futuro sem quebrar.
 * O kill-switch nº 3 (barra O/G do bundle client) continua ativo no build real.
 */
export {};

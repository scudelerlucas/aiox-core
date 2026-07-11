import type { NextConfig } from "next";

/**
 * OS-LIFEBOARD · E5 — Config Next.js (App Router).
 *
 * - `reactStrictMode`: dev-time double-invoke para pegar efeitos impuros.
 * - `eslint.ignoreDuringBuilds`: este package herda de E2/E3/E4 sem ESLint
 *   configurado (só vitest+tsc). O gate de tipos continua ATIVO via
 *   `typescript.ignoreBuildErrors: false` (build falha em erro de tipo).
 * - Nenhuma credencial/segredo aqui (camada G nunca no bundle, kill-switch nº 3).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

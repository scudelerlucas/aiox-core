import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "@/app/globals.css";

/**
 * OS-LIFEBOARD · E5 — Shell dark ALMA PETRA (spec §0/§2.3).
 *
 * `<html class="dark">` fixo (dark é o único modo na v1.0 — spec §0, YAGNI toggle).
 * Fundo raiz `navy-950`, texto `bone-100` via tokens do tailwind.config.ts.
 * Server Component: nenhum estado de cliente aqui.
 *
 * P5 (13/09/2026): a única navegação persistente do app vive aqui — nem
 * `page.tsx` nem `dashboard-client.tsx` tinham um cabeçalho de link (ambos
 * fora do escopo desta peça), então a rota nova (`/linha-do-tempo`) entra na
 * única casa segura para editar: este shell, presente em toda página.
 */
export const metadata: Metadata = {
  title: "ALMA PETRA · OS-LIFEBOARD",
  description:
    "Painel único multi-fonte com grafo de dependências e priorização diária HIERARQ.",
};

const NAV_LINKS = [
  { href: "/", label: "Painel" },
  { href: "/frentes", label: "Assuntos" },
  { href: "/linha-do-tempo", label: "Linha do tempo" },
] as const;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-navy-950 font-sans text-bone-100 antialiased">
        <nav
          aria-label="Navegação principal"
          className="flex min-h-[44px] items-center gap-4 border-b border-navy-800 bg-navy-900 px-4 text-sm sm:px-6"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              className="text-bone-300 hover:text-bone-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}

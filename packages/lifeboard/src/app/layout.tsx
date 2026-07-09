import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

/**
 * OS-LIFEBOARD · E5 — Shell dark ALMA PETRA (spec §0/§2.3).
 *
 * `<html class="dark">` fixo (dark é o único modo na v1.0 — spec §0, YAGNI toggle).
 * Fundo raiz `navy-950`, texto `bone-100` via tokens do tailwind.config.ts.
 * Server Component: nenhum estado de cliente aqui.
 */
export const metadata: Metadata = {
  title: "ALMA PETRA · OS-LIFEBOARD",
  description:
    "Painel único multi-fonte com grafo de dependências e priorização diária HIERARQ.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-navy-950 font-sans text-bone-100 antialiased">
        {children}
      </body>
    </html>
  );
}

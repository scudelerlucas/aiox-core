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
 *
 * P5d (13/09/2026, achado ALTO #1 do crítico hostil, rodada 3): `<nav>` agora
 * é `sticky top-0 z-40` — antes rolava com a página, e a linha do tempo
 * assumia (via `HEADER_TOP_STICKY` fixo) que ela sempre ocupava uma faixa de
 * 44px no topo. Na TRANSIÇÃO do scroll (nav saindo de cena, cabeçalho da
 * escala já grudado no seu offset fixo) sobrava uma faixa sem nav NEM
 * cabeçalho, onde linhas da tabela apareciam por cima do eixo de datas.
 * Sticky faz a nav nunca sair de cena — a linha do tempo agora mede a altura
 * real dela em runtime (`getBoundingClientRect`) em vez de supor 44px.
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
  { href: "/prompts", label: "Prompts" },
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
          className="sticky top-0 z-40 flex min-h-[44px] items-center gap-4 border-b border-navy-800 bg-navy-900 px-4 text-sm sm:px-6"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              // [BAIXO #6, rodada 6 do crítico] a barra já tinha 44 px de
              // altura, mas o LINK dentro dela tinha 20 — e o alvo de toque é
              // o link, não a barra. `inline-flex` + `min-h-[44px]` fazem a
              // área clicável ocupar a faixa inteira, sem mudar o visual.
              className="inline-flex min-h-[44px] items-center text-bone-300 hover:text-bone-100"
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

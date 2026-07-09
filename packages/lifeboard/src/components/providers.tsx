"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * OS-LIFEBOARD · E5 — Provider do TanStack Query (cache de leitura, PRD §9 / arch §4).
 * QueryClient criado uma vez por montagem (useState lazy) para não recriar em rerender.
 */
export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

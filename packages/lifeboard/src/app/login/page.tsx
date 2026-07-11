"use client";

/**
 * OS-LIFEBOARD — Página de login (Entrar com Google).
 *
 * Único ponto de entrada não-protegido além de /api/health e /auth/*. O
 * middleware redireciona pra cá quem não tem sessão ou cujo email não está na
 * allowlist. Paleta ALMA PETRA.
 */

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const C = {
  navy: "#0A1628",
  bone: "#F5F2EC",
  gold: "#A8895A",
  card: "#0F1E33",
  border: "#1E3350",
  muted: "#8593A8",
  red: "#CF5C48",
};

export default function LoginPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const hasError =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("error");

  async function signIn(): Promise<void> {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.navy,
        color: C.bone,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 380,
          width: "100%",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: "40px 34px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>
          ALMA PETRA
        </h1>
        <div
          style={{
            color: C.gold,
            fontFamily: "monospace",
            fontSize: 13,
            marginTop: 4,
          }}
        >
          OS-LIFEBOARD
        </div>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 18, lineHeight: 1.5 }}>
          Painel privado. Entre com sua conta Google autorizada para ver suas
          tarefas.
        </p>

        {hasError && (
          <div style={{ color: C.red, fontSize: 13, marginTop: 16 }}>
            Não foi possível entrar. Verifique se este email está autorizado.
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          style={{
            marginTop: 26,
            width: "100%",
            padding: "13px 18px",
            borderRadius: 12,
            border: `1px solid ${C.gold}`,
            background: loading ? "transparent" : C.gold,
            color: loading ? C.gold : C.navy,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Redirecionando…" : "Entrar com Google"}
        </button>
      </div>
    </main>
  );
}

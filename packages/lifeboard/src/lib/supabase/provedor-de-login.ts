/**
 * OS-LIFEBOARD — o login sabe dizer quando o provedor está desligado.
 *
 * POR QUE EXISTE. Em 17/09/2026 o operador clicou em "Entrar com Google" no
 * painel de produção e saiu do app direto para um JSON cru do Supabase:
 *
 *   {"code":400,"error_code":"validation_failed",
 *    "msg":"Unsupported provider: provider is not enabled"}
 *
 * `signInWithOAuth` monta a URL e NAVEGA — quando o provedor está desligado no
 * projeto, quem responde é o Supabase, já fora do app. A pessoa fica numa página
 * branca com JSON e sem nada acionável, e o painel não tem como se explicar.
 * A régua de UI da casa proíbe exatamente isto: erro em português, na tela, no
 * lugar onde a pessoa está — nunca JSON (kernel-inicio §6 / B11).
 *
 * `/auth/v1/settings` é endpoint PÚBLICO do Supabase Auth e lista quais
 * provedores estão ligados. Uma consulta antes de navegar troca o JSON por uma
 * frase que diz o que fazer, e de quebra mostra QUAL projeto está configurado —
 * que foi a outra metade do problema de 17/09 (o painel apontava para o projeto
 * de outro sistema, `ofskmjpzlgzmnivmkyop`, onde o Google nunca foi ligado).
 *
 * DEGRADA, NUNCA DERRUBA — mesma disciplina do portão (`src/middleware.ts`):
 * só `"desligado"` (resposta explícita do Supabase) segura o clique. Rede fora,
 * resposta estranha ou variável ausente devolvem `"indeterminado"`, e o login
 * segue normalmente. Uma checagem auxiliar nunca pode virar a razão de ninguém
 * não conseguir entrar.
 */

export type EstadoDoProvedor = "ligado" | "desligado" | "indeterminado";

const PRAZO_DA_CONSULTA_MS = 5_000;

/**
 * Pergunta ao Supabase se o login com Google está ligado neste projeto.
 * `buscar` é injetável para teste; em produção é o `fetch` do browser.
 */
export async function consultarProvedorGoogle(
  url: string,
  anonKey: string,
  buscar: typeof fetch = fetch,
): Promise<EstadoDoProvedor> {
  if (url === "" || anonKey === "") return "indeterminado";

  const controlador = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  try {
    const base = url.replace(/\/+$/, "");
    const consulta = (async (): Promise<EstadoDoProvedor> => {
      const resposta = await buscar(`${base}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        signal: controlador.signal,
      });
      if (!resposta.ok) return "indeterminado";

      const corpo: unknown = await resposta.json();
      const externo = (corpo as { external?: Record<string, unknown> } | null)?.external;
      if (externo === undefined || externo === null || typeof externo !== "object") {
        return "indeterminado";
      }
      if (externo.google === true) return "ligado";
      if (externo.google === false) return "desligado";
      return "indeterminado";
    })();
    const expiracao = new Promise<never>((_resolve, reject) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        reject(new Error("prazo da consulta do provedor expirou"));
      }, PRAZO_DA_CONSULTA_MS);
    });

    return await Promise.race([consulta, expiracao]);
  } catch {
    return "indeterminado";
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
}

/** `https://abc123.supabase.co` → `abc123`. Vazio quando a URL não dá para ler. */
export function refDoProjeto(url: string): string {
  try {
    const partes = new URL(url).hostname.split(".");
    return partes[0] ?? "";
  } catch {
    return "";
  }
}

/** A frase que aparece na tela no lugar do JSON do Supabase. */
export function mensagemProvedorDesligado(ref: string): string {
  const alvo = ref === "" ? "o projeto Supabase configurado" : `o projeto ${ref}`;
  return (
    `O login com Google está desligado em ${alvo}. ` +
    `Ligue em Authentication → Providers → Google, no painel desse projeto — ` +
    `ou aponte o painel para o projeto certo (DEPLOY.md, "Ordem para migrar de projeto").`
  );
}

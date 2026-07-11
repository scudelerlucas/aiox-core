import "server-only";

/**
 * OS-LIFEBOARD — Supabase server client para Route Handlers (cookies via
 * next/headers). Usado no callback OAuth e no signout. Server-only.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/config/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

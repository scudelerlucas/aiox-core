#!/usr/bin/env python3
"""
claude-code-cost.py — calcula o GASTO (USD) de cada chat do Claude Code por dia
e, opcionalmente, publica no dashboard vivo (Supabase → claude_code_costs).

Lê os transcripts locais (~/.claude/projects/**/*.jsonl), soma tokens por modelo
(input, output, cache write, cache read) + web searches, e precifica com a tabela
oficial. Rola os subagentes no chat-pai (o custo do subagente É custo do chat).

Uso:
  python3 claude-code-cost.py                 # só HOJE, todos os chats deste ambiente
  python3 claude-code-cost.py --date 2026-07-22
  python3 claude-code-cost.py --all           # todos os dias
  python3 claude-code-cost.py --push          # + publica no dashboard (Supabase)
  python3 claude-code-cost.py --push --quiet  # publica sem imprimir nada (uso em hook)

IMPORTANTE (cobertura): cada sessão do Claude Code na web roda num ambiente próprio.
Este script vê só os chats cujo transcript está NESTE ambiente. --push resolve isso:
cada ambiente que rodar (via o Stop hook instalado no repo) publica sua fatia no
mesmo dashboard, que soma tudo. Sem --push, é só leitura local.
"""
import argparse, glob, json, os, subprocess, sys, urllib.error, urllib.request
from collections import defaultdict
from datetime import datetime, timezone

# USD por 1M tokens. cache_write = criação de cache (≈1.25× input); cache_read = leitura.
PRICES = {
    # precos oficiais Anthropic (por 1M tokens): in / out / cache-write 1.25x / cache-read 0.1x
    "claude-fable-5-1":           {"in": 10.0, "out": 50.0, "cw": 12.50, "cr": 0.25},
    "claude-fable-5":             {"in": 10.0, "out": 50.0, "cw": 12.50, "cr": 1.00},
    "claude-opus-5":              {"in": 5.0,  "out": 25.0, "cw": 6.25,  "cr": 0.50},
    "claude-opus-4-8":            {"in": 5.0,  "out": 25.0, "cw": 6.25,  "cr": 0.50},
    "claude-opus-4-7":            {"in": 5.0,  "out": 25.0, "cw": 6.25,  "cr": 0.50},
    "claude-sonnet-5":            {"in": 3.0,  "out": 15.0, "cw": 3.75,  "cr": 0.30},
    "claude-sonnet-4-6":          {"in": 3.0,  "out": 15.0, "cw": 3.75,  "cr": 0.30},
    "claude-haiku-4-5-20251001":  {"in": 1.0,  "out": 5.0,  "cw": 1.25,  "cr": 0.10},
}
WEB_SEARCH_USD = 0.01  # US$10 / 1.000 buscas

# Publicação no dashboard vivo. Chave ANON (pública por design do Supabase) — a
# tabela claude_code_costs tem RLS de escrita/leitura públicas de propósito
# (dado pessoal do operador, sem tenant). Ver supabase/migrations/*claude_code_costs*.
SUPABASE_URL = "https://hciiilopyivjaekaxfqp.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjaWlpbG9weWl2amFla2F4ZnFwIi"
    "wicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjA5NzIsImV4cCI6MjA4NzU5Njk3Mn0.y6gEHccuCNeUno3ehwYUATrQTI94Ns-M6iwio_GzifY"
)

def price(model, u):
    p = PRICES.get(model)
    if not p:
        return None  # modelo desconhecido: tokens contam, custo fica indefinido
    return (u["in"] * p["in"] + u["out"] * p["out"]
            + u["cw"] * p["cw"] + u["cr"] * p["cr"]) / 1_000_000 \
            + u.get("ws", 0) * WEB_SEARCH_USD

def blank():
    return {"in": 0, "out": 0, "cw": 0, "cr": 0, "ws": 0}

def add(dst, u):
    for k in ("in", "out", "cw", "cr", "ws"):
        dst[k] += u.get(k, 0)

def parent_id(path, root):
    # .../projects/<proj>/<SESSION>.jsonl                 → chat = SESSION
    # .../projects/<proj>/<SESSION>/subagents/agent-*.jsonl → chat = SESSION (rola no pai)
    rel = os.path.relpath(path, root)
    parts = rel.split(os.sep)
    if "subagents" in parts:
        return parts[parts.index("subagents") - 1]
    return os.path.splitext(parts[-1])[0]

def repo_name():
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=5)
        if top.returncode == 0:
            return os.path.basename(top.stdout.strip())
    except Exception:
        pass
    return os.path.basename(os.getcwd())

def env_hint():
    return os.environ.get("HOSTNAME") or os.uname().nodename if hasattr(os, "uname") else "unknown"

def push_rows(rows, quiet):
    """Upsert em claude_code_costs via REST (PostgREST). Fail-open: erro nunca derruba o script."""
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/claude_code_costs?on_conflict=session_id,date,model"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if not quiet:
                print(f"[push] {len(rows)} linha(s) publicada(s) no dashboard (HTTP {resp.status}).")
    except urllib.error.HTTPError as e:
        if not quiet:
            print(f"[push] falhou (HTTP {e.code}): {e.read()[:200]}", file=sys.stderr)
    except Exception as e:
        if not quiet:
            print(f"[push] falhou: {e}", file=sys.stderr)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.expanduser("~/.claude/projects"))
    ap.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--push", action="store_true", help="publica no dashboard vivo (Supabase)")
    ap.add_argument("--quiet", action="store_true", help="não imprime nada (uso em hook)")
    ap.add_argument("--cap", type=float, default=None,
                    help="teto diário em USD: imprime 1 linha e sai com código 2 se o gasto do dia >= teto (uso em hook de trava)")
    args = ap.parse_args()

    files = glob.glob(os.path.join(args.root, "**", "*.jsonl"), recursive=True)
    if not files:
        if not args.quiet:
            print(f"nenhum transcript em {args.root}", file=sys.stderr)
        sys.exit(0 if args.quiet else 1)

    # chat -> model -> tokens (para exibição, respeitando o filtro de data)
    chats = defaultdict(lambda: defaultdict(blank))
    # (chat, model, date) -> tokens (para publicação — sempre por data exata do evento)
    push_agg = defaultdict(blank)

    for f in files:
        chat = parent_id(f, args.root)
        with open(f, encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if not line or '"usage"' not in line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ts = ev.get("timestamp", "")
                ev_date = ts[:10] if ts else ""
                msg = ev.get("message") or {}
                usage = msg.get("usage")
                if not isinstance(usage, dict):
                    continue
                model = msg.get("model") or "unknown"
                stu = usage.get("server_tool_use") or {}
                u = {
                    "in": usage.get("input_tokens", 0) or 0,
                    "out": usage.get("output_tokens", 0) or 0,
                    "cw": usage.get("cache_creation_input_tokens", 0) or 0,
                    "cr": usage.get("cache_read_input_tokens", 0) or 0,
                    "ws": stu.get("web_search_requests", 0) or 0,
                }
                # entradas sintéticas (ex.: model="<synthetic>" de resumo/compactação) somam
                # zero tokens — ignorar para não sinalizar "modelo sem preço" à toa.
                if not any(u.values()):
                    continue
                if ev_date:
                    add(push_agg[(chat, model, ev_date)], u)
                if args.all or ev_date == args.date:
                    add(chats[chat][model], u)

    if args.push:
        repo = repo_name()
        env = env_hint()
        rows = []
        for (chat, model, ev_date), u in push_agg.items():
            if not args.all and ev_date != args.date:
                continue
            c = price(model, u)
            rows.append({
                "session_id": chat,
                "date": ev_date,
                "model": model,
                "repo": repo,
                "env_hint": env,
                "input_tokens": u["in"],
                "output_tokens": u["out"],
                "cache_write_tokens": u["cw"],
                "cache_read_tokens": u["cr"],
                "web_searches": u["ws"],
                "cost_usd": round(c, 6) if c is not None else 0,
            })
        push_rows(rows, args.quiet)

    if args.cap is not None:
        grand = 0.0; unknown = False
        for models in chats.values():
            for model, u in models.items():
                c = price(model, u)
                if c is None: unknown = True
                else: grand += c
        flag = " (+modelo sem preço, subestimado)" if unknown else ""
        if grand >= args.cap:
            print(f"TRAVA DE GASTO: US$ {grand:.2f} gastos hoje neste ambiente >= teto de US$ {args.cap:.2f}{flag}. "
                  f"Bloqueado até amanhã (UTC) ou até o operador subir o teto (CLAUDE_COST_CAP_USD).", file=sys.stderr)
            sys.exit(2)
        if not args.quiet:
            print(f"gasto hoje US$ {grand:.2f} / teto US$ {args.cap:.2f}{flag}")
        sys.exit(0)

    if args.quiet:
        return

    scope = "TODOS os dias" if args.all else f"dia {args.date}"
    print(f"\n=== GASTO CLAUDE CODE — {scope} — {len(chats)} chat(s) neste ambiente ===\n")
    grand = 0.0
    grand_unknown = False
    rows_disp = []
    for chat, models in chats.items():
        tot_c = 0.0; tot = blank(); unknown = False
        detail = []
        for model, u in sorted(models.items()):
            c = price(model, u)
            if c is None:
                unknown = True
            else:
                tot_c += c
            add(tot, u)
            detail.append((model, u, c))
        rows_disp.append((tot_c, chat, tot, detail, unknown))
        grand += tot_c
        grand_unknown = grand_unknown or unknown

    for tot_c, chat, tot, detail, unknown in sorted(rows_disp, reverse=True):
        toks = tot["in"] + tot["out"] + tot["cw"] + tot["cr"]
        flag = "  (+modelo sem preço)" if unknown else ""
        print(f"● chat {chat[:8]}…  US$ {tot_c:8.4f}{flag}")
        print(f"    tokens: in {tot['in']:,} · out {tot['out']:,} · cache_write {tot['cw']:,} · cache_read {tot['cr']:,} · web {tot['ws']}  (total {toks:,})")
        for model, u, c in detail:
            cs = f"US$ {c:.4f}" if c is not None else "US$   ?  (sem preço)"
            print(f"      - {model:28} {cs:>18}  (in {u['in']:,} / out {u['out']:,} / cw {u['cw']:,} / cr {u['cr']:,})")
    print("\n" + "─" * 60)
    extra = "  (+algo sem preço — subestimado)" if grand_unknown else ""
    print(f"TOTAL DO AMBIENTE ({scope}): US$ {grand:.4f}{extra}")
    if args.push:
        print("Publicado no dashboard vivo — outros ambientes que rodarem --push somam ao mesmo total.")
    else:
        print("Cobertura: só os chats cujo transcript está neste ambiente. Use --push para somar todos.")
    print()

if __name__ == "__main__":
    main()

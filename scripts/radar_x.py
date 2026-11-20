"""Coleta os tweets de cada termo de data/radar.json usando o Agent Reach.

Roda na máquina de quem fez login no X pelo Agent Reach (`agent-reach login twitter`),
não no GitHub Actions. Só lê: não posta, não curte, não responde.
Guarda link, autor e data de cada tweet; o site mostra o tweet pelo embed oficial do X.
Termo que falhar mantém os tweets da coleta anterior; nada é inventado.

Uso (com o Python do Agent Reach, que no Windows fica em
%APPDATA%\\uv\\tools\\agent-reach\\Scripts\\python.exe):
    <python do agent-reach> scripts/radar_x.py            # coleta e salva
    <python do agent-reach> scripts/radar_x.py --dry-run  # só mostra o que viria
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "radar.json"
LIMIT = 8      # tweets por termo
PAUSE = 12     # segundos entre buscas (o Agent Reach pede no mínimo 10)
STATUS = re.compile(r"https?://(?:www\.)?(?:x|twitter)\.com/([^/]+)/status/(\d+)")


def reach() -> list[str]:
    """Comando do Agent Reach. Rodando com o Python do próprio Agent Reach, chama o módulo direto
    (o atalho .exe do uv falha quando chamado de um Python isolado, como o da loja do Windows)."""
    try:
        import agent_reach.cli  # noqa: F401
        return [sys.executable, "-c",
                "import sys;from agent_reach.cli import main;sys.argv=['agent-reach']+sys.argv[1:];sys.exit(main())"]
    except ImportError:
        exe = shutil.which("agent-reach")
        if not exe:
            raise SystemExit("agent-reach não encontrado")
        return [exe]


def search(q: str) -> list[dict] | None:
    r = subprocess.run(reach() + ["twitter", "search", q, "--limit", str(LIMIT)],
                       capture_output=True, text=True, encoding="utf-8", timeout=180)
    try:
        d = json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"  ! resposta inválida: {r.stderr[-200:]}")
        return None
    if not d.get("ok"):
        err = d.get("error") or {}
        print(f"  ! {err.get('code')}: {err.get('message')}")
        if err.get("code") in ("NEED_LOGIN", "PLATFORM_BLOCKED", "RATE_LIMITED", "BUSY"):
            raise SystemExit("Parando: o X pediu login, verificação ou pausa. Nada foi salvo.")
        return None
    out = []
    for it in d.get("items") or []:
        m = STATUS.search(it.get("url") or "")
        if not m:
            continue
        author = it.get("author") or (m.group(1) if m.group(1) != "i" else "")
        out.append({"url": f"https://x.com/{author or 'i'}/status/{m.group(2)}",
                    "author": author,
                    "published_at": iso(it.get("published_at"))})
    return out


def iso(s: str | None) -> str | None:
    """Converte 'Thu Nov 19 16:15:38 +0000 2026' (formato do X) pra ISO 8601."""
    if not s:
        return None
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y").isoformat()
    except ValueError:
        return s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    data = json.loads(DATA.read_text(encoding="utf-8"))
    # contas que não entram no radar (a dela já aparece no próprio perfil)
    skip = {a.lower() for a in data.get("excluir_autores", [])}
    keep = lambda t: (t.get("author") or "").lower() not in skip
    extra = "".join(f" -from:{a}" for a in data.get("excluir_autores", []))
    old = {}
    for t in data.get("tweets", []):
        if keep(t):
            old.setdefault(t["termo"], []).append(t)
    tweets, ok = [], 0
    for i, termo in enumerate(data["termos"]):
        if i:
            time.sleep(PAUSE)
        print(f"- {termo['rotulo']} ({termo['q']})")
        got = search(termo["q"] + extra)
        if got is None:
            tweets += old.get(termo["id"], [])
            continue
        ok += 1
        got = [t for t in got if keep(t)]
        print(f"  {len(got)} tweets")
        tweets += [dict(t, termo=termo["id"]) for t in got]
    if not ok:
        raise SystemExit("Nenhuma pauta foi coletada. Nada foi salvo.")
    if args.dry_run:
        print(json.dumps(tweets, ensure_ascii=False, indent=1))
        return
    data["tweets"] = tweets
    data["atualizado_em"] = date.today().isoformat()
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{len(tweets)} tweets salvos em {DATA.name}.")


if __name__ == "__main__":
    main()

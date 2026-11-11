"""Atualiza views e comentários de data/videos.json a partir das páginas públicas.

Usa yt-dlp só pra ler metadados (não baixa vídeo). TikTok e YouTube funcionam sem login.
Instagram costuma exigir login: passe um cookies.txt em IG_COOKIES pra incluir.
Vídeo que falhar mantém o número anterior; nada é inventado.

Uso:
    pip install -r requirements.txt
    python scripts/update_metrics.py            # atualiza
    python scripts/update_metrics.py --dry-run  # só mostra o que mudaria
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

import yt_dlp

DATA = Path(__file__).resolve().parent.parent / "data" / "videos.json"
SUPPORTED = ("TikTok", "YouTube", "Instagram")


def fetch(url: str, cookies: str | None) -> dict | None:
    """Lê view_count e comment_count de um vídeo público. Retorna None se falhar."""
    opts = {"quiet": True, "skip_download": True, "no_warnings": True}
    if cookies and "instagram.com" in url:
        opts["cookiefile"] = cookies
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        return {"views": info.get("view_count"), "com": info.get("comment_count")}
    except Exception as e:  # rede fora, login exigido, vídeo removido
        print(f"  ! falhou: {type(e).__name__}: {str(e)[:120]}")
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    cookies = os.getenv("IG_COOKIES")

    data = json.loads(DATA.read_text(encoding="utf-8"))
    changed = 0
    for v in data["videos"]:
        if not v["plat"].startswith(SUPPORTED):
            continue
        if v["plat"] == "Instagram" and not cookies:
            continue
        print(f"- {v['who']} · {v['title']}")
        got = fetch(v["url"], cookies)
        if not got:
            continue
        for k in ("views", "com"):
            new = got[k]
            if new is not None and new != v.get(k):
                print(f"  {k}: {v.get(k)} -> {new}")
                v[k] = new
                changed += 1
        v["coletado_em"] = date.today().isoformat()

    if changed and not args.dry_run:
        data["atualizado_em"] = date.today().isoformat()
        data["fonte"] = "Métricas públicas atualizadas via yt-dlp"
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{changed} números mudaram{' (dry-run, nada salvo)' if args.dry_run else ''}.")


if __name__ == "__main__":
    main()

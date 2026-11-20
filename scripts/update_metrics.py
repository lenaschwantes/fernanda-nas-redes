"""Atualiza views e comentários de data/videos.json e as views típicas do TikTok em data/benchmarks.json.

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
BENCH = DATA.parent / "benchmarks.json"
SUPPORTED = ("TikTok", "YouTube", "Instagram")
RECENT = 12  # vídeos recentes usados na mediana das views típicas


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


def typical_views(handle: str) -> int | None:
    """Mediana de views dos vídeos mais recentes não fixados de um perfil do TikTok."""
    opts = {"quiet": True, "no_warnings": True, "skip_download": True, "playlistend": RECENT}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://www.tiktok.com/@{handle}", download=False)
        views = sorted(e["view_count"] for e in (info.get("entries") or []) if e and e.get("view_count") is not None)
    except Exception as e:
        print(f"  ! falhou: {type(e).__name__}: {str(e)[:120]}")
        return None
    if len(views) < 5:  # amostra pequena demais, mantém o número anterior
        print(f"  ! só {len(views)} vídeos lidos, mantendo o anterior")
        return None
    m = len(views) // 2
    return views[m] if len(views) % 2 else round((views[m - 1] + views[m]) / 2)


def update_benchmarks(dry_run: bool) -> int:
    """Atualiza as views típicas dos perfis do TikTok. Seguidores ficam com a última coleta manual."""
    bench = json.loads(BENCH.read_text(encoding="utf-8"))
    changed = 0
    for p in bench["perfis"]:
        if p.get("rede") != "TikTok" or not p.get("handle"):
            continue
        print(f"- benchmark {p['who']} (@{p['handle']})")
        med = typical_views(p["handle"])
        if med is not None and med != p.get("med"):
            print(f"  med: {p.get('med')} -> {med}")
            p["med"] = med
            changed += 1
    if changed and not dry_run:
        bench["atualizado_em"] = date.today().isoformat()
        BENCH.write_text(json.dumps(bench, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


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
    print(f"\n{changed} números de vídeos mudaram{' (dry-run, nada salvo)' if args.dry_run else ''}.")
    b = update_benchmarks(args.dry_run)
    print(f"{b} views típicas mudaram nos benchmarks{' (dry-run, nada salvo)' if args.dry_run else ''}.")


if __name__ == "__main__":
    main()

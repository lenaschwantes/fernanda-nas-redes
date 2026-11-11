# Fernanda nas Redes

Guia de referência da equipe da deputada Fernanda Melchionna (PSOL-RS) pra construir relação com o público nas redes. Site estático: HTML, CSS e JS puro, com os dados em JSON e atualização semanal das métricas via GitHub Actions.

## Rodar local

```bash
python -m http.server 8000
# abre http://localhost:8000
```

Precisa de servidor porque a página carrega `data/*.json` com `fetch`. Abrindo o arquivo direto, os dados não aparecem.

## Estrutura

```
index.html                 página (seções e marcação)
assets/style.css           tokens de cor/tipo, tema claro e escuro
assets/app.js              monta tudo a partir de /data, embeds sob demanda
assets/thumbs/*.jpg        capas dos vídeos (recortadas da coleta)
data/videos.json           vídeos de referência: degrau, números, "o que observar"
data/benchmarks.json       perfis comparados (Fernanda, Ana Elisa, Janones, Luide, Cortez)
data/content.json          degraus, roteiros, checklist, regras, perguntas
scripts/update_metrics.py  atualiza views e comentários via yt-dlp
.github/workflows/         roda o script toda segunda e commita se mudou
```

## Editar conteúdo

Tudo que a equipe muda fica em `data/`. Pra adicionar um vídeo, copia um item de `videos.json` e preenche:

| Campo | O que é |
| --- | --- |
| `who`, `plat`, `title`, `url` | Quem, rede (`TikTok`, `Instagram`, `YouTube Shorts`, `X`), título, link |
| `vid` | ID do vídeo na URL (o número do TikTok, o código do reel, o ID do Short). É o que liga o player |
| `deg` | `entrada`, `conhecer`, `confiar`, `conversar`, `participar` ou `anti` |
| `views`, `com` | Views e comentários. `null` quando não tem dado. Nunca chutar |
| `obs` | O que a equipe deve observar no vídeo, em uma ou duas frases |
| `thumb` | Caminho da capa em `assets/thumbs/`, ou `null` (mostra o título no lugar) |

## Vídeos tocando na página

O botão "Assistir aqui" troca a capa pelo player oficial (TikTok `embed/v2`, Instagram `/embed`, YouTube `/embed`). O player só carrega no clique, então a página fica leve. O X não tem player simples, por isso só abre o link.

## Métricas automáticas

```bash
pip install -r requirements.txt
python scripts/update_metrics.py --dry-run   # mostra o que mudaria
python scripts/update_metrics.py             # salva em data/videos.json
```

TikTok e YouTube funcionam sem login. Instagram exige login: exporta um `cookies.txt` de uma conta de serviço (nunca a conta pessoal da deputada) e salva o conteúdo no secret `IG_COOKIES` do repositório. Sem o secret, os vídeos do Instagram ficam com o último número coletado.

O gráfico do diagnóstico é fixo de propósito: é a linha de base de 11/nov/2026 pra comparar depois.

## Deploy

GitHub Pages: Settings, Pages, Deploy from branch, `main`, pasta `/ (root)`. Ou Vercel/Netlify importando o repo, sem build.

## Fontes

Métricas públicas coletadas via vidIQ em 11/nov/2026. Manual completo e questionário da Fernanda: doc compartilhado no Claude.

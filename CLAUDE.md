# CLAUDE.md

Site estático de referência pra deputada Fernanda Melchionna (PSOL-RS). Público: a própria deputada, e a copy fala direto com ela, de "você".

## Regras do projeto

- Sem build e sem framework. HTML, CSS e JS puro. Não adicionar dependência de front sem pedir.
- Conteúdo mora em `data/*.json`. Mudança de texto ou número é edição de JSON, não de `app.js`.
- Nunca inventar métricas. Sem dado, o campo é `null` e a página mostra "sem dado".
- Português do Brasil, tom direto e caloroso. Nunca usar travessão (—), sempre vírgula.
- Cores só pelos tokens de `:root` em `style.css`, com tema claro e escuro.
- Tese do site: quando a Fernanda aparece falando, o público conversa (6,5 vs 0,2 comentários a cada 100 plays). Todo conteúdo novo serve a um degrau da escada: Conhecer, Confiar, Conversar, Participar.
- Regra editorial: confronta o adversário, acolhe o público. Nada que ataque o eleitor.

## Comandos

- Servir local: `python -m http.server 8000`
- Atualizar métricas: `python scripts/update_metrics.py --dry-run` e depois sem a flag

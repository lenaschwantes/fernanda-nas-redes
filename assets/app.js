/* Fernanda nas Redes: carrega os dados de /data e monta a página. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n == null ? 'sem dado'
  : n >= 1e6 ? (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M'
  : n >= 1e3 ? (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'
  : n.toLocaleString('pt-BR');
const rate = v => v.views && v.com != null ? v.com / v.views * 100 : null;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem storage */ } }
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado'); }
  catch (e) { toast('Não deu para copiar. Selecione o texto e copie à mão'); }
}

/** URL do player oficial de cada rede, ou null quando a rede não tem embed simples (X). */
function embedUrl(v) {
  if (!v.vid) return null;
  if (v.plat === 'TikTok') return `https://www.tiktok.com/embed/v2/${v.vid}`;
  if (v.plat === 'Instagram') return `https://www.instagram.com/reel/${v.vid}/embed`;
  if (v.plat.startsWith('YouTube')) return `https://www.youtube.com/embed/${v.vid}`;
  return null;
}

async function load(name) {
  const r = await fetch(`data/${name}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Não carregou data/${name}.json (${r.status})`);
  return r.json();
}

/* sumário no topo + seção atual destacada na barra */
function setupNav() {
  const secs = [...document.querySelectorAll('section[id]')];
  const toc = $('#toc');
  if (toc) toc.innerHTML = '<h2 class="toc-t">Neste guia</h2><ol>' + secs.map(s => {
    const n = s.querySelector('.head .num')?.textContent || '', e = s.querySelector('.eyebrow')?.textContent || '', h = s.querySelector('h2')?.textContent || '';
    return `<li><a href="#${s.id}"><span class="tn">${esc(n)}</span><span class="te">${esc(e)}</span><span class="th">${esc(h)}</span></a></li>`;
  }).join('') + '</ol>';
  const bar = document.querySelector('nav.top .wrap');
  const links = new Map([...bar.querySelectorAll('a[href^="#"]')].map(a => [a.getAttribute('href').slice(1), a]));
  const edge = () => bar.classList.toggle('more', bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
  bar.addEventListener('scroll', edge, { passive: true }); addEventListener('resize', edge); edge();
  let cur = null;
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting || cur === en.target.id) return;
    cur = en.target.id;
    links.forEach((a, id) => id === cur ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
    const a = links.get(cur);
    if (a) bar.scrollTo({ left: a.offsetLeft - bar.clientWidth / 2 + a.offsetWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
  }), { rootMargin: '-40% 0px -55% 0px' });
  secs.forEach(s => io.observe(s));
  /* no topo, nenhuma seção marcada */
  addEventListener('scroll', () => { if (scrollY < 200 && cur) { cur = null; links.forEach(a => a.removeAttribute('aria-current')); } }, { passive: true });
}
setupNav();

async function main() {
  const [vids, bench, content] = await Promise.all([load('videos'), load('benchmarks'), load('content')]);
  const V = vids.videos, BENCH = bench.perfis;
  const { degraus: DEG, roteiros: SCRIPTS, checklist: CHECK, regras: RULES, perguntas: QS } = content;
  const d = new Date(vids.atualizado_em + 'T12:00:00');
  $('#updated').textContent = 'dados de ' + d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });

  renderChart();

  /* escada + galeria */
  let filt = store.get('fnr-filter', 'all');
  const ORDER = ['entrada', 'conhecer', 'confiar', 'conversar', 'participar', 'anti'];

  function renderLadder() {
    $('#ladder').innerHTML = ORDER.slice(0, 5).map(k => {
      const g = DEG[k];
      return `<button class="step" data-k="${k}" aria-pressed="${filt === k}">
        <span class="n">${g.n === 'Porta' ? 'Antes do degrau 1' : 'Degrau ' + g.n}</span>
        <strong>${g.name}</strong><em>${esc(g.feel)}</em>
        <span style="font-size:13px">${esc(g.fmt)}</span><span class="sig">Sinal: ${esc(g.sig)}</span><span class="go">${filt === k ? 'Mostrando na galeria · tirar filtro' : 'Ver os vídeos ↓'}</span></button>`;
    }).join('');
    $('#ladder').querySelectorAll('.step').forEach(b => b.onclick = () => {
      setFilter(filt === b.dataset.k ? 'all' : b.dataset.k);
      document.getElementById('videos').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
    });
  }
  function renderFilters() {
    const opts = [['all', 'Todos']].concat(ORDER.map(k => [k, DEG[k].name]));
    $('#filters').innerHTML = opts.map(([k, n]) => `<button class="chip" data-k="${k}" aria-pressed="${filt === k}">${n}</button>`).join('');
    $('#filters').querySelectorAll('.chip').forEach(b => b.onclick = () => setFilter(b.dataset.k));
  }
  function setFilter(k) { filt = k; store.set('fnr-filter', k); renderFilters(); renderLadder(); renderGallery(); }

  function renderGallery() {
    const by = $('#sort').value;
    const list = V.filter(v => filt === 'all' || v.deg === filt).sort((a, b) =>
      by === 'views' ? (b.views || 0) - (a.views || 0)
      : by === 'deg' ? ORDER.indexOf(a.deg) - ORDER.indexOf(b.deg)
      : (rate(b) ?? -1) - (rate(a) ?? -1));
    $('#count').textContent = list.length + ' vídeos' + (filt === 'all' ? '' : ' em ' + DEG[filt].name);
    $('#gallery').innerHTML = list.length ? list.map((v, i) => {
      const r = rate(v), emb = embedUrl(v), net = v.plat.replace(' Shorts', '');
      return `<article class="card${v.deg === 'anti' ? ' anti' : ''}" data-i="${V.indexOf(v)}">
        <div class="media"><a class="cover" href="${v.url}" target="_blank" rel="noopener" aria-label="Abrir vídeo: ${esc(v.title)}">
          ${v.thumb ? `<img src="${v.thumb}" alt="" loading="lazy">` : `<span class="noimg">${esc(v.title)}</span>`}
          <span class="tag t-${v.deg}">${DEG[v.deg].name}</span><span class="play">▶ Abrir no ${net}</span></a></div>
        <div class="body"><span class="who">${esc(v.who)} · ${v.plat}</span><h3>${esc(v.title)}</h3>
          ${v.views == null ? '<p class="updated">Métricas não coletadas nesta rede</p>' : `<div class="metrics"><div><b>${fmt(v.views)}</b><span>views</span></div>
            <div><b>${v.com == null ? 'sem dado' : fmt(v.com)}</b><span>comentários</span></div>
            <div><b>${r == null ? 'sem dado' : r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b><span>conversa</span></div></div>`}
          <p class="obs">${esc(v.obs)}</p>
          <div class="acts">${emb ? `<button class="btn" type="button" data-play>Assistir aqui</button>` : ''}
            <a class="btn ghost" href="${v.url}" target="_blank" rel="noopener">Abrir original</a></div></div></article>`;
    }).join('') : '<p class="empty">Nenhum vídeo neste filtro.</p>';

    /* o player só carrega no clique: página leve e sem rastreio das redes antes da hora */
    $('#gallery').querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
      const card = b.closest('.card'), v = V[+card.dataset.i];
      card.querySelector('.media').innerHTML =
        `<div class="embed"><iframe src="${embedUrl(v)}" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
      b.remove();
    });
  }
  $('#sort').value = store.get('fnr-sort', 'conv');
  $('#sort').onchange = () => { store.set('fnr-sort', $('#sort').value); renderGallery(); };
  renderLadder(); renderFilters(); renderGallery();

  /* benchmarks */
  const cols = [['who', 'Quem'], ['rede', 'Rede'], ['seg', 'Seguidores'], ['med', 'Views típicas'], ['ratio', 'Views ÷ seguidores'], ['tot', 'Vídeos no total'], ['deg', 'Degrau'], ['lic', 'O que ensina']];
  BENCH.forEach(b => b.ratio = b.med && b.seg ? b.med / b.seg * 100 : null);
  let key = 'ratio', dir = -1;
  function drawBench() {
    $('#bench thead').innerHTML = '<tr>' + cols.map(([k, n]) =>
      `<th aria-sort="${key === k ? (dir < 0 ? 'descending' : 'ascending') : 'none'}"><button data-k="${k}">${n}${key === k ? (dir < 0 ? ' ↓' : ' ↑') : '<span class="sorth" aria-hidden="true"> ↕</span>'}</button></th>`).join('') + '</tr>';
    const mx = Math.max(...BENCH.map(b => b.ratio || 0));
    const rows = BENCH.slice().sort((a, b) => {
      const x = a[key], y = b[key];
      if (x == null) return 1; if (y == null) return -1;
      return typeof x === 'number' ? (x - y) * dir : String(x).localeCompare(String(y)) * dir;
    });
    $('#bench tbody').innerHTML = rows.map(b => `<tr class="${b.me ? 'me' : ''}"><td><strong>${esc(b.who)}</strong></td><td>${b.rede}</td>
      <td class="num">${fmt(b.seg)}</td><td class="num">${fmt(b.med)}</td>
      <td class="num">${b.ratio == null ? 'sem dado' : '~' + Math.round(b.ratio) + '%<div class="meter"><i style="width:' + (b.ratio / mx * 100) + '%"></i></div>'}</td>
      <td class="num">${fmt(b.tot)}</td><td><span class="pill">${b.deg}</span></td><td>${esc(b.lic)}</td></tr>`).join('');
    $('#bench thead').querySelectorAll('button').forEach(bt => bt.onclick = () => {
      if (key === bt.dataset.k) dir = -dir; else { key = bt.dataset.k; dir = -1; }
      drawBench();
    });
  }
  drawBench();

  /* roteiros */
  let cur = store.get('fnr-script', 'conhecer');
  function renderScripts() {
    $('#stabs').innerHTML = SCRIPTS.map(s => `<button class="chip" data-id="${s.id}" aria-pressed="${cur === s.id}">${s.name}</button>`).join('');
    $('#stabs').querySelectorAll('.chip').forEach(b => b.onclick = () => { cur = b.dataset.id; store.set('fnr-script', cur); renderScripts(); });
    const s = SCRIPTS.find(x => x.id === cur) || SCRIPTS[0];
    $('#script').innerHTML = `<div class="script"><div><h3>${esc(s.title)}</h3><div class="meta"><span>Duração: ${s.dur}</span><span>·</span><span>${esc(s.where)}</span></div></div>
      <ol>${s.beats.map(b => `<li><span class="t">${esc(b[0])}</span><span>${esc(b[1])}</span></li>`).join('')}</ol>
      <button class="btn" id="cpScript" type="button">Copiar roteiro</button></div>`;
    $('#cpScript').onclick = () => copy(s.title + ' (' + s.dur + ')\n' + s.beats.map(b => b[0] + ': ' + b[1]).join('\n'));
  }
  renderScripts();

  /* checklist */
  function renderCheck() {
    const st = store.get('fnr-check', []);
    $('#checklist').innerHTML = CHECK.map((c, i) => `<label for="ck${i}"><input type="checkbox" id="ck${i}" ${st.includes(i) ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('');
    $('#prog').textContent = st.length + ' de ' + CHECK.length + (st.length === CHECK.length ? ' · pode postar' : '');
    $('#checklist').querySelectorAll('input').forEach((el, i) => el.onchange = () => {
      let s = store.get('fnr-check', []);
      s = el.checked ? [...new Set([...s, i])] : s.filter(x => x !== i);
      store.set('fnr-check', s); renderCheck();
    });
  }
  $('#resetCheck').onclick = () => { store.set('fnr-check', []); renderCheck(); };
  renderCheck();

  /* regras */
  $('#rules').innerHTML = RULES.map(r => `<div class="rule"><div class="do">${esc(r[0])}</div><div class="dont">${esc(r[1])}</div></div>`).join('');

  /* perguntas */
  $('#qs').innerHTML = QS.map((q, i) => `<div class="q"><strong>${esc(q[0])}</strong><span class="why">Avalia: ${esc(q[1])}</span>
    <textarea id="qa${i}" aria-label="Resposta da pergunta ${i + 1}" placeholder="Até 3 frases, do jeito que falaria no vídeo"></textarea>
    <div class="row"><button class="btn ghost" type="button" data-i="${i}">Copiar resposta</button></div></div>`).join('');
  QS.forEach((q, i) => { const ta = $('#qa' + i); ta.value = store.get('fnr-qa' + i, ''); ta.oninput = () => store.set('fnr-qa' + i, ta.value); });
  $('#qs').querySelectorAll('button').forEach(b => b.onclick = () => { const i = +b.dataset.i; copy(QS[i][0] + '\n' + $('#qa' + i).value); });
}

/* gráfico do diagnóstico: fotografia de 11/nov/2026, fixa de propósito (é a linha de base) */
function renderChart() {
  const rows = [['Selfie: dia de trabalho em Brasília', 1, 13900, 898], ['Teu discurso em evento', 1, 23700, 777], ['Selfie: Revoga LAP', 1, 16100, 488], ['Você com Fabio Porchat', 1, 57300, 1700], ['Recorte de discurso de outra pessoa', 0, 131000, 778], ['Print de tweet + CNN (SUS)', 0, 34500, 200], ['Print de tweet + TV (Eduardo)', 0, 102500, 413], ['Print de tweet + TV (Peña)', 0, 101800, 225], ['Meme de filmes, sem você', 0, 52400, 75]]
    .map(r => ({ l: r[0], f: r[1], p: r[2], c: r[3], r: r[3] / r[2] * 100 })).sort((a, b) => b.r - a.r);
  const mx = Math.max(...rows.map(r => r.r)), x0 = 270, w = 300, rh = 34, y0 = 20, H = y0 + rows.length * rh + 10;
  let s = `<svg viewBox="0 0 760 ${H}" role="img" aria-label="Comentários a cada 100 plays por reel" font-family="Archivo,system-ui,sans-serif" font-size="13">`;
  rows.forEach((r, i) => {
    const y = y0 + i * rh, bw = r.r / mx * w, c = r.f ? 'var(--accent)' : 'var(--muted)';
    s += `<text x="${x0 - 10}" y="${y + 15}" text-anchor="end" fill="var(--ink)">${esc(r.l)}</text>
      <rect x="${x0}" y="${y}" width="${bw}" height="20" rx="3" fill="${c}" fill-opacity="${r.f ? 1 : .45}"><title>${esc(r.l)}: ${r.c} comentários em ${r.p.toLocaleString('pt-BR')} plays</title></rect>
      <text x="${x0 + bw + 8}" y="${y + 15}" fill="var(--ink)" font-weight="600">${r.r.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</text>
      <text x="${x0 + bw + 42}" y="${y + 15}" fill="var(--muted)" font-size="12">${fmt(r.p)} plays</text>`;
  });
  $('#chart').innerHTML = `<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin-bottom:8px">
    <span><i style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px;margin-right:6px"></i>Você falando</span>
    <span><i style="display:inline-block;width:10px;height:10px;background:var(--muted);opacity:.45;border-radius:2px;margin-right:6px"></i>Sem você falando</span></div>` + s + '</svg>';
}

main().catch(e => {
  console.error(e);
  $('#gallery').innerHTML = `<p class="empty">Os dados não carregaram. Abra o site por um servidor (por exemplo, <code>python -m http.server</code>), e não direto pelo arquivo. Detalhe: ${esc(e.message)}</p>`;
});

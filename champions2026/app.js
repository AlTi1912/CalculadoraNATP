(function () {
  const D = window.CH26_DATA, M = window.CH26;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = (x, d = 1) => (x < 0.001 && x > 0 ? '<0,1%' : (x * 100).toFixed(d).replace('.', ',') + '%');
  const REG = { Americas: 'AMER', Pacific: 'PAC', EMEA: 'EMEA', China: 'CN' };
  const SEEDS = D.playoffs.equipos;

  function load(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }

  let opts = Object.assign({}, M.DEFAULTS, load('ch26-opts', {}));
  let resultados = load('ch26-resultados', {});
  let sel = { i: '100T', j: 'G2', bo: 3, match: 'UQ1' };
  let R = null;

  const tagHTML = (c) => `<span class="team"><span class="tag">${esc(c)}</span><span class="reg ${D.equipos[c].region}">${REG[D.equipos[c].region]}</span></span>`;

  // Participantes determinados por los resultados marcados
  function participantes() {
    const W = {}, L = {}, out = {};
    const pos = (s) => (s[0] === 'S' ? SEEDS[s[1]] : s[0] === 'W' ? W[s[1]] : L[s[1]]);
    for (const m of M.partidos(opts.cruzarInferior)) {
      const a = pos(m.a) || null, b = pos(m.b) || null;
      out[m.id] = [a, b];
      const r = resultados[m.id];
      if (a && b && r && (r.ganador === a || r.ganador === b)) { W[m.id] = r.ganador; L[m.id] = r.ganador === a ? b : a; }
    }
    return out;
  }
  function limpiarResultados() {
    const P = participantes();
    for (const id of Object.keys(resultados)) {
      const [a, b] = P[id] || [];
      if (!a || !b || (resultados[id].ganador !== a && resultados[id].ganador !== b)) delete resultados[id];
    }
    save('ch26-resultados', resultados);
  }

  // ---------- Cálculo ----------
  let timer = null;
  function recompute(delay) {
    clearTimeout(timer);
    $('app').classList.add('busy');
    timer = setTimeout(() => {
      R = M.calcular(D, opts, resultados);
      $('app').classList.remove('busy');
      render();
    }, delay == null ? 30 : delay);
  }

  function render() {
    renderStatus(); renderTitulo(); renderLlave(); renderAnalisis(); renderPickem(); renderGrupos();
  }

  function renderStatus() {
    const n = Object.keys(R.bloqueos).length;
    $('status').innerHTML = `<span>Datos al ${esc(D.hoy)} · ${D.grupos.length} series de grupos · ${D.h2h.length} series H2H de 2026</span>` +
      `<span>${n ? n + ' de 14 resultados marcados' : 'Ningún resultado de playoffs marcado'}</span>` +
      (n ? '<button class="btn" id="btn-reset">Borrar resultados</button>' : '');
    const b = $('btn-reset');
    if (b) b.onclick = () => { resultados = {}; save('ch26-resultados', resultados); recompute(); };
  }

  // ---------- Título ----------
  const PUESTOS = ['1°', '2°', '3°', '4°', '5-6°', '7-8°'];
  const PCOL = ['var(--gold)', 'color-mix(in srgb, var(--gold) 70%, var(--panel))', 'color-mix(in srgb, var(--gold) 48%, var(--panel))', 'color-mix(in srgb, var(--gold) 32%, var(--panel))', 'color-mix(in srgb, var(--muted) 40%, var(--panel))', 'color-mix(in srgb, var(--muted) 22%, var(--panel))'];

  function fuerza(F, c) {
    // % de mapas ganados contra un rival de fuerza media (theta = 0, sin mapa concreto)
    return M.mapWin(M.sig(F.theta[F.ix[c]]));
  }
  function renderTitulo() {
    const B = R.B, st = R.stats;
    const filas = SEEDS.map((c) => {
      const p = B.puesto[c];
      const top4 = p['1°'] + p['2°'] + p['3°'] + p['4°'];
      const final = p['1°'] + p['2°'];
      return { c, p, top4, final, title: p['1°'] };
    }).sort((a, b) => b.title - a.title);
    const maxT = Math.max(...filas.map((f) => f.title));
    const html = ['<thead><tr><th>Equipo</th><th>Grupos</th><th class="num">Rondas</th><th class="num" title="Probabilidad de ganar un mapa a un rival medio del torneo">Fuerza</th><th class="num">Top 4</th><th class="num">Final</th><th>Campeón</th><th>Puesto final</th></tr></thead><tbody>'];
    for (const f of filas) {
      const s = st[f.c];
      const fz = fuerza(R.F, f.c), fz0 = fuerza(R.F0, f.c);
      const dz = (fz - fz0) * 100;
      const dcls = dz > 0.05 ? 'delta-up' : dz < -0.05 ? 'delta-down' : 'muted';
      const rd = s.rw - s.rl;
      html.push(`<tr>
        <td>${tagHTML(f.c)}</td>
        <td class="mono">${s.sw}-${s.sl} · ${s.mw}-${s.ml} mapas</td>
        <td class="num">${rd > 0 ? '+' : ''}${rd}</td>
        <td class="num">${pct(fz)} <span class="${dcls}" title="Cambio respecto al previo de temporada">${dz >= 0 ? '+' : ''}${dz.toFixed(1).replace('.', ',')}</span></td>
        <td class="num">${pct(f.top4)}</td>
        <td class="num">${pct(f.final)}</td>
        <td><div class="cell-bar"><span class="num">${pct(f.title)}</span><div class="bar"><i style="width:${(f.title / maxT) * 100}%"></i></div></div></td>
        <td><div class="stack" title="${PUESTOS.map((k) => k + ' ' + pct(f.p[k])).join(' · ')}">${PUESTOS.map((k, q) => `<i style="width:${f.p[k] * 100}%;background:${PCOL[q]}"></i>`).join('')}</div></td>
      </tr>`);
    }
    html.push('</tbody>');
    $('tabla-titulo').innerHTML = html.join('');
    $('legend-puestos').innerHTML = PUESTOS.map((k, q) => `<span><b style="background:${PCOL[q]}"></b>${k}</span>`).join('') +
      '<span>· Fuerza: % de mapas que ganaría contra un rival medio; el número pequeño es el cambio por la fase de grupos.</span>';
  }

  // ---------- Llave ----------
  function matchCard(m, k) {
    const P = participantes();
    const [a, b] = P[m.id];
    const r = R.B.res[k];
    const lock = R.bloqueos[m.id];
    const selc = sel.match === m.id ? ' sel' : '';
    const head = `<div class="mh" data-open="${m.id}" role="button" tabindex="0"><span>${esc(m.nombre)}</span><span>Bo${m.bo}</span></div>`;
    if (a && b) {
      const p = R.S(a, b, m.bo).p;
      const slot = (t, q) => {
        const cls = lock ? (lock === t ? ' win' : ' lose') : '';
        return `<button class="slot${cls}" data-lock="${m.id}" data-team="${t}" title="Marcar a ${esc(D.equipos[t].nombre)} como ganador real">
          <span class="fill" style="width:${lock ? 0 : q * 100}%"></span>${tagHTML(t)}<span class="pct">${lock ? (lock === t ? 'ganó' : '') : pct(q, 0)}</span></button>`;
      };
      return `<div class="match${selc}${m.id === 'GF' ? ' gf' : ''}">${head}${slot(a, p)}${slot(b, 1 - p)}</div>`;
    }
    const cruces = Object.entries(r.cruces).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const gana = Object.entries(r.gana).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const known = a || b;
    return `<div class="match${selc}${m.id === 'GF' ? ' gf' : ''}">${head}<div class="maybe" data-open="${m.id}">
      ${known ? `<div class="row"><span class="lab">Ya clasificado</span><span class="tag">${esc(known)}</span></div>` : ''}
      <span class="lab">Cruces más probables</span>
      ${cruces.map(([c, v]) => `<div class="row"><span>${esc(c)}</span><span class="num">${pct(v)}</span></div>`).join('')}
      <span class="lab">Gana este partido</span>
      <div class="row"><span>${gana.map(([c, v]) => `${esc(c)} <span class="num muted">${pct(v, 0)}</span>`).join(' · ')}</span></div>
    </div></div>`;
  }

  function renderLlave() {
    const P = R.partidos;
    const by = Object.fromEntries(P.map((m, k) => [m.id, [m, k]]));
    const col = (title, ids) => `<div class="col"><div class="col-h">${title}</div>${ids.map((id) => matchCard(...by[id])).join('')}</div>`;
    $('bracket').innerHTML = `
      <div class="lane-title">Llave superior</div>
      <div class="lane">
        ${col('Cuartos · 7-8 oct', ['UQ1', 'UQ2', 'UQ3', 'UQ4'])}
        ${col('Semifinales · 10 oct', ['USF1', 'USF2'])}
        ${col('Final superior · 16 oct', ['UF'])}
        ${col('Gran final · 18 oct', ['GF'])}
      </div>
      <div class="lane-title">Llave inferior</div>
      <div class="lane">
        ${col('Ronda 1 · 9 oct', ['LR1A', 'LR1B'])}
        ${col('Ronda 2 · 11 oct', ['LR2A', 'LR2B'])}
        ${col('Ronda 3 · 16 oct', ['LR3'])}
        ${col('Final inferior · 17 oct', ['LF'])}
      </div>`;
    $('bracket').querySelectorAll('[data-lock]').forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.lock, t = el.dataset.team;
        if (resultados[id] && resultados[id].ganador === t) delete resultados[id];
        else resultados[id] = Object.assign({}, resultados[id], { ganador: t });
        limpiarResultados();
        abrirPartido(id, false);
        recompute();
      };
    });
    $('bracket').querySelectorAll('[data-open]').forEach((el) => {
      const go = () => { abrirPartido(el.dataset.open, true); renderLlave(); renderAnalisis(); };
      el.onclick = go;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
  }

  function abrirPartido(id, scroll) {
    const m = R.partidos.find((x) => x.id === id);
    const k = R.partidos.indexOf(m);
    const [a, b] = participantes()[id];
    let i = a, j = b;
    if (!i || !j) {
      const top = Object.entries(R.B.res[k].cruces).sort((x, y) => y[1] - x[1])[0];
      if (top) [i, j] = top[0].split(' vs ');
    }
    sel = { i, j, bo: m.bo, match: id };
    if (scroll) $('sec-analisis').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Análisis ----------
  function renderAnalisis() {
    const { i, j, bo } = sel;
    const s = R.S(i, j, bo), s0 = R.S0(i, j, bo);
    const st = R.stats;
    const P = participantes();
    const m = R.partidos.find((x) => x.id === sel.match);
    const real = m && P[m.id][0] && P[m.id][1] && [i, j].sort().join() === P[m.id].slice().sort().join();
    const opt = (cur) => SEEDS.map((c) => `<option value="${c}"${c === cur ? ' selected' : ''}>${esc(c)} · ${esc(D.equipos[c].nombre)}</option>`).join('');
    const ctx = m ? `${esc(m.nombre)}${real ? '' : ' · cruce hipotético'}` : 'Comparación libre';

    // Mapas
    const mapas = D.mapas.map((nm, k) => ({ nm, k, p: s.mapProbs[k], x: s.mapa[k] })).sort((a, b) => b.x.jugado - a.x.jugado);
    const gsMapa = (team, nm) => {
      const out = [];
      for (const se of st[team].series) for (const [mm, a, b] of se.mapas) if (mm === nm) out.push(`<span class="${a > b ? 'w' : 'l'}">${a}-${b}</span> ${esc(se.rival)}`);
      return out.join(', ') || '—';
    };
    const mapRows = mapas.map((r) => {
      const left = r.p >= 0.5 ? 50 : r.p * 100, w = Math.abs(r.p - 0.5) * 100;
      return `<tr>
        <td><b>${esc(r.nm)}</b><div class="gs">${esc(i)}: ${gsMapa(i, r.nm)}<br>${esc(j)}: ${gsMapa(j, r.nm)}</div></td>
        <td class="num">${pct(r.p, 0)}</td>
        <td><div class="mbar"><i style="left:${left}%;width:${w}%"></i></div></td>
        <td class="num">${pct(r.x.jugado, 0)}</td>
        <td class="gs">pick ${esc(i)} ${pct(r.x.pickI, 0)} · pick ${esc(j)} ${pct(r.x.pickJ, 0)} · decider ${pct(r.x.dec, 0)}<br>ban ${esc(i)} ${pct(r.x.banI, 0)} · ban ${esc(j)} ${pct(r.x.banJ, 0)}</td>
      </tr>`;
    }).join('');
    const sets = s.topSets.map((x) => `<div class="pick"><span>${x.maps.map((k) => D.mapas[k]).join(' · ')}</span><span class="num">${pct(x.p)}</span><span></span></div>`).join('');

    // H2H
    const H = s.h2h;
    const h2hRows = H.lista.map((x) => `<div class="h2h-row">
        <span class="mono muted">${esc(x.fecha)}${x.aprox ? ' ≈' : ''}</span>
        <span>${esc(x.evento)}${x.mapas ? `<div class="gs">${x.mapas.map(([mm, a, b]) => `<span class="${a > b ? 'w' : 'l'}">${esc(mm)} ${a}-${b}</span>`).join(' · ')}</div>` : ''}</span>
        <span class="sc">${esc(i)} ${x.mi}-${x.mj}</span>
        <span class="wt">${x.enAjuste ? 'en capa 1' : 'peso ' + x.peso.toFixed(2).replace('.', ',')}</span>
      </div>`).join('') || '<p class="note">Sin enfrentamientos en 2026.</p>';
    const gpts = (s.pPunto - s.pSinH2H) * 100;
    const h2hTxt = H.lista.some((x) => !x.enAjuste)
      ? `Mapas ponderados ${esc(i)} ${H.wi.toFixed(1).replace('.', ',')} – ${H.wj.toFixed(1).replace('.', ',')} ${esc(j)}. El modelo esperaba ${pct(H.p0)} de mapas para ${esc(i)}; con la contracción queda ${pct(H.phat)}. Efecto en la serie: ${gpts >= 0 ? '+' : ''}${gpts.toFixed(1).replace('.', ',')} pts.`
      : 'No hay series de 2026 fuera de Champions entre estos dos equipos: no se aplica ajuste.';

    const grp = (t) => st[t].series.map((se) => `<div class="gm"><span class="ph">${esc(se.fase)}</span><span>${se.ma > se.mb ? '<b class="delta-up">V</b>' : '<b class="delta-down">D</b>'} ${se.ma}-${se.mb} vs ${esc(se.rival)} <span class="gs">${se.mapas.map(([mm, a, b]) => `${esc(mm)} ${a}-${b}`).join(' · ')}</span></span></div>`).join('');

    const step = (k, v, d, cls) => `<div class="step${cls || ''}"><span class="k">${k}</span><span class="v">${pct(v)}</span><span class="d">${d}</span></div>`;
    const dif = (a, b) => { const x = (a - b) * 100; return `${x >= 0 ? '+' : ''}${x.toFixed(1).replace('.', ',')} pts`; };

    // Resultado real
    let resBox = '';
    if (real) {
      const [a, b] = P[m.id];
      const r = resultados[m.id] || {};
      const filas = [];
      const nmaps = m.bo;
      for (let q = 0; q < nmaps; q++) {
        const mm = (r.mapas || [])[q] || ['', '', ''];
        filas.push(`<div class="maprow"><span class="muted mono">M${q + 1}</span>
          <select id="rm-${q}" aria-label="Mapa ${q + 1}"><option value="">—</option>${D.mapas.map((x) => `<option${x === mm[0] ? ' selected' : ''}>${x}</option>`).join('')}</select>
          <input id="ra-${q}" type="number" min="0" max="40" inputmode="numeric" value="${mm[1] === '' ? '' : mm[1]}" aria-label="Rondas ${esc(a)}"><span class="mono">${esc(a)}</span>
          <input id="rb-${q}" type="number" min="0" max="40" inputmode="numeric" value="${mm[2] === '' ? '' : mm[2]}" aria-label="Rondas ${esc(b)}"><span class="mono">${esc(b)}</span></div>`);
      }
      resBox = `<div class="result-box">
        <h3>Resultado real</h3>
        <p class="note">Marca el ganador y, si quieres, los mapas. Los mapas se suman al ajuste como evidencia nueva y recalculan a todos los equipos.</p>
        <div class="maprows">${filas.join('')}</div>
        <div class="pickers"><button class="btn primary" id="res-save">Guardar resultado</button><button class="btn" id="res-del">Quitar resultado</button><span class="note" id="res-msg"></span></div>
      </div>`;
    }

    $('analisis').innerHTML = `
      <div class="pickers">
        <select id="sel-i" aria-label="Equipo 1">${opt(i)}</select><span class="muted">vs</span>
        <select id="sel-j" aria-label="Equipo 2">${opt(j)}</select>
        <div class="seg" role="group" aria-label="Formato"><button data-bo="3" aria-pressed="${bo === 3}">Bo3</button><button data-bo="5" aria-pressed="${bo === 5}">Bo5</button></div>
        <span class="pill${real ? ' on' : ''}">${ctx}</span>
      </div>
      <div class="verdict">
        <div class="names"><span>${tagHTML(i)}</span><span>${tagHTML(j)}</span></div>
        <div class="names"><span class="big">${pct(s.p)}</span><span class="big muted">${pct(1 - s.p)}</span></div>
        <div class="split"><div class="a" style="width:${s.p * 100}%"></div><div class="b" style="width:${(1 - s.p) * 100}%"></div></div>
      </div>
      <div class="chain">
        ${step('Previo de temporada', s0.pSinH2H, 'Solo el rating anterior a Champions')}
        ${step('+ Fase de grupos', s.pSinH2H, dif(s.pSinH2H, s0.pSinH2H) + ' por rondas y mapas en Shanghai')}
        ${step('+ Cara a cara', s.pPunto, dif(s.pPunto, s.pSinH2H) + (H.misma ? ' · misma región' : ' · interregional'))}
        ${step('Final', s.p, opts.incertidumbre ? dif(s.p, s.pPunto) + ' al promediar la incertidumbre' : 'Sin promediar incertidumbre', ' final')}
      </div>
      <div class="grid2">
        <div><h3>Mapas y veto</h3><div class="scroll"><table class="maps"><thead><tr><th>Mapa · grupos</th><th class="num">${esc(i)} gana</th><th></th><th class="num">Se juega</th><th>Veto</th></tr></thead><tbody>${mapRows}</tbody></table></div></div>
        <div style="display:grid;gap:22px;align-content:start">
          <div><h3>Combinaciones de mapas más probables</h3><div class="pick-list">${sets}</div></div>
          <div><h3>Cara a cara 2026</h3><p class="note" style="margin:6px 0">${h2hTxt}</p><div class="h2h-list">${h2hRows}</div></div>
        </div>
      </div>
      <div class="grid2">
        <div><h3>${esc(D.equipos[i].nombre)} en grupos</h3>${grp(i)}</div>
        <div><h3>${esc(D.equipos[j].nombre)} en grupos</h3>${grp(j)}</div>
      </div>
      ${resBox}`;

    $('sel-i').onchange = (e) => { sel = { ...sel, i: e.target.value, match: null }; if (sel.i === sel.j) sel.j = SEEDS.find((c) => c !== sel.i); renderLlave(); renderAnalisis(); };
    $('sel-j').onchange = (e) => { sel = { ...sel, j: e.target.value, match: null }; if (sel.i === sel.j) sel.i = SEEDS.find((c) => c !== sel.j); renderLlave(); renderAnalisis(); };
    $('analisis').querySelectorAll('[data-bo]').forEach((b) => (b.onclick = () => { sel = { ...sel, bo: +b.dataset.bo }; renderAnalisis(); }));
    if (real) {
      const [a, b] = P[m.id];
      $('res-save').onclick = () => {
        const mapas = [];
        let wa = 0, wb = 0;
        for (let q = 0; q < m.bo; q++) {
          const mm = $('rm-' + q).value, ra = parseInt($('ra-' + q).value, 10), rb = parseInt($('rb-' + q).value, 10);
          if (!mm || isNaN(ra) || isNaN(rb) || ra === rb) continue;
          mapas.push([mm, ra, rb]);
          if (ra > rb) wa++; else wb++;
        }
        let ganador = resultados[m.id] && resultados[m.id].ganador;
        if (mapas.length) ganador = wa > wb ? a : wb > wa ? b : ganador;
        if (!ganador) { $('res-msg').textContent = 'Marca el ganador en la llave o introduce los mapas.'; return; }
        resultados[m.id] = { ganador, mapas };
        limpiarResultados();
        recompute();
      };
      $('res-del').onclick = () => { delete resultados[m.id]; limpiarResultados(); recompute(); };
    }
  }

  // ---------- Pick'em ----------
  function renderPickem() {
    const B = R.B, P = R.partidos;
    const lista = (ganadores) => P.map((m, k) => {
      const t = ganadores[k];
      const v = B.res[k].gana[t] || 0;
      const fijo = R.bloqueos[m.id] ? ' ✓' : '';
      return `<div class="pick"><span>${esc(m.nombre)}</span><span class="tag">${esc(t)}${fijo}</span><span class="num">${pct(v)}</span></div>`;
    }).join('');
    $('pickem').innerHTML = `
      <div><h3>Pick'em óptimo</h3><p class="note" style="margin:6px 0">Llave coherente que maximiza los aciertos esperados: ${B.pickem.esperado.toFixed(2).replace('.', ',')} de 14. El porcentaje es la probabilidad de acertar ese pick.</p><div class="pick-list">${lista(B.pickem.ganadores)}</div></div>
      <div><h3>Llave más probable</h3><p class="note" style="margin:6px 0">El desenlace completo con mayor probabilidad conjunta (${pct(B.masProbable.p, 2)}). Sirve de referencia; para puntuar conviene la columna de la izquierda.</p><div class="pick-list">${lista(B.masProbable.ganadores)}</div></div>`;
  }

  // ---------- Grupos ----------
  function renderGrupos() {
    if ($('grupos').dataset.done) return;
    const g = {};
    for (const s of D.grupos) (g[s.g] = g[s.g] || []).push(s);
    $('grupos').innerHTML = Object.keys(g).sort().map((k) => `<div class="group"><h3>Grupo ${k}</h3>${g[k].map((s) => {
      let a = 0, b = 0; s.mapas.forEach(([, x, y]) => (x > y ? a++ : b++));
      return `<div class="gm"><span class="ph">${esc(s.fase)} · ${esc(s.fecha)}${s.aprox ? ' ≈' : ''}</span><span><b>${esc(s.a)}</b> ${a}-${b} <b>${esc(s.b)}</b> <span class="gs">${s.mapas.map(([m, x, y]) => `${esc(m)} ${x}-${y}`).join(' · ')}</span></span></div>`;
    }).join('')}</div>`).join('');
    $('grupos').dataset.done = '1';
  }

  // ---------- Ajustes ----------
  const AJUSTES = [
    { k: 'pesoGrupos', lab: 'Peso de la fase de grupos', min: 0, max: 2, step: 0.05, help: 'Fracción de cada ronda que cuenta como evidencia. 0 = ignorar Shanghai; 1 = cada ronda independiente.' },
    { k: 'escalaPrevio', lab: 'Holgura del previo', min: 0.5, max: 2.5, step: 0.05, help: 'Multiplica la incertidumbre del rating de temporada. Más alto = la fase de grupos manda más.' },
    { k: 'tauMapa', lab: 'Variación por mapa', min: 0.02, max: 0.2, step: 0.01, help: 'Cuánto puede diferir un equipo de un mapa a otro.' },
    { k: 'h2hPseudo', lab: 'Ancla del cara a cara (mapas)', min: 2, max: 40, step: 1, help: 'Menos mapas = el H2H pesa más.' },
    { k: 'h2hVidaMedia', lab: 'Vida media del H2H (días)', min: 20, max: 240, step: 5, help: 'Una serie de hace esta cantidad de días pesa la mitad.' },
    { k: 'h2hInterregional', lab: 'Peso H2H interregional', min: 0, max: 1, step: 0.05, help: 'Peso de los cruces entre regiones distintas (Masters, EWC) frente a los regionales.' },
    { k: 'h2hTope', lab: 'Tope del ajuste H2H', min: 0, max: 1, step: 0.05, help: 'Máximo efecto en logit de mapa.' },
    { k: 'vetoTemp', lab: 'Ruido del veto', min: 0, max: 1, step: 0.05, help: '0 = cada equipo banea y elige siempre lo óptimo según el modelo.' },
  ];
  function renderAjustes() {
    $('ajustes').innerHTML = AJUSTES.map((a) => `<label class="setting" for="aj-${a.k}">
        <span class="lab"><span>${a.lab}</span><span class="mono" id="v-${a.k}">${String(opts[a.k]).replace('.', ',')}</span></span>
        <input type="range" id="aj-${a.k}" min="${a.min}" max="${a.max}" step="${a.step}" value="${opts[a.k]}">
        <span class="help">${a.help}</span></label>`).join('') +
      `<div class="setting">
        <label class="check"><input type="checkbox" id="aj-incertidumbre"${opts.incertidumbre ? ' checked' : ''}> Promediar la incertidumbre de los ratings (acerca las series al 50%).</label>
        <label class="check"><input type="checkbox" id="aj-cruzarInferior"${opts.cruzarInferior ? ' checked' : ''}> Cruzar en la llave inferior: el perdedor de la semifinal superior 1 se cruza con el ganador de inferior 1·B.</label>
        <div><button class="btn" id="aj-reset">Valores por defecto</button></div>
      </div>`;
    AJUSTES.forEach((a) => {
      $('aj-' + a.k).oninput = (e) => {
        opts[a.k] = parseFloat(e.target.value);
        $('v-' + a.k).textContent = String(opts[a.k]).replace('.', ',');
        save('ch26-opts', opts);
        recompute(200);
      };
    });
    ['incertidumbre', 'cruzarInferior'].forEach((k) => ($('aj-' + k).onchange = (e) => {
      opts[k] = e.target.checked; save('ch26-opts', opts);
      if (k === 'cruzarInferior') limpiarResultados();
      recompute();
    }));
    $('aj-reset').onclick = () => { opts = Object.assign({}, M.DEFAULTS); save('ch26-opts', {}); renderAjustes(); recompute(); };
  }

  renderAjustes();
  R = M.calcular(D, opts, resultados);
  render();
})();

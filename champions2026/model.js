/*
 * Modelo de probabilidades para los playoffs de VALORANT Champions 2026.
 *
 * Capas:
 *  1. Fuerza base (theta, en logit de ronda): previo de temporada (Elo) + rondas jugadas en la
 *     fase de grupos, ajustadas por rival. Ajuste bayesiano conjunto de los 16 equipos.
 *  2. Pool de mapas (delta por equipo y mapa): desviación de cada equipo en cada mapa, con
 *     contracción fuerte hacia 0 porque hay pocos mapas por equipo.
 *  3. Cara a cara (gamma por pareja): series de 2026 entre los dos equipos, ponderadas por
 *     recencia, tipo de partido y si son de la misma región. Se compara lo ocurrido con lo
 *     que el modelo esperaba y se aplica solo la parte que sobrevive a la contracción.
 *  4. Veto: Bo3 (ban, ban, pick, pick, ban, ban, decider) y Bo5 (ban, ban, 4 picks, decider),
 *     con elecciones probabilísticas (softmax) y orden A/B 50/50.
 *  5. Serie: probabilidad de ganar la mayoría de mapas, promediando sobre la incertidumbre
 *     de los parámetros (muestras de la posterior).
 *  6. Llave: enumeración exacta de los 2^14 desenlaces de la doble eliminación.
 */
(function (root) {
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const logit = (p) => Math.log(p / (1 - p));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const DEFAULTS = {
    pesoGrupos: 0.6,      // fracción de cada ronda que cuenta como evidencia independiente
    escalaPrevio: 1.0,    // multiplica la sd del previo (más alto = el previo pesa menos)
    tauMapa: 0.12,        // sd previa de la desviación por mapa (logit de ronda)
    pesoMapasH2H: 0.5,    // peso de los mapas con marcador de series 2026 (solo para el pool de mapas)
    h2hPseudo: 10,        // mapas "virtuales" que anclan el H2H a la predicción del modelo
    h2hVidaMedia: 75,     // días para que una serie pese la mitad
    h2hInterregional: 0.5,// peso de un H2H entre regiones distintas
    h2hTope: 0.45,        // máximo ajuste H2H (logit de mapa)
    vetoTemp: 0.35,       // temperatura del veto (0 = veto perfecto y determinista)
    muestras: 300,        // muestras de la posterior por serie
    incertidumbre: true,
    cruzarInferior: true, // perdedores de semis superiores cruzan con la otra mitad
  };

  // ---------- Ronda -> mapa ----------
  function mapWin(p) {
    const q = 1 - p;
    let reg = 0, c = 1;
    for (let k = 0; k <= 11; k++) {
      if (k > 0) c = (c * (12 + k)) / k;
      reg += c * Math.pow(p, 13) * Math.pow(q, k);
    }
    const tie = 2704156 * Math.pow(p, 12) * Math.pow(q, 12); // C(24,12)
    return reg + tie * ((p * p) / (p * p + q * q));
  }
  function roundFromMap(pm) {
    let lo = 0.01, hi = 0.99;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (mapWin(mid) < pm) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // Tabla para acelerar mapWin dentro de las muestras (z = logit de ronda)
  const TAB_MIN = -2, TAB_PASO = 0.0005, TAB = [];
  for (let z = TAB_MIN; z <= -TAB_MIN + 1e-9; z += TAB_PASO) TAB.push(logit(Math.min(1 - 1e-12, Math.max(1e-12, mapWin(1 / (1 + Math.exp(-z)))))));
  function mapLogit(z) {
    const x = (z - TAB_MIN) / TAB_PASO;
    if (x <= 0) return TAB[0];
    if (x >= TAB.length - 1) return TAB[TAB.length - 1];
    const k = Math.floor(x), f = x - k;
    return TAB[k] + f * (TAB[k + 1] - TAB[k]);
  }
  const eloToTheta = (elo) => logit(roundFromMap(1 / (1 + Math.pow(10, -(elo - 1500) / 400))));

  // ---------- Utilidades ----------
  function days(a, b) { return (Date.parse(b) - Date.parse(a)) / 86400000; }
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    const u = Math.max(r(), 1e-12), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function invert(A) {
    const n = A.length, M = A.map((row, i) => row.concat(row.map((_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((row) => row.slice(n));
  }
  function majority(ps) {
    if (ps.length === 3) {
      const [a, b, c] = ps;
      return a * b + a * (1 - b) * c + (1 - a) * b * c;
    }
    // P(ganar más de la mitad de los mapas) = P(ganar la serie al mejor de n)
    let dist = [1];
    for (const p of ps) {
      const nd = new Array(dist.length + 1).fill(0);
      dist.forEach((v, k) => { nd[k] += v * (1 - p); nd[k + 1] += v * p; });
      dist = nd;
    }
    const need = Math.floor(ps.length / 2) + 1;
    let s = 0;
    for (let k = need; k < dist.length; k++) s += dist[k];
    return s;
  }

  // ---------- Capa 1 + 2: ajuste conjunto ----------
  function observaciones(data, extra, o) {
    const obs = [];
    const push = (a, b, mapas, peso, soloMapa) => {
      for (const [m, ra, rb] of mapas) {
        const mi = data.mapas.indexOf(m);
        if (mi < 0 || !(ra + rb > 0)) continue;
        obs.push({ a, b, m: mi, ra, rb, w: peso, soloMapa });
      }
    };
    data.grupos.forEach((s) => push(s.a, s.b, s.mapas, 1, false));
    (extra || []).forEach((s) => push(s.a, s.b, s.mapas, 1, false));
    // Mapas con marcador de la temporada: informan el pool de mapas, no la fuerza general
    // (esa ya está en el previo y en la capa de cara a cara).
    if (o && o.pesoMapasH2H > 0) {
      for (const s of data.h2h) {
        if (!s.mapas) continue;
        const w = o.pesoMapasH2H * Math.pow(0.5, Math.max(0, days(s.fecha, data.hoy)) / o.h2hVidaMedia);
        push(s.a, s.b, s.mapas, w, true);
      }
    }
    return obs;
  }

  function fit(data, opts, extra) {
    const o = Object.assign({}, DEFAULTS, opts);
    const codes = Object.keys(data.equipos);
    const T = codes.length, M = data.mapas.length;
    const ix = Object.fromEntries(codes.map((c, i) => [c, i]));
    const mu = codes.map((c) => eloToTheta(data.equipos[c].elo));
    const pv = codes.map((c) => Math.pow(data.equipos[c].sd * o.escalaPrevio, 2));
    const tau2 = o.tauMapa * o.tauMapa;
    const obs = observaciones(data, extra, o).map((x) => ({ ...x, a: ix[x.a], b: ix[x.b] }));
    const theta = mu.slice();
    const delta = new Float64Array(T * M);
    let H;

    for (let it = 0; it < 80; it++) {
      // Paso de Newton para theta (Hessiano completo)
      const g = theta.map((t, i) => -(t - mu[i]) / pv[i]);
      H = codes.map((_, i) => codes.map((__, j) => (i === j ? 1 / pv[i] : 0)));
      for (const x of obs) {
        if (x.soloMapa) continue;
        const z = theta[x.a] - theta[x.b] + delta[x.a * M + x.m] - delta[x.b * M + x.m];
        const s = sig(z), n = x.ra + x.rb, k = o.pesoGrupos * x.w;
        const gr = k * (x.ra - n * s), h = k * n * s * (1 - s);
        g[x.a] += gr; g[x.b] -= gr;
        H[x.a][x.a] += h; H[x.b][x.b] += h; H[x.a][x.b] -= h; H[x.b][x.a] -= h;
      }
      const Hi = invert(H);
      let mov = 0;
      for (let i = 0; i < T; i++) {
        let st = 0;
        for (let j = 0; j < T; j++) st += Hi[i][j] * g[j];
        theta[i] += st; mov = Math.max(mov, Math.abs(st));
      }
      // Paso diagonal para delta
      const gd = new Float64Array(T * M), hd = new Float64Array(T * M);
      for (let q = 0; q < T * M; q++) { gd[q] = -delta[q] / tau2; hd[q] = 1 / tau2; }
      for (const x of obs) {
        const qa = x.a * M + x.m, qb = x.b * M + x.m;
        const s = sig(theta[x.a] - theta[x.b] + delta[qa] - delta[qb]);
        const n = x.ra + x.rb, k = o.pesoGrupos * x.w;
        const gr = k * (x.ra - n * s), h = k * n * s * (1 - s);
        gd[qa] += gr; gd[qb] -= gr; hd[qa] += h; hd[qb] += h;
      }
      for (let q = 0; q < T * M; q++) { const st = gd[q] / hd[q]; delta[q] += st; mov = Math.max(mov, Math.abs(st)); }
      if (mov < 1e-7) break;
    }

    const Hi = invert(H);
    const thetaSd = codes.map((_, i) => Math.sqrt(Hi[i][i]));
    const deltaSd = new Float64Array(T * M);
    const info = new Float64Array(T * M).fill(1 / tau2);
    for (const x of obs) {
      const qa = x.a * M + x.m, qb = x.b * M + x.m;
      const s = sig(theta[x.a] - theta[x.b] + delta[qa] - delta[qb]);
      const h = o.pesoGrupos * x.w * (x.ra + x.rb) * s * (1 - s);
      info[qa] += h; info[qb] += h;
    }
    for (let q = 0; q < T * M; q++) deltaSd[q] = 1 / Math.sqrt(info[q]);

    return { codes, ix, mu, theta, thetaSd, delta, deltaSd, M, opts: o, data, extra: extra || [] };
  }

  // Estadística de la fase de grupos por equipo
  function statsGrupos(data, extra) {
    const st = {};
    for (const c of Object.keys(data.equipos)) st[c] = { sw: 0, sl: 0, mw: 0, ml: 0, rw: 0, rl: 0, series: [] };
    const all = data.grupos.concat((extra || []).map((e) => ({ ...e, fase: 'Playoffs' })));
    for (const s of all) {
      let ma = 0, mb = 0;
      for (const [, ra, rb] of s.mapas) {
        if (ra > rb) ma++; else mb++;
        st[s.a].rw += ra; st[s.a].rl += rb; st[s.b].rw += rb; st[s.b].rl += ra;
      }
      st[s.a].mw += ma; st[s.a].ml += mb; st[s.b].mw += mb; st[s.b].ml += ma;
      if (ma > mb) { st[s.a].sw++; st[s.b].sl++; } else { st[s.b].sw++; st[s.a].sl++; }
      st[s.a].series.push({ rival: s.b, ma, mb, fase: s.fase, mapas: s.mapas });
      st[s.b].series.push({ rival: s.a, ma: mb, mb: ma, fase: s.fase, mapas: s.mapas.map(([m, a, b]) => [m, b, a]) });
    }
    return st;
  }

  // ---------- Capa 3: cara a cara ----------
  function mapProbsPoint(F, i, j, gamma) {
    const a = F.ix[i], b = F.ix[j], M = F.M;
    const out = [];
    for (let m = 0; m < M; m++) {
      const z = F.theta[a] - F.theta[b] + F.delta[a * M + m] - F.delta[b * M + m];
      out.push(sig(logit(mapWin(sig(z))) + (gamma || 0)));
    }
    return out;
  }

  function h2h(F, i, j) {
    const o = F.opts, data = F.data;
    const misma = data.equipos[i].region === data.equipos[j].region;
    const p0v = mapProbsPoint(F, i, j, 0);
    const p0 = p0v.reduce((s, x) => s + x, 0) / p0v.length;
    let wi = 0, wj = 0;
    const lista = [];
    for (const s of data.h2h) {
      let mi, mj;
      if (s.a === i && s.b === j) { mi = s.ma; mj = s.mb; }
      else if (s.a === j && s.b === i) { mi = s.mb; mj = s.ma; }
      else continue;
      const edad = Math.max(0, days(s.fecha, data.hoy));
      const w = Math.pow(0.5, edad / o.h2hVidaMedia) * (s.tipo === 'liga' ? 0.8 : 1) * (misma ? 1 : o.h2hInterregional);
      wi += w * mi; wj += w * mj;
      lista.push({ ...s, mi, mj, peso: w, enAjuste: false });
    }
    // Series de Champions (fase de grupos o playoffs ya jugados): ya están en la capa 1.
    const champs = data.grupos.concat(F.extra.map((e) => ({ ...e, fase: e.fase || 'Playoffs' })));
    for (const s of champs) {
      if (!((s.a === i && s.b === j) || (s.a === j && s.b === i))) continue;
      const flip = s.a === j;
      let mi = 0, mj = 0;
      for (const [, ra, rb] of s.mapas) { const w = flip ? rb > ra : ra > rb; if (w) mi++; else mj++; }
      lista.push({ fecha: s.fecha, evento: 'Champions 2026 · ' + (s.g ? 'Grupo ' + s.g + ' · ' : '') + s.fase, tipo: 'champions', mi, mj, peso: 0, enAjuste: true,
        mapas: s.mapas.map(([m, a, b]) => (flip ? [m, b, a] : [m, a, b])) });
    }
    lista.sort((x, y) => (x.fecha < y.fecha ? 1 : -1));
    const n = wi + wj;
    const phat = (wi + o.h2hPseudo * p0) / (n + o.h2hPseudo);
    const gamma = n > 0 ? clamp(logit(phat) - logit(p0), -o.h2hTope, o.h2hTope) : 0;
    return { gamma, p0, phat, wi, wj, misma, lista };
  }

  // ---------- Capa 4: veto ----------
  const SECUENCIAS = {
    3: [['ban', 0], ['ban', 1], ['pick', 0], ['pick', 1], ['ban', 0], ['ban', 1], ['dec']],
    5: [['ban', 0], ['ban', 1], ['pick', 0], ['pick', 1], ['pick', 0], ['pick', 1], ['dec']],
  };
  // v[m] = P(i gana m). first = 0 si i actúa como equipo A.
  function veto(v, bo, temp, first) {
    // Programación dinámica sobre estados (mapas retirados, mapas elegidos): 3^7 estados como máximo.
    const M = v.length, seq = SECUENCIAS[bo];
    const mapa = Array.from({ length: M }, () => ({ banI: 0, banJ: 0, pickI: 0, pickJ: 0, dec: 0 }));
    const val = v.map((p) => logit(clamp(p, 1e-6, 1 - 1e-6)));
    let estados = new Map([[0, 1]]); // clave = retirados * 128 + elegidos
    for (const [acc, who] of seq) {
      const sig2 = new Map();
      for (const [key, prob] of estados) {
        const out = Math.floor(key / 128), picked = key % 128;
        const avail = [];
        for (let m = 0; m < M; m++) if (!(out & (1 << m))) avail.push(m);
        if (acc === 'dec') {
          const m = avail[0];
          mapa[m].dec += prob;
          const set = picked | (1 << m);
          sig2.set(set, (sig2.get(set) || 0) + prob);
          continue;
        }
        const actorI = (who === 0) === (first === 0);
        const sc = avail.map((m) => (acc === 'pick' ? 1 : -1) * (actorI ? val[m] : -val[m]));
        const mx = Math.max(...sc);
        let w;
        if (temp <= 1e-6) {
          const k = sc.filter((x) => x === mx).length;
          w = sc.map((x) => (x === mx ? 1 / k : 0));
        } else {
          const e = sc.map((x) => Math.exp((x - mx) / temp));
          const t = e.reduce((a, b) => a + b, 0);
          w = e.map((x) => x / t);
        }
        const field = acc === 'ban' ? (actorI ? 'banI' : 'banJ') : actorI ? 'pickI' : 'pickJ';
        avail.forEach((m, k) => {
          if (w[k] < 1e-12) return;
          const p = prob * w[k];
          mapa[m][field] += p;
          const nk = (out | (1 << m)) * 128 + (acc === 'pick' ? picked | (1 << m) : picked);
          sig2.set(nk, (sig2.get(nk) || 0) + p);
        });
      }
      estados = sig2;
    }
    const sets = new Map();
    for (const [mask, p] of estados) {
      const maps = [];
      for (let m = 0; m < M; m++) if (mask & (1 << m)) maps.push(m);
      sets.set(maps.join(','), p);
    }
    return { sets, mapa };
  }

  // ---------- Capa 5: serie ----------
  function draws(F, n, seed) {
    const r = rng(seed);
    const T = F.codes.length, M = F.M, out = [];
    for (let k = 0; k < n; k++) {
      const th = new Float64Array(T), de = new Float64Array(T * M);
      for (let i = 0; i < T; i++) th[i] = F.theta[i] + F.thetaSd[i] * gauss(r);
      for (let q = 0; q < T * M; q++) de[q] = F.delta[q] + F.deltaSd[q] * gauss(r);
      out.push({ th, de });
    }
    return out;
  }

  function serie(F, i, j, bo, D) {
    const o = F.opts;
    const H = h2h(F, i, j);
    const v = mapProbsPoint(F, i, j, H.gamma);
    const A = veto(v, bo, o.vetoTemp, 0), B = veto(v, bo, o.vetoTemp, 1);
    const sets = new Map();
    for (const S of [A.sets, B.sets]) for (const [k, p] of S) sets.set(k, (sets.get(k) || 0) + p / 2);
    const setList = [...sets].map(([k, p]) => ({ maps: k.split(',').map(Number), p }));
    const mapa = A.mapa.map((x, m) => {
      const y = B.mapa[m];
      const r = {};
      for (const f of Object.keys(x)) r[f] = (x[f] + y[f]) / 2;
      r.jugado = r.pickI + r.pickJ + r.dec;
      return r;
    });
    const evalSets = (pm) => setList.reduce((s, x) => s + x.p * majority(x.maps.map((m) => pm[m])), 0);
    const pPunto = evalSets(v);
    let p = pPunto;
    if (o.incertidumbre && D && D.length) {
      const a = F.ix[i], b = F.ix[j], M = F.M;
      let acc = 0;
      for (const d of D) {
        const pm = [];
        for (let m = 0; m < M; m++) {
          const z = d.th[a] - d.th[b] + d.de[a * M + m] - d.de[b * M + m];
          pm.push(sig(mapLogit(z) + H.gamma));
        }
        acc += evalSets(pm);
      }
      p = acc / D.length;
    }
    // Probabilidad sin H2H para mostrar el efecto de la capa 3
    const v0 = mapProbsPoint(F, i, j, 0);
    const pSinH2H = evalSets(v0);
    const top = setList.sort((x, y) => y.p - x.p).slice(0, 5);
    return { i, j, bo, p, pPunto, pSinH2H, h2h: H, mapProbs: v, mapa, topSets: top };
  }

  // ---------- Capa 6: llave ----------
  function partidos(cruzar) {
    return [
      { id: 'UQ1', pts: 10, nombre: 'Superior R1 · 1', bo: 3, a: ['S', 0], b: ['S', 1] },
      { id: 'UQ2', pts: 10, nombre: 'Superior R1 · 2', bo: 3, a: ['S', 2], b: ['S', 3] },
      { id: 'UQ3', pts: 10, nombre: 'Superior R1 · 3', bo: 3, a: ['S', 4], b: ['S', 5] },
      { id: 'UQ4', pts: 10, nombre: 'Superior R1 · 4', bo: 3, a: ['S', 6], b: ['S', 7] },
      { id: 'USF1', pts: 15, nombre: 'Superior R2 · 1', bo: 3, a: ['W', 'UQ1'], b: ['W', 'UQ2'] },
      { id: 'USF2', pts: 15, nombre: 'Superior R2 · 2', bo: 3, a: ['W', 'UQ3'], b: ['W', 'UQ4'] },
      { id: 'LR1A', pts: 15, nombre: 'Inferior R1 · 1', bo: 3, a: ['L', 'UQ1'], b: ['L', 'UQ2'] },
      { id: 'LR1B', pts: 15, nombre: 'Inferior R1 · 2', bo: 3, a: ['L', 'UQ3'], b: ['L', 'UQ4'] },
      { id: 'UF', pts: 20, nombre: 'Final superior', bo: 3, a: ['W', 'USF1'], b: ['W', 'USF2'] },
      { id: 'LR2A', pts: 20, nombre: 'Inferior R2 · 1', bo: 3, a: ['L', 'USF1'], b: ['W', cruzar ? 'LR1B' : 'LR1A'] },
      { id: 'LR2B', pts: 20, nombre: 'Inferior R2 · 2', bo: 3, a: ['L', 'USF2'], b: ['W', cruzar ? 'LR1A' : 'LR1B'] },
      { id: 'LR3', pts: 30, nombre: 'Inferior semifinal', bo: 3, a: ['W', 'LR2A'], b: ['W', 'LR2B'] },
      { id: 'LF', pts: 40, nombre: 'Final inferior', bo: 5, a: ['L', 'UF'], b: ['W', 'LR3'] },
      { id: 'GF', pts: 50, nombre: 'Gran final', bo: 5, a: ['W', 'UF'], b: ['W', 'LF'] },
    ];
  }

  const PUESTOS = { GF: ['1°', '2°'], LF: [null, '3°'], LR3: [null, '4°'], LR2A: [null, '5-6°'], LR2B: [null, '5-6°'], LR1A: [null, '7-8°'], LR1B: [null, '7-8°'] };

  // S(i, j, bo) -> P(i gana). bloqueos: { id: codigoGanador }
  function llave(seeds, S, cruzar, bloqueos, pickemFijo) {
    const ptsDist = {};
    const P = partidos(cruzar);
    const K = P.length;
    const pos = Object.fromEntries(P.map((m, k) => [m.id, k]));
    const res = P.map(() => ({ aparece: {}, gana: {}, cruces: {} }));
    const puesto = {};
    seeds.forEach((t) => (puesto[t] = { '1°': 0, '2°': 0, '3°': 0, '4°': 0, '5-6°': 0, '7-8°': 0 }));
    const W = new Array(K), L = new Array(K);
    let mejor = { p: -1, w: null };
    const quien = (src) => (src[0] === 'S' ? seeds[src[1]] : src[0] === 'W' ? W[pos[src[1]]] : L[pos[src[1]]]);
    const add = (o, k, v) => (o[k] = (o[k] || 0) + v);
    let total = 0;
    (function rec(k, prob) {
      if (prob === 0) return;
      if (k === K) {
        total += prob;
        for (let q = 0; q < K; q++) {
          const id = P[q].id, a = quien(P[q].a), b = quien(P[q].b);
          add(res[q].aparece, a, prob); add(res[q].aparece, b, prob);
          add(res[q].gana, W[q], prob);
          add(res[q].cruces, [a, b].sort().join(' vs '), prob);
          if (PUESTOS[id]) {
            const [pw, pl] = PUESTOS[id];
            if (pw) puesto[W[q]][pw] += prob;
            if (pl) puesto[L[q]][pl] += prob;
          }
        }
        if (prob > mejor.p) mejor = { p: prob, w: W.slice() };
        if (pickemFijo) {
          let pts = 0;
          for (let q = 0; q < K; q++) if (W[q] === pickemFijo[q]) pts += P[q].pts;
          ptsDist[pts] = (ptsDist[pts] || 0) + prob;
        }
        return;
      }
      const a = quien(P[k].a), b = quien(P[k].b);
      const lock = bloqueos && bloqueos[P[k].id];
      const pa = lock === a ? 1 : lock === b ? 0 : S(a, b, P[k].bo);
      W[k] = a; L[k] = b; rec(k + 1, prob * pa);
      W[k] = b; L[k] = a; rec(k + 1, prob * (1 - pa));
    })(0, 1);

    // normalizar por si los bloqueos son incoherentes
    const norm = total > 0 ? 1 / total : 0;
    for (const r of res) for (const o of [r.aparece, r.gana, r.cruces]) for (const k in o) o[k] *= norm;
    for (const t in puesto) for (const k in puesto[t]) puesto[t][k] *= norm;

    // Pick'em óptimo: maximiza los puntos esperados (puntos por partido del pick'em oficial) sobre llaves coherentes
    let opt = { s: -1, w: null };
    (function rec2(k, s) {
      if (k === K) { if (s > opt.s) opt = { s, w: W.slice() }; return; }
      const a = quien(P[k].a), b = quien(P[k].b);
      const lock = bloqueos && bloqueos[P[k].id];
      for (const [w, l] of [[a, b], [b, a]]) {
        if (lock && lock !== w && (lock === a || lock === b)) continue;
        W[k] = w; L[k] = l;
        rec2(k + 1, s + P[k].pts * (res[k].gana[w] || 0));
      }
    })(0, 0);

    return { partidos: P, res, puesto, masProbable: { p: mejor.p * norm, ganadores: mejor.w }, pickem: { esperado: opt.s, maximo: P.reduce((t, m) => t + m.pts, 0), ganadores: opt.w } };
  }

  // ---------- Orquestación ----------
  function calcular(data, opts, resultados) {
    const o = Object.assign({}, DEFAULTS, opts);
    const seeds = data.playoffs.equipos;
    const P = partidos(o.cruzarInferior);
    const extra = [];
    const bloqueos = {};
    // Resultados de playoffs introducidos por el usuario: participantes resueltos en orden
    const W = {}, L = {};
    const pos = (src) => (src[0] === 'S' ? seeds[src[1]] : src[0] === 'W' ? W[src[1]] : L[src[1]]);
    for (const m of P) {
      const r = resultados && resultados[m.id];
      const a = pos(m.a), b = pos(m.b);
      if (!r || !a || !b || (r.ganador !== a && r.ganador !== b)) continue;
      bloqueos[m.id] = r.ganador;
      W[m.id] = r.ganador; L[m.id] = r.ganador === a ? b : a;
      if (r.mapas && r.mapas.length) extra.push({ a, b, fecha: r.fecha || data.hoy, fase: 'Playoffs · ' + m.nombre, mapas: r.mapas });
    }
    const F = fit(data, o, extra);
    const F0 = fit(data, Object.assign({}, o, { pesoGrupos: 0 }), []); // solo el previo de temporada
    const D = o.incertidumbre ? draws(F, o.muestras, 20261005) : null;
    const cache = new Map();
    const S = (i, j, bo) => {
      const key = i + '|' + j + '|' + bo;
      if (!cache.has(key)) {
        cache.set(key, serie(F, i, j, bo, D));
      }
      return cache.get(key);
    };
    const cache0 = new Map();
    const S0 = (i, j, bo) => {
      const key = i + '|' + j + '|' + bo;
      if (!cache0.has(key)) cache0.set(key, serie(F0, i, j, bo, null));
      return cache0.get(key);
    };
    const B = llave(seeds, (i, j, bo) => S(i, j, bo).p, o.cruzarInferior, bloqueos);
    return { F, F0, S, S0, B, bloqueos, extra, partidos: P, stats: statsGrupos(data, extra), opts: o };
  }

  const API = { DEFAULTS, mapWin, roundFromMap, eloToTheta, fit, h2h, veto, serie, llave, partidos, calcular, statsGrupos, majority, sig, logit };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CH26 = API;
})(typeof window !== 'undefined' ? window : globalThis);

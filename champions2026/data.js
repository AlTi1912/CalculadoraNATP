/*
 * Datos de VALORANT Champions 2026 (Shanghai) y cara a cara de la temporada 2026.
 * Fuentes: vlr.gg, Liquipedia, esports.gg, sheepesports, dotesports, thespike (ver README).
 * Las entradas con `aprox: true` tienen fecha o marcador de mapas estimado.
 * Para corregir un dato basta con editar este archivo: el modelo se recalcula solo.
 */
(function (root) {
  const DATA = {
    hoy: '2026-10-05',
    mapas: ['Abyss', 'Ascent', 'Haven', 'Lotus', 'Split', 'Summit', 'Sunset'],

    // elo: rating previo a Champions (escala de mapa, 1500 = equipo medio del torneo),
    // calibrado con Santiago, London, EWC y Stage 2. sd: incertidumbre del previo
    // (en logit de ronda); mayor para equipos con poco historial internacional.
    equipos: {
      '100T': { nombre: '100 Thieves',        region: 'Americas', elo: 1640, sd: 0.10 },
      'NS':   { nombre: 'Nongshim RedForce',  region: 'Pacific',  elo: 1600, sd: 0.10 },
      'PRX':  { nombre: 'Paper Rex',          region: 'Pacific',  elo: 1595, sd: 0.10 },
      'NRG':  { nombre: 'NRG',                region: 'Americas', elo: 1575, sd: 0.10 },
      'EDG':  { nombre: 'EDward Gaming',      region: 'China',    elo: 1560, sd: 0.10 },
      'KC':   { nombre: 'Karmine Corp',       region: 'EMEA',     elo: 1555, sd: 0.13 },
      'TYL':  { nombre: 'TYLOO',              region: 'China',    elo: 1550, sd: 0.13 },
      'GE':   { nombre: 'Global Esports',     region: 'Pacific',  elo: 1545, sd: 0.13 },
      'VIT':  { nombre: 'Team Vitality',      region: 'EMEA',     elo: 1545, sd: 0.10 },
      'TL':   { nombre: 'Team Liquid',        region: 'EMEA',     elo: 1530, sd: 0.13 },
      'G2':   { nombre: 'G2 Esports',         region: 'Americas', elo: 1530, sd: 0.10 },
      'LOUD': { nombre: 'LOUD',               region: 'Americas', elo: 1530, sd: 0.13 },
      'XLG':  { nombre: 'Xi Lai Gaming',      region: 'China',    elo: 1525, sd: 0.10 },
      'JDG':  { nombre: 'JD Gaming',          region: 'China',    elo: 1515, sd: 0.13 },
      'T1':   { nombre: 'T1',                 region: 'Pacific',  elo: 1515, sd: 0.13 },
      'FUT':  { nombre: 'FUT Esports',        region: 'EMEA',     elo: 1510, sd: 0.10 },
    },

    // Fase de grupos (formato GSL, todo Bo3). Mapas: [mapa, rondas equipo a, rondas equipo b].
    grupos: [
      { g: 'A', fase: 'Apertura',     fecha: '2026-09-27', a: '100T', b: 'T1',   mapas: [['Summit', 13, 8], ['Ascent', 13, 9]] },
      { g: 'A', fase: 'Apertura',     fecha: '2026-09-27', a: 'FUT',  b: 'JDG',  mapas: [['Ascent', 13, 1], ['Summit', 13, 8]] },
      { g: 'A', fase: 'Ganadores',    fecha: '2026-09-30', a: '100T', b: 'FUT',  mapas: [['Split', 13, 5], ['Lotus', 13, 10]] },
      { g: 'A', fase: 'Eliminación',  fecha: '2026-10-02', a: 'T1',   b: 'JDG',  mapas: [['Lotus', 13, 11], ['Abyss', 8, 13], ['Haven', 13, 5]] },
      { g: 'A', fase: 'Decisivo',     fecha: '2026-10-04', a: 'T1',   b: 'FUT',  mapas: [['Sunset', 13, 10], ['Ascent', 13, 10]] },

      { g: 'B', fase: 'Apertura',     fecha: '2026-09-26', a: 'VIT',  b: 'GE',   mapas: [['Abyss', 13, 10], ['Ascent', 9, 13], ['Summit', 13, 11]] },
      { g: 'B', fase: 'Apertura',     fecha: '2026-09-26', a: 'LOUD', b: 'EDG',  mapas: [['Lotus', 13, 8], ['Summit', 13, 5]] },
      { g: 'B', fase: 'Ganadores',    fecha: '2026-09-30', a: 'VIT',  b: 'LOUD', mapas: [['Ascent', 13, 7], ['Summit', 19, 17]] },
      { g: 'B', fase: 'Eliminación',  fecha: '2026-10-02', a: 'GE',   b: 'EDG',  mapas: [['Summit', 13, 5], ['Sunset', 13, 6]] },
      { g: 'B', fase: 'Decisivo',     fecha: '2026-10-04', a: 'LOUD', b: 'GE',   mapas: [['Split', 13, 8], ['Sunset', 13, 9]] },

      { g: 'C', fase: 'Apertura',     fecha: '2026-09-25', a: 'PRX',  b: 'TL',   mapas: [['Ascent', 13, 4], ['Haven', 7, 13], ['Lotus', 13, 10]] },
      { g: 'C', fase: 'Apertura',     fecha: '2026-09-25', a: 'G2',   b: 'TYL',  mapas: [['Lotus', 13, 6], ['Sunset', 13, 3]] },
      { g: 'C', fase: 'Ganadores',    fecha: '2026-09-29', a: 'PRX',  b: 'G2',   mapas: [['Split', 9, 13], ['Haven', 13, 11], ['Lotus', 13, 9]] },
      // Marcador de Summit no confirmado (TYLOO lo ganó): se usa 13-10.
      { g: 'C', fase: 'Eliminación',  fecha: '2026-10-01', a: 'TL',   b: 'TYL',  mapas: [['Split', 13, 8], ['Summit', 10, 13], ['Lotus', 13, 2]], aprox: true },
      { g: 'C', fase: 'Decisivo',     fecha: '2026-10-03', a: 'G2',   b: 'TL',   mapas: [['Split', 13, 10], ['Abyss', 13, 7]] },

      { g: 'D', fase: 'Apertura',     fecha: '2026-09-26', a: 'NRG',  b: 'NS',   mapas: [['Lotus', 13, 5], ['Split', 13, 10]] },
      { g: 'D', fase: 'Apertura',     fecha: '2026-09-26', a: 'KC',   b: 'XLG',  mapas: [['Sunset', 13, 3], ['Abyss', 13, 6]] },
      { g: 'D', fase: 'Ganadores',    fecha: '2026-09-30', a: 'NRG',  b: 'KC',   mapas: [['Ascent', 7, 13], ['Summit', 13, 11], ['Haven', 13, 9]] },
      { g: 'D', fase: 'Eliminación',  fecha: '2026-10-01', a: 'NS',   b: 'XLG',  mapas: [['Summit', 13, 11], ['Sunset', 13, 11]] },
      { g: 'D', fase: 'Decisivo',     fecha: '2026-10-03', a: 'NS',   b: 'KC',   mapas: [['Sunset', 9, 13], ['Summit', 13, 5], ['Haven', 13, 6]] },
    ],

    // Clasificados (orden según la llave oficial del pick'em).
    playoffs: {
      equipos: ['100T', 'G2', 'VIT', 'NS', 'NRG', 'T1', 'PRX', 'LOUD'],
      // 1° de grupo -> mejor posición en el veto (elige orden).
      primeros: ['100T', 'VIT', 'NRG', 'PRX'],
    },

    // Cara a cara 2026 entre clasificados fuera de Champions (las series de grupos ya entran al ajuste).
    // ma / mb = mapas ganados por a / b. tipo: 'liga' | 'playoff' | 'internacional'.
    h2h: [
      // ---- Americas ----
      { a: '100T', b: 'G2',   fecha: '2026-01-18', evento: 'Americas Kickoff',          tipo: 'playoff', ma: 1, mb: 2, aprox: true },
      { a: '100T', b: 'G2',   fecha: '2026-05-14', evento: 'Americas Stage 1 · UR1',    tipo: 'playoff', ma: 0, mb: 2 },
      { a: '100T', b: 'G2',   fecha: '2026-07-18', evento: 'Americas Stage 2 · Sem. 1', tipo: 'liga',    ma: 2, mb: 1 },

      { a: '100T', b: 'NRG',  fecha: '2026-02-14', evento: 'Americas Kickoff',          tipo: 'playoff', ma: 0, mb: 2, mapas: [['Pearl', 3, 13], ['Abyss', 8, 13]] },
      { a: '100T', b: 'NRG',  fecha: '2026-04-25', evento: 'Americas Stage 1 · Liga',   tipo: 'liga',    ma: 1, mb: 2 },
      { a: '100T', b: 'NRG',  fecha: '2026-05-22', evento: 'Americas Stage 1 · LR3',    tipo: 'playoff', ma: 0, mb: 2 },
      { a: '100T', b: 'NRG',  fecha: '2026-07-26', evento: 'EWC París · Gran final',    tipo: 'internacional', ma: 3, mb: 1, aprox: true },
      { a: '100T', b: 'NRG',  fecha: '2026-09-04', evento: 'Americas Stage 2 · UBF',    tipo: 'playoff', ma: 2, mb: 0, mapas: [['Abyss', 13, 3], ['Sunset', 13, 6]] },

      { a: '100T', b: 'LOUD', fecha: '2026-01-24', evento: 'Americas Kickoff',          tipo: 'playoff', ma: 2, mb: 1, aprox: true },
      { a: '100T', b: 'LOUD', fecha: '2026-05-19', evento: 'Americas Stage 1 · LR1',    tipo: 'playoff', ma: 2, mb: 1, aprox: true },
      { a: '100T', b: 'LOUD', fecha: '2026-08-09', evento: 'Americas Stage 2 · Sem. 4', tipo: 'liga',    ma: 2, mb: 0 },
      { a: '100T', b: 'LOUD', fecha: '2026-09-06', evento: 'Americas Stage 2 · Final',  tipo: 'playoff', ma: 3, mb: 2, mapas: [['Split', 7, 13], ['Sunset', 13, 11], ['Ascent', 14, 12], ['Summit', 1, 13], ['Haven', 14, 12]] },

      { a: 'NRG',  b: 'G2',   fecha: '2026-02-07', evento: 'Americas Kickoff',          tipo: 'playoff', ma: 0, mb: 2 },
      { a: 'NRG',  b: 'G2',   fecha: '2026-05-23', evento: 'Americas Stage 1 · LBF',    tipo: 'playoff', ma: 2, mb: 3 },

      { a: 'NRG',  b: 'LOUD', fecha: '2026-08-28', evento: 'Americas Stage 2 · UBSF',   tipo: 'playoff', ma: 2, mb: 1, aprox: true },
      { a: 'NRG',  b: 'LOUD', fecha: '2026-09-05', evento: 'Americas Stage 2 · LBF',    tipo: 'playoff', ma: 2, mb: 3, mapas: [['Abyss', 10, 13], ['Sunset', 9, 13], ['Summit', 13, 9], ['Haven', 13, 5], ['Lotus', 3, 13]] },

      { a: 'G2',   b: 'LOUD', fecha: '2026-08-08', evento: 'Americas Stage 2 · Sem. 4', tipo: 'liga',    ma: 0, mb: 2, aprox: true },
      { a: 'G2',   b: 'LOUD', fecha: '2026-09-04', evento: 'Americas Stage 2 · LR3',    tipo: 'playoff', ma: 0, mb: 2, mapas: [['Abyss', 3, 13], ['Summit', 6, 13]] },

      // ---- Pacific ----
      { a: 'NS',   b: 'PRX',  fecha: '2026-03-15', evento: 'Masters Santiago · Final',  tipo: 'internacional', ma: 3, mb: 0, mapas: [['Corrode', 13, 11], ['Split', 13, 4], ['Abyss', 13, 3]] },
      { a: 'NS',   b: 'PRX',  fecha: '2026-04-04', evento: 'Pacific Stage 1 · Sem. 1',  tipo: 'liga',    ma: 1, mb: 2 },
      { a: 'NS',   b: 'PRX',  fecha: '2026-08-26', evento: 'Pacific Stage 2 · UR1',     tipo: 'playoff', ma: 2, mb: 0 },

      { a: 'PRX',  b: 'T1',   fecha: '2026-02-01', evento: 'Pacific Kickoff',           tipo: 'playoff', ma: 1, mb: 2, aprox: true },
      { a: 'PRX',  b: 'T1',   fecha: '2026-05-16', evento: 'Pacific Stage 1 · LR3',     tipo: 'playoff', ma: 2, mb: 1, aprox: true },
      { a: 'PRX',  b: 'T1',   fecha: '2026-07-17', evento: 'Pacific Stage 2 · Sem. 1',  tipo: 'liga',    ma: 1, mb: 2, aprox: true },

      { a: 'NS',   b: 'T1',   fecha: '2026-08-21', evento: 'Pacific Stage 2',           tipo: 'liga',    ma: 2, mb: 0 },

      // ---- Interregionales (internacionales) ----
      { a: 'NS',   b: 'NRG',  fecha: '2026-03-13', evento: 'Masters Santiago · UBF',    tipo: 'internacional', ma: 2, mb: 0, aprox: true },
      { a: 'PRX',  b: 'NRG',  fecha: '2026-03-14', evento: 'Masters Santiago · LBF',    tipo: 'internacional', ma: 3, mb: 1, aprox: true },
      { a: 'PRX',  b: 'VIT',  fecha: '2026-06-14', evento: 'Masters London · UBSF',     tipo: 'internacional', ma: 2, mb: 1, aprox: true },
      { a: '100T', b: 'NS',   fecha: '2026-07-25', evento: 'EWC París · Semifinal',     tipo: 'internacional', ma: 2, mb: 1, mapas: [['Ascent', 13, 6], ['Lotus', 7, 13], ['Haven', 13, 11]], aprox: true },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  else root.CH26_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);

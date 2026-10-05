// Verificación rápida en Node: node champions2026/test-model.js
const DATA = require('./data.js');
const M = require('./model.js');
const t0 = Date.now();
const R = M.calcular(DATA, {}, {});
console.log('tiempo', Date.now() - t0, 'ms');
// sanity
console.log('mapWin(0.5)=', M.mapWin(0.5).toFixed(4), 'mapWin(0.55)=', M.mapWin(0.55).toFixed(4));
const sym = R.S('100T','G2',3).p + R.S('G2','100T',3).p;
console.log('simetría 100T/G2:', sym.toFixed(6));
console.log('\nEquipo  prior  theta  sd  cambio');
R.F.codes.forEach((c,i)=>console.log(c.padEnd(5), R.F.mu[i].toFixed(3), R.F.theta[i].toFixed(3), R.F.thetaSd[i].toFixed(3), (R.F.theta[i]-R.F.mu[i]).toFixed(3)));
console.log('\nCuartos:');
for (const [a,b] of [['100T','G2'],['VIT','NS'],['NRG','T1'],['PRX','LOUD']]) {
  const s = R.S(a,b,3);
  console.log(a,'vs',b, (s.p*100).toFixed(1)+'%', 'punto', (s.pPunto*100).toFixed(1), 'sinH2H', (s.pSinH2H*100).toFixed(1), 'gamma', s.h2h.gamma.toFixed(3));
}
console.log('\nPuestos:');
const P = R.B.puesto;
Object.entries(P).sort((x,y)=>y[1]['1°']-x[1]['1°']).forEach(([t,v])=>console.log(t.padEnd(5), Object.entries(v).map(([k,x])=>k+':'+(x*100).toFixed(1)).join('  ')));
console.log('\nPick\'em óptimo (esperado', R.B.pickem.esperado.toFixed(2), '):');
R.B.partidos.forEach((m,k)=>console.log(m.id.padEnd(5), R.B.pickem.ganadores[k], ((R.B.res[k].gana[R.B.pickem.ganadores[k]]||0)*100).toFixed(1)+'%'));
console.log('\nFinales más probables:');
Object.entries(R.B.res[13].cruces).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k,v])=>console.log(k,(v*100).toFixed(1)));

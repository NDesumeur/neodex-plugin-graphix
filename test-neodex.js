// lancé par le test « local » de NeoDex : une parabole et une droite, leurs zéros et intersections, un curseur, la courbe bien dessinée
module.exports = async ({ pj, sleep }) => {
  const type = (id, v) => pj(`(() => { const f = document.getElementById(${JSON.stringify(id)}); f.value = ${JSON.stringify(v)}; f.dispatchEvent(new Event('input')); })(), 0`);
  await sleep(500);
  await type('gx_f0', 'x^2 - 4'); await type('gx_f1', 'a x'); await type('gx_a', '0'); await type('gx_f2', ''); await sleep(300);
  await pj(`[...document.querySelectorAll('.gxRow .btn')].find(b => b.textContent === '⌂').click(), 0`); await sleep(300);
  const pts = await pj(`document.getElementById('gx_pts').textContent`);
  if (!/zéro de f : \(-2 ; 0\)/.test(pts) || !/zéro de f : \(2 ; 0\)/.test(pts) || !/minimum de f : \(0 ; -4\)/.test(pts)) throw new Error('points : ' + pts);
  if (!/intersection f et g : \(-2 ; 0\)/.test(pts)) throw new Error('intersection avec g = 0 : ' + pts);
  await type('gx_a', '3'); await sleep(300);
  const pts2 = await pj(`document.getElementById('gx_pts').textContent`);
  if (!/intersection f et g : \(4 ; 12\)/.test(pts2) || !/intersection f et g : \(-1 ; -3\)/.test(pts2)) throw new Error('après a = 3 : ' + pts2);
  const pink = await pj(`(() => { const c = document.getElementById('gx_canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 79 && d[i + 2] === 176) n++; return n; })()`);
  if (pink < 200) throw new Error('la courbe rose n\'est presque pas dessinée (' + pink + ' pixels)');
  // un nuage de points et sa droite, une suite, une suite par récurrence (écrite à la française)
  const plus = () => pj(`[...document.querySelectorAll('button')].find(b => b.textContent === '+ Fonction').click(), 0`);
  await type('gx_f2', '(1;1) (2;2,9) (3;5,2) (4;7)'); await plus(); await type('gx_f3', 'n^2/8'); await plus(); await type('gx_f4', '1 ; u*1,3'); await sleep(300);
  const kinds = await pj(`document.getElementById('gx_canvas').__gx().kinds.join()`);
  if (kinds !== 'fn,fn,cloud,seq,rec') throw new Error('sortes : ' + kinds);
  const pts3 = await pj(`document.getElementById('gx_pts').textContent`);
  if (!/nuage h : 4 points, droite y = 2\.03x/.test(pts3) || !/i\(n\) : 0 ; 0\.125 ; 0\.5/.test(pts3) || !/j\(n\) : 1 ; 1\.3 ; 1\.69/.test(pts3)) throw new Error('nuage et suites : ' + pts3);
  // l'aire sous f entre 0 et 2 : ∫ (x² - 4) = 8/3 - 8
  await pj(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Aire sous la courbe').click(), 0`);
  await pj(`(() => { const s = document.getElementById('gx_afn'); s.value = '0'; s.dispatchEvent(new Event('change')); })(), 0`); await type('gx_alo', '0'); await type('gx_ahi', '2'); await sleep(200);
  const integ = await pj(`document.getElementById('gx_aint').textContent`);
  if (integ !== '∫ = -5.3333') throw new Error('intégrale : ' + integ);
  // une surface : la vue passe en 3D, et on la fait tourner
  await plus(); await type('gx_f5', 'sin(x)*cos(y)'); await sleep(300);
  const g3 = await pj(`document.getElementById('gx_canvas').__gx()`);
  if (g3.view !== '3d' || g3.kinds[5] !== 'surf') throw new Error('3D : ' + JSON.stringify(g3));
  const lit = await pj(`(() => { const c = document.getElementById('gx_canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++; return n / (d.length / 4); })()`);
  if (lit < .08) throw new Error('surface presque invisible (' + Math.round(lit * 100) + ' %)');
  await pj(`(() => { const c = document.getElementById('gx_canvas'), r = c.getBoundingClientRect(), o = (x, y) => ({clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true}); c.dispatchEvent(new PointerEvent('pointerdown', o(100, 100))); c.dispatchEvent(new PointerEvent('pointermove', o(160, 120))); c.dispatchEvent(new PointerEvent('pointerup', o(160, 120))); })(), 0`);
  const yaw = await pj(`document.getElementById('gx_canvas').__gx().yaw`);
  if (Math.abs(yaw - g3.yaw - .6) > .01) throw new Error('rotation : ' + g3.yaw + ' → ' + yaw);
  await type('gx_f5', ''); await pj(`document.getElementById('gx_3d').click(), 0`); await sleep(300);
  await pj(`document.getElementById('gx_canvas').scrollIntoView({block: 'start'}), 0`); await sleep(300);
  return 'zéros, minimum, intersections, curseur a, nuage et sa droite, suites, intégrale, surface 3D et rotation ok';
};

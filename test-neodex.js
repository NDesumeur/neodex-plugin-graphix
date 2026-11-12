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
  await type('gx_f2', 'a*sin(b*x)'); await sleep(300);
  await pj(`document.getElementById('gx_canvas').scrollIntoView({block: 'start'}), 0`); await sleep(300);
  return 'zéros, minimum, intersections, curseur a et tracé ok';
};

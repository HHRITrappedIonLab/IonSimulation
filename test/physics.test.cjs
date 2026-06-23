/* 單元測試：驗證 3D physics.js 的冷卻/加熱/穩定性與「線形離子鏈」成形。
 * 執行：node test/physics.test.cjs
 */
const P = require('../physics.js');

let failures = 0;
function check(name, cond, extra) {
  const ok = !!cond; if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`);
}

function simulate(opts) {
  const rng = P.mulberry32(opts.seed || 1);
  const state = P.createState(opts.n || 6, { rng, initialSpeed: opts.initialSpeed != null ? opts.initialSpeed : 120 });
  const params = P.makeParams({
    detuning: opts.detuning,
    intensity: opts.intensity != null ? opts.intensity : 1.5,
    beams: opts.beams || P.BEAMS_6,
  });
  const dt = 1 / 60, steps = Math.round((opts.seconds || 10) * 60), trace = [];
  for (let i = 0; i < steps; i++) { P.step(state, params, dt, rng); if (i % 60 === 0) trace.push(+P.temperature(state).toFixed(2)); }
  return { state, trace, T: P.temperature(state), rms: P.rmsSpeed(state) };
}

const anyNaN = s => s.ions.some(io => [io.x, io.y, io.z, io.vx, io.vy, io.vz].some(v => !isFinite(v)));
const maxR = s => Math.max(...s.ions.map(io => Math.hypot(io.x, io.y, io.z)));
const maxRadial = s => Math.max(...s.ions.map(io => Math.hypot(io.y, io.z)));   // 離軸距離(y,z)
function minPairDist(s) { let m = Infinity; const a = s.ions; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) m = Math.min(m, Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y, a[i].z - a[j].z)); return m; }
const xSpan = s => { const xs = s.ions.map(io => io.x); return Math.max(...xs) - Math.min(...xs); };

console.log('=== 3D 雷射冷卻離子：物理測試 ===\n');

// 1) 紅失諧冷卻
const cold = simulate({ detuning: -0.5, seconds: 14, seed: 7 });
const hot0 = P.temperature(P.createState(6, { rng: P.mulberry32(7), initialSpeed: 120 }));
console.log('紅失諧 (δ=-0.5) 溫度軌跡:', cold.trace.join(' → '));
check('紅失諧會冷卻（末溫 < 初溫的 30%）', cold.T < hot0 * 0.3, `初溫≈${hot0.toFixed(2)}, 末溫=${cold.T.toFixed(2)}`);
check('冷卻後無 NaN/Inf', !anyNaN(cold.state));
check('離子留在球形阱內', maxR(cold.state) < P.DEFAULTS.worldRadius + 1, `maxR=${maxR(cold.state).toFixed(0)}`);

// 2) 藍失諧加熱
const heated = (function () {
  const rng = P.mulberry32(7);
  const state = JSON.parse(JSON.stringify(cold.state));
  const params = P.makeParams({ detuning: +0.5, intensity: 1.5 });
  const before = P.temperature(state);
  for (let i = 0; i < 60 * 5; i++) P.step(state, params, 1 / 60, rng);
  return { before, after: P.temperature(state), state };
})();
console.log(`\n藍失諧 (δ=+0.5)：${heated.before.toFixed(2)} → ${heated.after.toFixed(2)}`);
check('藍失諧會加熱（末溫 > 初溫）', heated.after > heated.before * 1.5);
check('加熱後仍無 NaN/Inf', !anyNaN(heated.state));

// 3) 共振冷卻效果差
const onres = simulate({ detuning: 0.0, seconds: 14, seed: 7 });
console.log(`\n共振 (δ=0) 末溫=${onres.T.toFixed(2)} vs 紅失諧 ${cold.T.toFixed(2)}`);
check('共振冷卻明顯比紅失諧差', onres.T > cold.T * 1.8);

// 4) 形成「線形離子鏈」：沿 x 展開、緊貼軸線(y,z 很小)、彼此不重疊
console.log(`\n冷卻後：x 跨度=${xSpan(cold.state).toFixed(0)}px  離軸最大=${maxRadial(cold.state).toFixed(1)}px  最小間距=${minPairDist(cold.state).toFixed(0)}px`);
check('離子沿軸排成一直線（離軸 < 18px）', maxRadial(cold.state) < 18, `maxRadial=${maxRadial(cold.state).toFixed(1)}`);
check('鏈沿 x 展開（跨度 > 120px）', xSpan(cold.state) > 120);
check('離子彼此分開（最小間距 > 20px）', minPairDist(cold.state) > 20);
check('鏈在阱內（maxR < 0.95R）', maxR(cold.state) < P.DEFAULTS.worldRadius * 0.95);

// 5) 高壓力穩定性
const stress = simulate({ detuning: -0.5, intensity: 30, n: 14, seconds: 8, seed: 3, initialSpeed: 340 });
check('高壓力（s=30, 14 顆, 8s）不爆炸', !anyNaN(stress.state) && maxR(stress.state) < P.DEFAULTS.worldRadius + 1);

// 6) 真實 RF 模式（micromotion）
const rfCold = (function () {
  const rng = P.mulberry32(7), state = P.createState(8, { rng, initialSpeed: 120 });
  const params = P.makeParams({ detuning: -0.5, intensity: 1.5, trapModel: 'rf' });
  for (let i = 0; i < 60 * 16; i++) P.step(state, params, 1 / 60, rng);
  return { state };
})();
console.log(`\nRF 冷卻：離軸=${maxRadial(rfCold.state).toFixed(1)}px  x跨度=${xSpan(rfCold.state).toFixed(0)}px  rms=${P.rmsSpeed(rfCold.state).toFixed(1)}`);
check('RF 模式仍冷卻成線形鏈（離軸 < 20px、沿 x 展開）', maxRadial(rfCold.state) < 20 && xSpan(rfCold.state) > 120 && !anyNaN(rfCold.state));
check('RF 模式 q=0.4 數值穩定（不發散）', maxR(rfCold.state) < P.DEFAULTS.worldRadius * 0.95);

// micromotion：冷卻一顆離子到平衡後，量殘餘的 RF 抖動；雜散場越大、micromotion 越大、離軸越遠
function microStd(stray) {
  const rng = P.mulberry32(5), st = { ions: [{ x:0,y:0,z:0,vx:0,vy:0,vz:0,flash:0 }], clock:0 };
  const pr = P.makeParams({ detuning:-0.5, intensity:2, trapModel:'rf', strayField:stray });
  for (let i = 0; i < 60 * 8; i++) P.step(st, pr, 1/60, rng);   // 冷到平衡
  const ys = []; for (let i = 0; i < 90; i++) { P.step(st, pr, 1/60, rng); ys.push(st.ions[0].y); }
  const m = ys.reduce((a,b)=>a+b)/ys.length;
  return { yeq: m, std: Math.sqrt(ys.reduce((a,b)=>a+(b-m)**2,0)/ys.length) };
}
const m0 = microStd(0), m900 = microStd(900);
console.log(`micromotion：on-axis std=${m0.std.toFixed(2)}  |  雜散場 y_eq=${m900.yeq.toFixed(1)}px(理論30) std=${m900.std.toFixed(2)}`);
check('RF 零點上幾乎無 micromotion（std < 1.5px）', m0.std < 1.5);
check('雜散場把離子推離零點（y_eq ≈ 30px）', Math.abs(m900.yeq - 30) < 6);
check('離軸時出現明顯 micromotion（std 隨離軸增大）', m900.std > m0.std * 3);

// 7) 沒抓住就散掉：阱不穩定（Mathieu q≥0.908）→ 離子流失
const unstableRF = (function () {
  const rng = P.mulberry32(3), state = P.createState(6, { rng, initialSpeed: 120 });
  const params = P.makeParams({ detuning: -0.5, intensity: 1.5, trapModel: 'rf', rfOmega: 24, rfAmp: 305 });
  const f = P.secularFreqs(params);
  for (let i = 0; i < 60 * 5; i++) P.step(state, params, 1 / 60, rng);
  return { n: state.ions.length, lost: state.lost, q: f.q, stable: f.stable };
})();
console.log(`\n不穩定阱 q=${unstableRF.q.toFixed(2)} (stable=${unstableRF.stable})：剩 ${unstableRF.n} 顆，流失 ${unstableRF.lost} 顆`);
check('q>0.908 判定為不穩定', unstableRF.q > 0.908 && !unstableRF.stable);
check('不穩定阱 → 離子被甩出流失（剩 < 6）', unstableRF.n < 6, `剩 ${unstableRF.n}`);
check('流失守恆：剩餘 + 流失 = 6', unstableRF.n + unstableRF.lost === 6);

// 8) 徑向贗位能不束縛（Krad≤0）→ 流失
const noConfine = (function () {
  const rng = P.mulberry32(4), state = P.createState(6, { rng, initialSpeed: 120 });
  const params = P.makeParams({ detuning: -0.5, intensity: 1.5, trapModel: 'rf', rfOmega: 90, rfAmp: 120, trapKx: 4 });
  const f = P.secularFreqs(params);
  for (let i = 0; i < 60 * 6; i++) P.step(state, params, 1 / 60, rng);
  return { n: state.ions.length, Krad: f.Krad };
})();
console.log(`徑向不束縛 Krad=${noConfine.Krad.toFixed(1)}：剩 ${noConfine.n} 顆`);
check('Krad≤0 → 離子流失（剩 < 6）', noConfine.Krad <= 0 && noConfine.n < 6, `Krad=${noConfine.Krad.toFixed(1)}, 剩 ${noConfine.n}`);

// 9) 阱夠深 + 紅失諧冷卻 → 一顆都不流失（預設體驗不受影響）
const deep = simulate({ detuning: -0.5, intensity: 1.5, seconds: 14, seed: 7 });
console.log(`阱夠深冷卻：剩 ${deep.state.ions.length} 顆，流失 ${deep.state.lost || 0} 顆`);
check('阱夠深穩定冷卻 → 零流失（6 顆全留）', deep.state.ions.length === 6 && (deep.state.lost || 0) === 0);

// 10) 關閉 loss（master flag）→ 即使不穩定也不移除離子
const lossOff = (function () {
  const rng = P.mulberry32(3), state = P.createState(6, { rng, initialSpeed: 120 });
  const params = P.makeParams({ detuning: -0.5, intensity: 1.5, trapModel: 'rf', rfOmega: 24, rfAmp: 305, loss: false });
  for (let i = 0; i < 60 * 5; i++) P.step(state, params, 1 / 60, rng);
  return { n: state.ions.length };
})();
check('關閉 loss 時不移除離子（仍 6 顆）', lossOff.n === 6, `剩 ${lossOff.n}`);

console.log(`\n=== 結果：${failures === 0 ? '全部通過 🎉' : failures + ' 項失敗'} ===`);
process.exit(failures === 0 ? 0 : 1);

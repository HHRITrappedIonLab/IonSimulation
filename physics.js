/*
 * physics.js — 3D 雷射冷卻離子模擬核心 (Doppler laser-cooling in a linear Paul trap)
 *
 * 瀏覽器 / Node.js 雙用：
 *   - 瀏覽器：掛在 window.Physics
 *   - Node：  module.exports = Physics（給 test/physics.test.cjs）
 *
 * 真 3D 模型（任意「遊戲單位」，忠於真實現象）：
 *   1. 諧波線形阱：a = −(Kx·x, Ky·y, Kz·z)。Kx 弱(軸向) + Ky,Kz 強(徑向)
 *      → 離子沿 x 軸排成一條「線形離子鏈」。
 *   2. 3D 庫倫排斥（軟化）：a += coulomb · r̂ / r²。
 *   3. 都普勒雷射冷卻：每道光束(單位向量 n)散射率採勞侖茲線型
 *        L(v) = s / (1 + s + (2δ′/Γ)²)，  δ′ = δ − k·(n·v)
 *      沿 n 施加平均光壓，並加上正比 √(散射率) 的 3D 隨機反衝(都普勒極限)。
 */
;(function (global) {
  'use strict';

  // ---- 預設常數（遊戲單位）----
  const DEFAULTS = Object.freeze({
    worldRadius: 280,    // 球形軟邊界半徑 (px)
    mass: 1.0,
    // 線形阱：x 弱(軸向) → 鏈沿 x 展開；y,z 強(徑向) → 夾在軸線上
    trapKx: 1.0,
    trapKy: 30.0,
    trapKz: 30.0,
    coulomb: 300000,     // 離子間庫倫排斥強度（已軟化）
    softening: 12,       // 庫倫軟化長度 (px)
    coulombFmax: 9000,   // 庫倫加速度上限 (px/s^2)

    gamma: 1.0,          // 線寬 Γ
    dopplerCoef: 0.004,  // 速度→失諧 換算 k（捕捉速度 = γ/k）
    forceScale: 260,     // 光壓力尺度 → 冷卻快慢
    noiseAmp: 7.5,       // 反衝擴散雜訊 → 都普勒極限（最低溫）

    // ---- 阱模型 ----
    trapModel: 'secular', // 'secular'（贗位能近似，預設、輕快）| 'rf'（顯式時變 RF → 有 micromotion）
    // RF 模式的物理旋鈕（直接設定，secular 頻率由它們算出）：
    rfOmega: 39,         // RF 角頻率 Ω（遊戲單位）
    rfAmp: 305,          // RF 力幅 A（∝ RF 電壓 V_RF）。Mathieu q = 2A/Ω²
    // 註：軸向 DC 束縛＝trapKx（∝ DC 端蓋電壓 U_DC）；徑向贗位能 = A²/2Ω²
    strayField: 0,       // 雜散 DC 徑向力（把離子推離 RF 零點 → excess micromotion）
    rfSubsteps: 9,       // RF 模式的子步數（要解析快速的 RF 振盪）

    maxSpeed: 340,       // 速度上限 (px/s)
    substeps: 3,
  });

  // 六道光束：±x(左右/軸向)、±y(上下)、±z(前後)。n = 傳播方向(指向中心)。
  const BEAMS_6 = [
    { nx: 1, ny: 0, nz: 0 }, { nx: -1, ny: 0, nz: 0 },
    { nx: 0, ny: 1, nz: 0 }, { nx: 0, ny: -1, nz: 0 },
    { nx: 0, ny: 0, nz: 1 }, { nx: 0, ny: 0, nz: -1 },
  ];

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 球面上的均勻隨機單位向量
  function randDir(rng) {
    const u = 2 * rng() - 1;            // cosθ ∈ [-1,1]
    const phi = 2 * Math.PI * rng();
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { x: s * Math.cos(phi), y: s * Math.sin(phi), z: u };
  }

  // 初始狀態：n 顆離子隨機分佈於小球內、隨機 3D 速度
  function createState(n, opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const R = opts.worldRadius || DEFAULTS.worldRadius;
    const baseSpeed = opts.initialSpeed != null ? opts.initialSpeed : 120;
    const ions = [];
    for (let i = 0; i < n; i++) {
      const p = randDir(rng), v = randDir(rng);
      const rad = Math.cbrt(rng()) * R * 0.5;
      const speed = baseSpeed * (0.5 + rng());
      ions.push({
        x: p.x * rad, y: p.y * rad, z: p.z * rad,
        vx: v.x * speed, vy: v.y * speed, vz: v.z * speed,
        flash: 0,
      });
    }
    return { ions, clock: 0 };
  }

  // 第 i 顆離子的保守力加速度（阱 + 3D 庫倫）
  // rf=true 時用時變 RF 四極力（A=RF 力幅、rfCos=cos(Ωt)）；否則用 secular 諧振力。
  function conservativeAccel(state, i, p, out, rf, A, rfCos) {
    const ion = state.ions[i];
    let ax, ay, az;
    if (rf) {
      // 軸向 x：DC 靜態（弱）；徑向 y,z：DC 散焦(+Kx/2) + RF 四極(反相) + 雜散場
      ax = -p.trapKx * ion.x;
      ay = (p.trapKx * 0.5 - A * rfCos) * ion.y + p.strayField;
      az = (p.trapKx * 0.5 + A * rfCos) * ion.z;
    } else {
      ax = -p.trapKx * ion.x;
      ay = -p.trapKy * ion.y;
      az = -p.trapKz * ion.z;
    }
    const soft2 = p.softening * p.softening;
    const ions = state.ions;
    for (let j = 0; j < ions.length; j++) {
      if (j === i) continue;
      const o = ions[j];
      const dx = ion.x - o.x, dy = ion.y - o.y, dz = ion.z - o.z;
      const r2 = dx * dx + dy * dy + dz * dz + soft2;
      const r = Math.sqrt(r2);
      let f = p.coulomb / r2;          // 斥力大小（軟化 ~1/r²）
      if (f > p.coulombFmax) f = p.coulombFmax;
      const inv = f / r;
      ax += inv * dx; ay += inv * dy; az += inv * dz;
    }
    out.ax = ax / p.mass; out.ay = ay / p.mass; out.az = az / p.mass;
  }

  // 由 RF 旋鈕（Ω, A=∝V_RF）與 DC（trapKx=∝U_DC）算出 secular 頻率與 Mathieu (a,q)。
  //   徑向贗位能剛性 K_pseudo = A²/(2Ω²)；軸向 DC 散焦使徑向再 −Kx/2：
  //   ω_r = √(A²/2Ω² − Kx/2)，ω_z = √(Kx)，q = 2A/Ω²，a_axial = 4Kx/Ω²（a_radial = −a/2）
  function secularFreqs(p) {
    const Omega = p.rfOmega, A = p.rfAmp, Kx = p.trapKx;
    const Krad = A * A / (2 * Omega * Omega) - Kx * 0.5;   // 徑向 secular 剛性
    const wr = Krad > 0 ? Math.sqrt(Krad) : 0;             // 徑向 secular 角頻率
    const wz = Math.sqrt(Math.max(0, Kx));                 // 軸向 secular 角頻率
    const q = 2 * A / (Omega * Omega);
    const a = 4 * Kx / (Omega * Omega);
    return { Omega, A, Krad, wr, wz, q, a, stable: q < 0.908 && Krad > 0 };
  }

  // 推進 dt 秒
  function step(state, params, dt, rng) {
    const p = params;
    rng = rng || Math.random;
    const rf = p.trapModel === 'rf';
    const sub = rf ? (p.rfSubsteps || 9) : (p.substeps || 3);
    const h = dt / sub;
    const acc = { ax: 0, ay: 0, az: 0 };
    const beams = p.beams || BEAMS_6;
    const s = p.intensity;
    const gamma = p.gamma;
    const ions = state.ions;
    const Omega = rf ? p.rfOmega : 0, A = rf ? p.rfAmp : 0;
    if (state.clock == null) state.clock = 0;

    for (let st = 0; st < sub; st++) {
      const rfCos = rf ? Math.cos(Omega * state.clock) : 0;
      // (1) 保守力 → 半隱式 Euler（RF 模式帶時變四極力）
      for (let i = 0; i < ions.length; i++) {
        conservativeAccel(state, i, p, acc, rf, A, rfCos);
        ions[i].vx += acc.ax * h; ions[i].vy += acc.ay * h; ions[i].vz += acc.az * h;
      }
      // (2) 雷射冷卻：平均光壓 + 反衝擴散
      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        let ax = 0, ay = 0, az = 0, Rtot = 0;
        for (let b = 0; b < beams.length; b++) {
          const n = beams[b];
          const ndotv = n.nx * ion.vx + n.ny * ion.vy + n.nz * ion.vz;
          const dEff = p.detuning - p.dopplerCoef * ndotv;   // δ′ = δ − k·v
          const x = 2 * dEff / gamma;
          const L = s / (1 + s + x * x);
          ax += p.forceScale * L * n.nx;
          ay += p.forceScale * L * n.ny;
          az += p.forceScale * L * n.nz;
          Rtot += L;
        }
        ion.vx += ax * h / p.mass; ion.vy += ay * h / p.mass; ion.vz += az * h / p.mass;
        if (Rtot > 0) {
          const sigma = p.noiseAmp * Math.sqrt(Rtot * h);
          let u1 = rng(); if (u1 < 1e-9) u1 = 1e-9;
          const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
          const d = randDir(rng);
          ion.vx += sigma * g * d.x; ion.vy += sigma * g * d.y; ion.vz += sigma * g * d.z;
          ion.flash = Math.min(1, Rtot * 0.5);
        }
      }
      // (3) 更新位置 + 數值保險
      const R = p.worldRadius, vmax = p.maxSpeed;
      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        const sp2 = ion.vx * ion.vx + ion.vy * ion.vy + ion.vz * ion.vz;
        if (sp2 > vmax * vmax) { const k = vmax / Math.sqrt(sp2); ion.vx *= k; ion.vy *= k; ion.vz *= k; }
        ion.x += ion.vx * h; ion.y += ion.vy * h; ion.z += ion.vz * h;
        const rr = Math.sqrt(ion.x * ion.x + ion.y * ion.y + ion.z * ion.z);
        if (rr > R) {
          const nx = ion.x / rr, ny = ion.y / rr, nz = ion.z / rr;
          ion.x = nx * R; ion.y = ny * R; ion.z = nz * R;
          const vdotn = ion.vx * nx + ion.vy * ny + ion.vz * nz;
          if (vdotn > 0) { ion.vx -= 2 * vdotn * nx; ion.vy -= 2 * vdotn * ny; ion.vz -= 2 * vdotn * nz; }
        }
      }
      if (rf) state.clock += h;            // 推進 RF 相位
    }
    for (let i = 0; i < ions.length; i++) if (ions[i].flash > 0) ions[i].flash = Math.max(0, ions[i].flash - dt * 4);
  }

  // ---- 診斷量 ----
  function meanKE(state) {
    let sum = 0;
    for (const io of state.ions) sum += 0.5 * (io.vx * io.vx + io.vy * io.vy + io.vz * io.vz);
    return state.ions.length ? sum / state.ions.length : 0;
  }
  function temperature(state) { return meanKE(state) / 500; }
  function rmsSpeed(state) {
    let sum = 0;
    for (const io of state.ions) sum += io.vx * io.vx + io.vy * io.vy + io.vz * io.vz;
    return Math.sqrt(state.ions.length ? sum / state.ions.length : 0);
  }

  // 離軸距離的 RMS（= micromotion 強度的指標；離 RF 零點越遠抖越大）
  function radialRMS(state) {
    let sum = 0;
    for (const io of state.ions) sum += io.y * io.y + io.z * io.z;
    return Math.sqrt(state.ions.length ? sum / state.ions.length : 0);
  }

  const Physics = {
    DEFAULTS, BEAMS_6, mulberry32, randDir,
    createState, step, conservativeAccel, secularFreqs,
    meanKE, temperature, rmsSpeed, radialRMS,
    makeParams(overrides) {
      return Object.assign({}, DEFAULTS,
        { detuning: -0.5, intensity: 1.0, beams: BEAMS_6 },
        overrides || {});
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Physics;
  else global.Physics = Physics;
})(typeof window !== 'undefined' ? window : globalThis);

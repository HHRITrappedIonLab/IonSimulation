/*
 * keymap.js — 模組化鍵盤快捷鍵系統（drop-in 模組）
 *
 * 設計：
 *   - 純粹操作 DOM 上既有的控制項（觸發 slider 的 'input'、按鈕的 click），
 *     完全不依賴遊戲內部狀態 → 與 index.html 的主程式解耦。
 *   - 兩張「宣告式註冊表」：
 *       PARAMS  ：可用方向鍵調整的滑桿（←/→ 調整選定者、↑/↓ 換選哪個）
 *       ACTIONS ：一次性指令（{keys, group, desc, run}）
 *     新增快捷鍵 = 在表裡加一行；按 ? 的說明表會自動同步。
 *   - 對外 API：window.Keymap.registerAction() / registerParam()，可程式化擴充。
 *
 * 自己注入所需的 <style> 與說明浮層，所以只要在 index.html 末端
 * <script src="keymap.js"></script> 即可生效。
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);

  // ---------- 註冊表 1：可調參數（方向鍵）----------
  // id = 對應的 <input type=range> 元素 id；name = 顯示名稱。
  const PARAMS = [
    { id: 'detune',     name: '失諧 δ' },
    { id: 'intensity',  name: '雷射強度 s' },
    { id: 'ionCount',   name: '離子數量' },
    { id: 'rfOmega',    name: 'RF 頻率 Ω' },
    { id: 'rfAmp',      name: 'RF 電壓 V_RF' },
    { id: 'dcVolt',     name: 'DC 電壓 U_DC' },
    { id: 'strayField', name: '雜散 DC 場' },
  ];
  let sel = 0;   // 目前選定的（可見）參數索引

  const isVisible = el => !!(el && el.offsetParent !== null);
  const visibleParams = () => PARAMS.filter(p => isVisible($(p.id)));
  function currentParam() {
    const vis = visibleParams();
    if (!vis.length) return null;
    if (sel >= vis.length) sel = vis.length - 1;
    return vis[sel];
  }
  function nudgeParam(p, dir, big) {
    const el = $(p.id); if (!el) return;
    const step = (parseFloat(el.step) || 1) * (big ? 10 : 1);
    const min = parseFloat(el.min), max = parseFloat(el.max);
    let v = parseFloat(el.value) + dir * step;
    v = Math.max(min, Math.min(max, v));
    el.value = v;                                    // range input 會自動吸附到 step 格
    el.dispatchEvent(new Event('input', { bubbles: true }));   // 觸發既有處理器
    flashRow(el);
    toast(`${p.name}　${dir > 0 ? '▲' : '▼'}　${el.value}`);
  }
  function selectParam(d) {
    const vis = visibleParams(); if (!vis.length) return;
    sel = (sel + d + vis.length) % vis.length;
    flashRow($(vis[sel].id));
    toast(`▶ ${vis[sel].name}`);
  }
  // 點到 / focus 到某個滑桿時，同步「選定」到它，方向鍵才一致
  document.addEventListener('focusin', e => {
    const idx = PARAMS.findIndex(p => p.id === (e.target && e.target.id));
    if (idx >= 0) { const vis = visibleParams(); const v = vis.findIndex(p => p.id === PARAMS[idx].id); if (v >= 0) sel = v; }
  });

  // ---------- 註冊表 2：一次性指令 ----------
  const click = id => { const el = $(id); if (el) el.click(); };
  const beam = k => { const b = qs(`.beam-btn[data-beam="${k}"]`); if (b) b.click(); };
  function toggleTheme() {
    const next = document.body.classList.contains('pro') ? 'kids' : 'pro';
    const b = qs(`.theme-switch button[data-theme="${next}"]`); if (b) b.click();
  }
  function toggleTrap() {
    const rc = $('rfControls');
    const isRf = rc && rc.style.display !== 'none';
    const b = qs(`.seg-btn[data-trap="${isRf ? 'secular' : 'rf'}"]`); if (b) b.click();
  }

  const ACTIONS = [
    { keys: [' '],      group: '一般',     desc: '播放 / 暫停',          run: () => click('pauseBtn') },
    { keys: ['r'],      group: '一般',     desc: '重來',                run: () => click('resetBtn') },
    { keys: ['h'],      group: '一般',     desc: '加熱搖一搖',           run: () => click('heatBtn') },
    { keys: ['b'],      group: '一般',     desc: '最佳設定',             run: () => click('bestBtn') },
    { keys: ['m'],      group: '一般',     desc: '靜音開關',             run: () => click('muteBtn') },
    { keys: ['o'],      group: '視角',     desc: '自動旋轉開關',          run: () => click('rotateBtn') },
    { keys: ['t'],      group: '外觀',     desc: '切換 專業 / 童趣',      run: toggleTheme },
    { keys: ['f'],      group: '阱模型',   desc: '切換 贗位能 / 真實 RF',  run: toggleTrap },
    { keys: ['1'],      group: '雷射方向', desc: '左 ←（±x）',           run: () => beam('L') },
    { keys: ['2'],      group: '雷射方向', desc: '右 →（±x）',           run: () => beam('R') },
    { keys: ['3'],      group: '雷射方向', desc: '上（±y）',             run: () => beam('U') },
    { keys: ['4'],      group: '雷射方向', desc: '下（±y）',             run: () => beam('D') },
    { keys: ['5'],      group: '雷射方向', desc: '前（±z）',             run: () => beam('F') },
    { keys: ['6'],      group: '雷射方向', desc: '後（±z）',             run: () => beam('B') },
    { keys: ['?', '/'], group: '說明',     desc: '顯示 / 隱藏快捷鍵表',    run: () => toggleHelp() },
  ];

  // ---------- 主分派器 ----------
  window.addEventListener('keydown', e => {
    const t = e.target;
    // 在文字輸入框內打字時不攔截（range 滑桿例外，仍交給我們）
    if (t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type !== 'range'))) return;
    const k = e.key;
    if (overlayOpen() && k === 'Escape') { e.preventDefault(); toggleHelp(false); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { const p = currentParam(); if (p) { e.preventDefault(); nudgeParam(p, k === 'ArrowRight' ? 1 : -1, e.shiftKey); } return; }
    if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); selectParam(k === 'ArrowUp' ? -1 : 1); return; }
    const a = ACTIONS.find(act => act.keys.some(key => key === k || (key.length === 1 && key.toLowerCase() === k.toLowerCase())));
    if (a) { e.preventDefault(); a.run(e); }
  });

  // ---------- 注入樣式 ----------
  const style = document.createElement('style');
  style.textContent = `
    .kbd-toast{ position:fixed; left:50%; bottom:26px; transform:translateX(-50%) translateY(8px);
      background:#0b1026e6; color:var(--ink,#eef2ff); border:1px solid var(--line,#3a4488);
      border-radius:999px; padding:8px 18px; font-size:14px; font-family:var(--font,sans-serif);
      pointer-events:none; opacity:0; transition:opacity .15s, transform .15s; z-index:60; white-space:nowrap; }
    .kbd-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }
    .row.kbd-sel{ position:relative; }
    .row.kbd-sel::before{ content:''; position:absolute; left:-12px; top:2px; bottom:2px; width:3px;
      border-radius:3px; background:var(--accent,#5be0ff); box-shadow:0 0 8px var(--accent,#5be0ff); }
    .kbd-badge{ position:fixed; right:14px; bottom:14px; z-index:55; cursor:pointer; user-select:none;
      background:#0b1026cc; color:var(--muted,#9fb0e8); border:1px solid var(--line,#3a4488);
      border-radius:999px; padding:6px 12px; font-size:12.5px; font-family:var(--font,sans-serif);
      backdrop-filter:blur(4px); }
    .kbd-badge:hover{ color:var(--accent,#5be0ff); border-color:var(--accent,#5be0ff); }
    .kbd-modal{ position:fixed; inset:0; z-index:80; display:none; align-items:center; justify-content:center;
      background:#06091ccc; padding:18px; }
    .kbd-modal.show{ display:flex; }
    .kbd-box{ background:var(--panel,#191f47); border:1px solid var(--line,#3a4488); border-radius:18px;
      max-width:560px; width:100%; max-height:86vh; overflow:auto; padding:20px 22px;
      font-family:var(--font,sans-serif); color:var(--ink,#eef2ff); }
    .kbd-box h2{ margin:0 0 6px; font-size:19px; color:var(--accent,#5be0ff); }
    .kbd-box .sub{ color:var(--muted,#9fb0e8); font-size:13px; margin:0 0 14px; }
    .kbd-grp{ color:var(--accent,#5be0ff); font-size:12px; letter-spacing:1px; margin:14px 0 6px; font-weight:700; }
    .kbd-row{ display:flex; justify-content:space-between; align-items:center; gap:12px; padding:4px 0;
      border-bottom:1px solid #ffffff10; font-size:14px; }
    .kbd-keys{ display:flex; gap:5px; flex:0 0 auto; }
    .kbd-key{ font-family:var(--mono,monospace); font-size:12px; min-width:22px; text-align:center;
      background:#0d1240; border:1px solid var(--line,#3a4488); border-bottom-width:2px;
      border-radius:6px; padding:2px 7px; color:var(--ink,#eef2ff); }
    .kbd-close{ float:right; cursor:pointer; background:#0d1240; border:1px solid var(--line,#3a4488);
      color:#fff; border-radius:9px; padding:3px 11px; font-size:13px; }
    body.pro .kbd-key, body.pro .kbd-badge, body.pro .kbd-toast{ background:#0e1726; }
  `;
  document.head.appendChild(style);

  // ---------- toast（短暫提示）----------
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'kbd-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1100);
  }
  function flashRow(el) {
    const row = el && el.closest ? el.closest('.row') : null; if (!row) return;
    document.querySelectorAll('.row.kbd-sel').forEach(r => r.classList.remove('kbd-sel'));
    row.classList.add('kbd-sel');
  }

  // ---------- 說明浮層（從註冊表自動產生）----------
  let modal;
  const overlayOpen = () => modal && modal.classList.contains('show');
  function buildHelp() {
    modal = document.createElement('div'); modal.className = 'kbd-modal';
    const groups = {};
    ACTIONS.forEach(a => { (groups[a.group] = groups[a.group] || []).push(a); });
    let html = '<div class="kbd-box"><span class="kbd-close">關閉 ✕</span>' +
      '<h2>⌨ 鍵盤快捷鍵</h2><p class="sub">調整參數、控制模擬都能用鍵盤。按 <b>?</b> 或 Esc 關閉。</p>';
    // 參數調整（方向鍵）固定區塊
    html += '<div class="kbd-grp">參數調整</div>' +
      row(['←', '→'], '減少 / 增加 選定的參數（按住 Shift＝粗調 ×10）') +
      row(['↑', '↓'], '切換要調整哪個參數') +
      `<div class="kbd-row" style="border:none;color:var(--muted,#9fb0e8)"><span>可調參數</span><span style="text-align:right">${PARAMS.map(p => p.name).join('、')}</span></div>`;
    // 其餘群組
    Object.keys(groups).forEach(g => {
      html += `<div class="kbd-grp">${g}</div>`;
      groups[g].forEach(a => { html += row(a.keys.map(prettyKey), a.desc); });
    });
    html += '</div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal || e.target.classList.contains('kbd-close')) toggleHelp(false); });
  }
  function row(keys, desc) {
    return `<div class="kbd-row"><span>${desc}</span><span class="kbd-keys">${keys.map(k => `<span class="kbd-key">${k}</span>`).join('')}</span></div>`;
  }
  function prettyKey(k) { return k === ' ' ? 'Space' : k; }
  function toggleHelp(force) {
    if (!modal) buildHelp();
    const show = force === undefined ? !overlayOpen() : force;
    modal.classList.toggle('show', show);
  }

  // 右下角小提示徽章
  const badge = document.createElement('div');
  badge.className = 'kbd-badge'; badge.textContent = '⌨ 快捷鍵 ?';
  badge.addEventListener('click', () => toggleHelp(true));
  document.body.appendChild(badge);

  // ---------- 對外 API（可程式化擴充）----------
  window.Keymap = {
    actions: ACTIONS, params: PARAMS,
    registerAction(binding) { ACTIONS.push(binding); modal = null; },   // 下次開啟會重建說明
    registerParam(p) { PARAMS.push(p); modal = null; },
    toggleHelp,
  };
})();

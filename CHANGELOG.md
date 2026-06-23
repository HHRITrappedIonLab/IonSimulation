# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-06-23

### Changed
- Ion loss is now much easier to trigger on purpose: the RF-voltage slider reaches higher (max 760), the RF-frequency slider reaches lower (min 18), and the stray-field slider reaches higher (max 2800). Cranking V_RF up or dropping the RF frequency (both push Mathieu q past 0.908), or raising the stray DC field, now flings ions out of the trap. The default trap still cools and keeps every ion (escapeRho 78, tighter initial cloud).

### Fixed
- The instability ejection now scales with the pseudopotential strength (Krad), so the "✕ 不穩定（離子流失）" readout reliably matches the dynamics — ions actually escape whenever the trap is flagged unstable, even at high RF voltage (previously a strong pseudopotential could keep them trapped).

## [1.5.5] - 2026-06-23

### Changed
- Clearer transition-info formula in the laser-parameters card: each term (e.g. Γ/2π = 19.6 MHz) now stays on one line instead of wrapping mid-expression, key values are bold, and the sub/superscripts are enlarged.

## [1.5.4] - 2026-06-23

### Changed
- The laser-direction control now matches the 3D view's orientation: the chain (x) axis runs lower-left ↔ upper-right (along the rods), the depth (z, 前/後) axis runs upper-left ↔ lower-right, and y stays vertical.

## [1.5.3] - 2026-06-23

### Changed
- The 399 nm photoionization beam now enters from the upper-right of the view and crosses the atomic beam at the trap centre.

## [1.5.2] - 2026-06-23

### Changed
- The 399 nm photoionization laser is now off by default and **auto-fires only while an atom is being loaded** (then turns itself off) — matching real loading, where the PI laser isn't left on. The PI button becomes a manual "keep on" override.
- The 399 nm beam now runs **along the atomic-beam path** (nozzle → trap centre), so it visibly strikes the atoms it ionizes.

## [1.5.1] - 2026-06-23

### Changed
- Loading now adds exactly one ion per click (a single atom with a higher photoionization rate) instead of streaming a burst of ~10.

### Fixed
- The 399 nm photoionization laser is now clearly visible — a labelled violet beam crossing the trap centre plus a pulsing ionization spot — shown only when PI is on (and it disappears when toggled off).

## [1.5.0] - 2026-06-23

### Added
- Start with an empty trap by default — load the first ion yourself with the nozzle. A pulsing "👈 先載入離子" hint on the Load button appears whenever the trap is empty (no ions, no incoming atoms).

### Changed
- Loading is now dynamic: clicking Load streams atoms out of the oven over several frames, the oven mouth and the 399 nm ionization region breathe/pulse, and the atomic beam shows flowing particles.

## [1.4.3] - 2026-06-23

### Changed
- Promote the loading controls to a prominent action bar directly under the 3D trap (🧪 噴原子載入 / 🗑️ 清空阱 / 🟣 PI 399nm), where the oven is rendered; the live "trapped · atoms · lost" count moved there too. Removed the side-panel loading card — net page height is unchanged (slightly shorter).

## [1.4.2] - 2026-06-23

### Added
- Version badge (top-right) on the main page, shown in both themes.

## [1.4.1] - 2026-06-23

### Changed
- Shrink the "已形成庫倫晶體" win banner (40px → 24px) and keep it on one line.

## [1.4.0] - 2026-06-23

### Added
- Ion loading via an atomic-oven nozzle: a 399 nm photoionization laser ionizes the neutral Yb atom beam at the trap centre; atoms ionized inside the capture region (and cooled before they escape) are caught, the rest pass through. Controls to spawn atoms, clear the trap, and toggle the PI laser — plus an empty-trap start (the ion-count slider now reaches 0) so you can catch the first ion from scratch.
- Neutral atoms (`kind: 'neutral' | 'ion'`), photoionization, and `spawnAtoms` / `counts` helpers in `physics.js`; kind-aware diagnostics (temperature / rms count only trapped ions).
- Nozzle, atomic-beam, and 399 nm ionization-region rendering; neutral atoms drawn dim; a live "trapped · atoms · lost" readout; capture / loss cue sounds.
- Loading unit tests: PI on captures, PI off passes through, and empty-start.
- Physics doc §14 "離子流失與載入" — trap depth / stability loss and oven + photoionization loading.

### Changed
- An empty or loading trap no longer reads as a crystal or triggers a win; the status badge shows 載入中… / 空阱.
- The loading controls live in a compact card placed to balance the two-column panel (no net page-height increase).

## [1.3.0] - 2026-06-23

### Added
- Ion loss physics — ions now escape the trap when it can no longer hold them: radial instability (Mathieu q ≥ 0.908) or a non-binding pseudopotential (Krad ≤ 0) flings them out past the electrode aperture, after which they fly off and are removed from the simulation. Enabled by default, with the default trap deep enough that normal cooling/heating loses no ions.
- Live "trapped N · lost M" readout, a loss-cue sound, and escaping ions drawn as fading red streaks.
- Empty-trap handling so an emptied trap no longer reads as a crystal or triggers a win.
- Tunable knobs in `physics.js` DEFAULTS: `loss`, `escapeRho` (electrode aperture), `cullRadius`, `ejectK`.
- Escape-physics unit tests: q > 0.908 loss, Krad ≤ 0 loss, deep-trap zero-loss, loss-disabled flag, and loss conservation.
- Help section ⑧ on ion loss and the q ≥ 0.908 stability boundary.

### Changed
- Initial hot cloud is seeded anisotropically (long axial, tight radial) so freshly loaded ions start inside the capture region.
- Ignore the local-only `tutorial/` folder in `.gitignore`.

## [1.2.1] - 2026-06-23

### Documentation
- Add `CHANGELOG.md`, reconstructing the project history to date.

## [1.2.0] - 2026-06-22

### Added
- 3D coordinate-axes laser-direction control (x left/right, y up/down, z front/back along a depth diagonal).

### Changed
- Render all physics formulas with proper superscripts/subscripts (¹⁷¹Yb⁺, ²S₁/₂ → ²P₁/₂, s = I/I_sat, V_RF, U_DC, ω_r/2π, ω_z/2π, T_D).
- Refine the default camera so the two RF rods straddle the ion chain in a diagonal three-quarter view.

## [1.1.0] - 2026-06-22

### Added
- Modular keyboard-shortcut system (`keymap.js`) with ACTIONS / PARAMS registries.
- Real-RF (time-dependent Mathieu / micromotion) trap model, now the default at startup.

### Changed
- Compact two-column control panel so every control fits on screen without scrolling.

### Fixed
- Canvas no longer stretched by panel height on wide screens (kept square via `aspect-ratio`).
- Eliminated the crystal↔liquid state/hint flicker in real-RF mode (EMA smoothing + hysteresis + throttling).

## [1.0.0] - 2026-06-22

### Added
- Initial 3D laser-cooling (Doppler) ion-trap simulation for ¹⁷¹Yb⁺ 369 nm cooling.
- 3D anisotropic harmonic trap producing a linear ion chain, with both secular (pseudopotential) and real-RF trap models.
- Deterministic radiation-pressure force + recoil-diffusion cooling physics (`physics.js`).
- Adjustable parameters (detuning, intensity, RF frequency, DC voltage) with a live secular-frequency readout.
- Switchable professional / kids themes.
- Functional cooling audio.
- Physics & implementation documentation (`physics-and-implementation.html`, light theme, MathJax).
- Live GitHub Pages deployment, with the URL added to `README.md`.

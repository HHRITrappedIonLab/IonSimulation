# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

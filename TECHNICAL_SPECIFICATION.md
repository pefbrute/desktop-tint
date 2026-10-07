# Technical Specification: Desktop Tint

> Modern GNOME Shell extension for applying real-time color filters and desaturation overlays across the entire desktop interface.

**Specification Version:** 1.0  
**Initial Release:** 0.1.0 MVP  
**Project Name:** Desktop Tint  
**Project Type:** GNOME Shell Extension  
**Target Platform:** Ubuntu 22.04/24.04 LTS, GNOME Shell 42–46+, Wayland & X11  
**UUID:** `desktop-tint@pefbrute.github.io`

---

## 1. Project Concept

Desktop Tint is a modern, zero-overhead replacement for the classic Tint All extension in GNOME Shell.

Users can dynamically transform the desktop color profile: Amber (warm night light), Green (vintage CRT terminal), Cyan (cool focus), Sepia (classic warm tone), or Grayscale (monochrome). Intensity can be adjusted on the fly using the mouse wheel over the top bar icon or via the intensity slider.

Key Pillars:
- Instant panel indicator control
- Per-actor GLSL GPU-accelerated engine (prevents Telegram / Qt 6 Wayland framebuffer crashes)
- Low VRAM footprint (< 5MB)
- Persistence and state management (`restore-state`)
- Full compatibility across GNOME 42 to 46+

---

## 2. Core Requirements

1. Adds Desktop Tint indicator to top bar panel.
2. Toggle active color filter effect.
3. Switch built-in presets (Amber, Green, Cyan, Sepia, Grayscale).
4. Real-time intensity adjustments (5% – 100%).
5. State persistence and optional auto-restore on session login.
6. Clean cleanup during extension disable / uninstall.
7. Zero mouse or keyboard input interception.

---

## 3. Supported Platforms

- Ubuntu 22.04 LTS & 24.04 LTS
- GNOME Shell 42, 43, 44, 45, 46+
- Wayland & X11 sessions
- Multi-monitor setups
- Fractional scaling

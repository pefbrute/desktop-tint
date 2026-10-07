# Post-Mortem: GNOME Shell Offscreen Framebuffer Drop on Wayland

Technical root-cause post-mortem detailing why traditional desktop desaturation and tint extensions fail under GNOME Shell / Wayland when Qt 6 applications (e.g., Telegram Desktop) trigger Wayland sub-surface updates.

---

## 1. Problem Statement

When using extensions like *Tint All* or *GNOME Bedtime Mode*, focusing Telegram Desktop or playing video in Qt applications causes the desktop color filter to instantly drop.

System logs (`journalctl -f /usr/bin/gnome-shell`) report repeating Cogl framebuffer creation failures:

```text
gnome-shell: Failed to create offscreen effect framebuffer:
             Failed to create texture 2d due to size/format constraints
```

---

## 2. Root Cause Analysis

### Root-Level `uiGroup` Offscreen Effect Architecture

Traditional extensions apply desaturation by attaching `Clutter.DesaturateEffect` directly to `Main.uiGroup` (the root scene graph node containing all windows, panels, and wallpapers).

Because `Clutter.DesaturateEffect` inherits from `Clutter.OffscreenEffect`, GNOME Shell must allocate a full-screen GPU texture framebuffer (FBO) matching the bounding box of the entire desktop across all monitors.

### The Wayland Damage Surface Trigger

1. **Qt 6 Wayland Sub-Surfaces**: Telegram Desktop relies on rapid sub-surface redraws, dynamic HiDPI scaling, and damage region updates.
2. **Cogl Allocation Rejection**: During Wayland surface updates, Mutter recalculates the paint volume of `Main.uiGroup`. When multi-monitor bounding dimensions exceed GPU hardware texture limits or format constraints, `cogl_texture_2d_new_with_size` returns `NULL`.
3. **Silent Bypass**: Mutter catches the allocation failure and silently skips rendering the offscreen pass. The filter remains logically attached, but visual output reverts to full color.

---

## 3. The Solution: Single-Pass Per-Actor GLSL Engine

**Desktop Tint** eliminates full-screen offscreen framebuffer allocations entirely by attaching lightweight shader instances directly to individual actors:

1. Every application window (`MetaWindowActor`)
2. Top Bar Panel (`Main.panel`)
3. Desktop Wallpaper (`Main.layoutManager._backgroundGroup`)
4. Overview (`Main.overview._overview`)
5. Side Docks (`right-dock`, Dash)

### Technical Benefits
- **Bounded FBO Size**: Each offscreen texture is constrained to the exact pixel dimensions of a single window or panel.
- **Zero Allocation Failures**: Small window textures never hit GPU multi-monitor size limits.
- **Single GPU Pass**: Desaturation, brightness/contrast scaling, and color tinting are executed in a single GLSL fragment shader pass.

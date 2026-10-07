---
title: Looking for a Working GNOME Grayscale & Eye Strain Filter? How I Fixed "Tint All" & Built Desktop Tint
published: true
description: Looking for a working GNOME Shell grayscale filter, eye strain reducer, or a reliable alternative to Tint All & GNOME Bedtime Mode? Discover how Desktop Tint uses a per-actor GLSL engine to eliminate Telegram crashes and framebuffer drops on Wayland.
tags: gnome, linux, accessibility, javascript
cover_image: https://raw.githubusercontent.com/pefbrute/desktop-tint/main/icons/telegram_showcase.png
---

# Looking for a Working GNOME Grayscale & Eye Strain Filter? How I Fixed "Tint All" & Built Desktop Tint

![Desktop Tint Telegram Showcase](https://raw.githubusercontent.com/pefbrute/desktop-tint/main/icons/telegram_showcase.png)

If you spend long hours in front of a monitor, using a **grayscale (monochrome) filter** or a **warm color tint (amber/sepia)** is one of the most effective ways to reduce eye strain, minimize digital fatigue, and cut down on dopamine-driven screen distractions.

However, Linux users on Ubuntu and GNOME Shell face a common headache when trying popular extensions like **Tint All**, **Desaturate All**, or **GNOME Bedtime Mode**:

> ⚡ **The Telegram Drop Issue:**  
> You turn on your grayscale or amber eye strain filter. Everything works initially. Then you open Telegram Desktop, click on a chat channel or video, and *poof* — your entire color filter instantly turns off! Switch to another window, and it comes back. Focus Telegram again, and it drops.

If you check GNOME logs using `journalctl -f /usr/bin/gnome-shell`, you will find repeating GPU framebuffer errors:

```text
gnome-shell: Failed to create offscreen effect framebuffer:
             Failed to create texture 2d due to size/format constraints
```

For years, users searching for a **reliable Tint All alternative** or a **permanent GNOME Bedtime Mode fix** were told this was an unfixable Mutter/Wayland bug.

In this article, I will explain the **technical root cause of why traditional GNOME Shell color filters fail**, and how I built **[Desktop Tint](https://github.com/pefbrute/desktop-tint)** — a high-performance, per-actor **GNOME color tint & grayscale extension** engineered to eliminate Wayland framebuffer drops.

---

## 📌 Table of Contents

- [🆚 Feature & Performance Comparison](#-feature--performance-comparison)
- [🔍 The Root Cause Post-Mortem](#-the-root-cause-post-mortem)
- [💡 The Solution: Per-Actor Single-Pass GLSL Engine](#-the-solution-per-actor-single-pass-glsl-engine)
- [🛠️ Copy-Paste Solution for Developers](#%EF%B8%8F-copy-paste-solution-use-single-pass-desaturation-in-your-extension)
- [✨ Features of Desktop Tint](#-features-of-desktop-tint)
- [❓ Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [🚀 Quick 1-Line Installation](#-how-to-install-desktop-tint)

---

## 🆚 Feature & Performance Comparison

To understand why extensions like *Tint All* and *GNOME Bedtime Mode* drop their filters on Wayland, we need to look under the hood of GNOME Shell's rendering pipeline.

| Feature / Metric | Traditional Extensions (Tint All, Bedtime Mode) | Desktop Tint |
| :--- | :---: | :---: |
| **Grayscale / Monochrome Filter** | ✅ Yes | ✅ Yes |
| **Custom Color Tints (Amber, Sepia, Cyan, Green)** | ⚠️ Limited | ✅ Full (with dynamic presets) |
| **Mouse Wheel Intensity Control** | ❌ No | ✅ Yes (Scroll over top bar icon) |
| **Telegram / Qt6 App Compatibility** | ❌ Drops / Crashes | ✅ **Highly Stable (No Drops)** |
| **Overview (Super Key) Support** | ⚠️ Partial | ✅ Fully Filtered |
| **Custom Side Docks (`right-dock`, Dash)** | ❌ Missing | ✅ Fully Filtered |
| **GPU Texture Allocations Per Frame** | 2 Full-Screen Multi-Monitor FBOs | 1 Bounded Actor FBO Per Element |
| **GPU VRAM Overhead** | High (~100MB+ multi-monitor FBOs) | Ultra Low (< 5MB) |
| **GPU Architecture** | Stacked `uiGroup` Offscreen Effects | Single-Pass Per-Actor GLSL Engine |

---

## 🔍 The Root Cause Post-Mortem

### The Full-Screen Framebuffer Trap

Traditional extensions apply desaturation and color tinting by attaching two native Clutter effects (`Clutter.DesaturateEffect` + `Clutter.BrightnessContrastEffect`) directly to `Main.uiGroup` (the root container of the entire GNOME Shell desktop).

Because both effects inherit from `Clutter.OffscreenEffect`, GNOME Shell is forced to allocate **two full-screen GPU textures per frame**:

```text
TRADITIONAL ARCHITECTURE (CRASH-PRONE):

┌─────────────────────────────────────────────────────────────┐
│ Entire Desktop Scene Graph (Main.uiGroup)                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │ Offscreen Texture #1          │  <-- Multi-Monitor FBO 1
               │ (BrightnessContrastEffect)    │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │ Offscreen Texture #2          │  <-- Multi-Monitor FBO 2 (Fails in Telegram!)
               │ (DesaturateEffect Grayscale)  │
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │ Final Display Output          │
               └───────────────────────────────┘
```

### What Happens When Telegram Desktop Focuses

Telegram Desktop is built on **Qt 6 / 5.15**. When you click channels or view media in Telegram, Qt triggers rapid Wayland sub-surface updates, damage region recalculations, and HiDPI scale adjustments.

During these Wayland surface updates, Mutter recalculates the paint volume of `Main.uiGroup`. Cogl fails to allocate the multi-monitor offscreen texture (`cogl_texture_2d_new_with_size` returns `NULL`), and Clutter **silently skips the rendering pass**.

The effect remains attached according to `actor.get_effect()`, but your screen reverts to full color!

---

## 💡 The Solution: Per-Actor Single-Pass GLSL Engine

To build a truly reliable **GNOME eye strain filter**, we completely redesigned the shader architecture in **Desktop Tint**.

```text
DESKTOP TINT ARCHITECTURE (100% STABLE):

┌─────────────────────────────────────────────────────────────┐
│ Individual Screen Components                                │
├─────────────────┬──────────────────┬────────────────────────┤
│ MetaWindowActor │ Main.panel       │ _backgroundGroup       │
│ (App Windows)   │ (Top Bar)        │ (Desktop Wallpaper)    │
└────────┬────────┴────────┬─────────┴──────────┬─────────────┘
         │                 │                    │
┌────────▼────────┐┌───────▼────────┐┌──────────▼──────────┐
│ Single-Pass GLSL││ Single-Pass GLSL││ Single-Pass GLSL    │ <-- Small, actor-sized FBOs
│ (Desat + Tint)  ││ (Desat + Tint)  ││ (Desat + Tint)      │     (Never exceeds GPU limits!)
└────────┬────────┘└───────┬────────┘└──────────┬──────────┘
         │                 │                    │
┌────────▼─────────────────▼────────────────────▼────────────┐
│ Final Display Output (Zero Drops, 60+ FPS)                  │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Single-Pass GLSL Shader (`Shell.GLSLEffect`)

Instead of stacking two separate offscreen effects, we wrote a single custom GLSL fragment shader that performs desaturation, brightness/contrast scaling, and RGB tinting in **a single GPU pass**:

```glsl
#ifndef DESKTOP_TINT_UNIFORMS
#define DESKTOP_TINT_UNIFORMS
uniform float u_intensity;
uniform float u_desat;
uniform vec3  u_tint;
uniform float u_tint_mix;
#endif

// ITU-R BT.709 luma desaturation
float luma   = dot(cogl_color_out.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3  desatd = mix(cogl_color_out.rgb, vec3(luma), u_desat * u_intensity);

// Single-pass RGB tint multiplication
vec3  tinted = desatd * u_tint;
cogl_color_out.rgb = mix(desatd, tinted, u_tint_mix * u_intensity);
```

> 💡 **GLSL Preprocessor Guard Note:**  
> We wrapped uniform declarations in `#ifndef DESKTOP_TINT_UNIFORMS`. Without this guard, Cogl's snippet linker fails with `error: u_intensity redeclared` when multiple shader instances are created, causing window actors to turn completely invisible!

---

### Step 2: Per-Actor Mapping

Instead of applying our shader to the massive `Main.uiGroup`, we attach shader instances to individual actors:

- Every application window (`MetaWindowActor`)
- Top Bar (`Main.panel`)
- Desktop Wallpaper (`Main.layoutManager._backgroundGroup`)
- Workspace Overview (`Main.overview._overview` / Super Key view)
- Custom side docks (`right-dock`, Dash to Dock, etc.)

```javascript
// Sync shader instances across active application windows
_syncWindowActors() {
    const currentActors = new Set(global.get_window_actors());

    for (const actor of currentActors) {
        if (this._windowEffects.has(actor)) continue;

        const effect = new DesktopTintEffect();
        effect.setParams(this._intensity, preset.desat, preset.tint, preset.tintMix);
        actor.add_effect_with_name('desktop-tint-unified', effect);

        const destroyId = actor.connect('destroy', () => {
            this._windowEffects.delete(actor);
        });

        this._windowEffects.set(actor, { effect, destroyId });
    }
}
```

---

## 🛠️ Copy-Paste Solution: Use Single-Pass Desaturation in Your Extension

If you're building a GNOME Shell extension and need a lightweight desaturation effect that doesn't drop frames, here is the ready-to-use GJS class:

```javascript
const { GObject, Shell } = imports.gi;

const SHADER_DECL = `
#ifndef DESAT_SHADER_UNIFORMS
#define DESAT_SHADER_UNIFORMS
uniform float u_factor;
#endif
`;

const SHADER_CODE = `
float luma = dot(cogl_color_out.rgb, vec3(0.2126, 0.7152, 0.0722));
cogl_color_out.rgb = mix(cogl_color_out.rgb, vec3(luma), u_factor);
`;

var LightweightDesatEffect = GObject.registerClass(
class LightweightDesatEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, SHADER_DECL, SHADER_CODE, false);
        this._uFactor = this.get_uniform_location('u_factor');
        this._factor = 1.0;
    }

    setFactor(factor) {
        this._factor = factor;
        this.queue_repaint();
    }

    vfunc_paint_target(nodeOrCtx, paintCtxOrUndef) {
        this.set_uniform_float(this._uFactor, 1, [this._factor]);
        if (paintCtxOrUndef !== undefined)
            super.vfunc_paint_target(nodeOrCtx, paintCtxOrUndef);
        else
            super.vfunc_paint_target(nodeOrCtx);
    }
});
```

---

## ✨ Features of Desktop Tint

If you want a comfortable, eye-friendly Linux desktop experience, **Desktop Tint** includes several productivity features:

- 🎨 **6 Color Presets:** Off, Amber (warm night reading), Green, Cyan, Sepia, and pure Grayscale (Monochrome).
- 🎛️ **Mouse Wheel Scrolling:** Hover over the top bar panel icon and scroll your mouse wheel to adjust filter intensity from 5% to 100% in real time.
- 🖱️ **Instant Click Cycling:** Left-click the panel icon to quickly cycle presets without opening menus.
- 🖥️ **Desktop OSD Feedback:** Displays real-time pop-up notification feedback (`Desktop Tint · Amber · 65%`).
- ⚠ **Emergency Reset Switch:** Built-in reset button in the popup menu to instantly restore default screen settings if needed.
- ⚙️ **GTK4 / Libadwaita Preferences:** Full-featured settings window with compatibility across **GNOME 42, 43, 44, 45, and 46+**.

---

## ❓ Frequently Asked Questions (FAQ)

### Does Desktop Tint work with GNOME's built-in Night Light?
Yes! GNOME Night Light operates at the display server / gamma level, while Desktop Tint runs inside Mutter's Clutter scene graph. They complement each other smoothly.

### Does the filter show up in screenshots or screen recordings?
No. Because effects are applied per-actor in Mutter's scene graph without mutating system gamma ramps, full-resolution screenshots (`PrtScn`) and OBS screen recordings remain in natural full color.

### Does it work on Wayland and X11?
Yes! Tested and fully supported on Ubuntu 22.04 LTS (GNOME 42) through Ubuntu 24.04 LTS / Arch Linux (GNOME 46+) under both Wayland and X11 sessions.

---

## 🚀 How to Install Desktop Tint

You can install Desktop Tint instantly with a single command in your Linux terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/pefbrute/desktop-tint/main/install.sh | bash
```

Or manually clone and run the installer script:

```bash
git clone https://github.com/pefbrute/desktop-tint.git
cd desktop-tint
./install.sh
```

---

## 🔗 Try Desktop Tint Today

Check out **Desktop Tint** on GitHub:

👉 **[Desktop Tint Repository on GitHub (pefbrute/desktop-tint)](https://github.com/pefbrute/desktop-tint)**

If you found this technical deep dive helpful or use the GLSL snippet in your extension, feel free to star the repo and leave a comment below!

---

*How do you manage eye strain on Linux? Do you use grayscale modes or color tinting? Let's discuss in the comments!*

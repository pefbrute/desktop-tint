/**
 * Desktop Tint - Effect Manager (per-window & per-container architecture)
 *
 * WHY PER-WINDOW / PER-CONTAINER:
 *   Applying any Shell.GLSLEffect (or Clutter.OffscreenEffect) to Main.uiGroup
 *   requires a GPU texture the size of the entire screen. When Qt/GTK apps
 *   (e.g. Telegram) trigger Wayland surface updates, Mutter fails to allocate
 *   that texture and silently stops rendering the effect.
 *
 *   Per-actor approach: each actor gets its own effect instance.
 *   Each actor's texture is at most actor-sized — no GPU allocation failures.
 *
 * COVERAGE:
 *   - global.get_window_actors()             → all application windows
 *   - Main.panel                             → top bar
 *   - Main.layoutManager._backgroundGroup       → desktop wallpaper
 *   - Main.overview._overview / _controls    → Overview (Super/Win key view)
 *   - Main.layoutManager._chrome             → side docks (right-dock, Dash to Dock)
 *
 * LIFECYCLE:
 *   New windows are caught via global.display 'window-created' → idle_add →
 *   _syncWindowActors(). Destroyed windows clean up via actor 'destroy' signal.
 */

const { GObject, Shell, GLib } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { getPreset } = Me.imports.lib.presets;

const EFFECT_NAME = 'desktop-tint-unified';

// ─── GLSL snippet ─────────────────────────────────────────────────────────────
// Appended after COGL's default texture sampling (cogl_color_out is already set).
// Wrapped in #ifndef guard to prevent GLSL link errors when multiple instances exist.

const SHADER_DECL = `
#ifndef DESKTOP_TINT_UNIFORMS
#define DESKTOP_TINT_UNIFORMS
uniform float u_intensity;
uniform float u_desat;
uniform vec3  u_tint;
uniform float u_tint_mix;
#endif
`;

const SHADER_CODE = `
float orig_alpha   = cogl_color_out.a;
float luma         = dot(cogl_color_out.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3  desatd       = mix(cogl_color_out.rgb, vec3(luma), u_desat * u_intensity);
vec3  tinted       = desatd * u_tint;
cogl_color_out.rgb = mix(desatd, tinted, u_tint_mix * u_intensity);
cogl_color_out.a   = orig_alpha;
`;

// ─── Effect class ─────────────────────────────────────────────────────────────

const DesktopTintEffect = GObject.registerClass(
class DesktopTintEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, SHADER_DECL, SHADER_CODE, false);
        this._uIntensity = this.get_uniform_location('u_intensity');
        this._uDesat     = this.get_uniform_location('u_desat');
        this._uTint      = this.get_uniform_location('u_tint');
        this._uTintMix   = this.get_uniform_location('u_tint_mix');
        this._p = { intensity: 0.0, desat: 0.0, tint: [1.0, 1.0, 1.0], tintMix: 0.0 };
    }

    setParams(intensity, desat, tint, tintMix) {
        this._p = { intensity, desat, tint, tintMix };
        this.queue_repaint();
    }

    // GNOME 42–44: vfunc_paint_target(paintContext)
    // GNOME 45+:   vfunc_paint_target(node, paintContext)
    vfunc_paint_target(nodeOrCtx, paintCtxOrUndef) {
        const p = this._p;
        this.set_uniform_float(this._uIntensity, 1, [p.intensity]);
        this.set_uniform_float(this._uDesat,     1, [p.desat]);
        this.set_uniform_float(this._uTint,      3,  p.tint);
        this.set_uniform_float(this._uTintMix,   1, [p.tintMix]);

        if (paintCtxOrUndef !== undefined)
            super.vfunc_paint_target(nodeOrCtx, paintCtxOrUndef);
        else
            super.vfunc_paint_target(nodeOrCtx);
    }
});

// ─── Effect Manager ───────────────────────────────────────────────────────────

var EffectManager = class EffectManager {
    constructor() {
        this._currentPresetId  = 'off';
        this._currentIntensity = 0.65;
        this._enabled          = false;

        // Map<MetaWindowActor, {effect: DesktopTintEffect, destroyId: number}>
        this._windowEffects = new Map();

        // Map<ClutterActor, DesktopTintEffect> for chrome actors (docks)
        this._chromeEffects = new Map();

        // Effects on fixed actors
        this._panelEffect    = null;
        this._bgEffect       = null;
        this._overviewEffect = null;

        // Signal IDs
        this._windowCreatedId = null;
        this._focusSignalId   = null;
        this._overviewShowId  = null;
        this._recoverySourceId = null;
    }

    // ── Effect factory ───────────────────────────────────────────────────────

    _makeEffect() {
        return new DesktopTintEffect();
    }

    _paramsFor(presetId, intensity) {
        const preset = getPreset(presetId);
        return [intensity, preset.desat, preset.tint, preset.tintMix];
    }

    _applyParamsToEffect(effect) {
        if (!effect) return;
        effect.setParams(...this._paramsFor(this._currentPresetId, this._currentIntensity));
    }

    // ── Per-window management ────────────────────────────────────────────────

    _syncWindowActors() {
        if (!this._enabled) return;

        const currentActors = new Set(global.get_window_actors());

        for (const actor of currentActors) {
            if (this._windowEffects.has(actor)) continue;
            this._attachToWindowActor(actor);
        }

        for (const actor of this._windowEffects.keys()) {
            if (!currentActors.has(actor))
                this._windowEffects.delete(actor);
        }
    }

    _attachToWindowActor(actor) {
        if (!this._isReadyForEffect(actor)) return;
        if (actor.get_effect(EFFECT_NAME)) return;

        try {
            const effect = this._makeEffect();
            this._applyParamsToEffect(effect);
            actor.add_effect_with_name(EFFECT_NAME, effect);

            const destroyId = actor.connect('destroy', () => {
                this._windowEffects.delete(actor);
            });

            this._windowEffects.set(actor, { effect, destroyId });
        } catch (e) {
            console.error('[Desktop Tint] attach to window actor failed:', e);
        }
    }

    _detachFromAllWindowActors() {
        for (const [actor, data] of this._windowEffects) {
            try { actor.disconnect(data.destroyId); } catch (_) {}
            try { actor.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
        }
        this._windowEffects.clear();
    }

    // ── Chrome actors (Side docks, right-dock, Dash, Alt+Tab popup) ───────────

    // ── Eligibility & Safeguards ──────────────────────────────────────────────

    _isReadyForEffect(actor) {
        if (!actor || actor.is_finalized?.()) return false;
        if (typeof actor.has_allocation === 'function' && !actor.has_allocation()) return false;
        if (typeof actor.is_mapped === 'function' && !actor.is_mapped()) return false;
        if (!actor.visible || actor.opacity === 0) return false;

        let w = 0, h = 0;
        try {
            if (typeof actor.get_transformed_size === 'function') {
                const [tw, th] = actor.get_transformed_size();
                w = tw; h = th;
            } else if (typeof actor.get_width === 'function') {
                w = actor.get_width();
                h = actor.get_height();
            } else {
                w = actor.width  || 0;
                h = actor.height || 0;
            }
        } catch (_) {
            return false;
        }

        return Number.isFinite(w) && Number.isFinite(h) && w >= 2 && h >= 2;
    }

    _hasConflictingOffscreenEffect(actor) {
        if (!actor || typeof actor.get_effects !== 'function') return false;
        try {
            const effects = actor.get_effects();
            if (!effects || effects.length === 0) return false;
            const hasConflict = effects.some(effect =>
                effect instanceof Shell.BlurEffect ||
                (effect instanceof Shell.GLSLEffect && !(effect instanceof DesktopTintEffect))
            );
            if (hasConflict) {
                const cls = (actor.style_class || (typeof actor.get_style_class_name === 'function' ? actor.get_style_class_name() : '')) || actor.constructor.name;
                log(`[Desktop Tint Safeguard] Skipped actor '${cls}' to avoid offscreen FBO conflict (BlurEffect/GLSLEffect detected).`);
            }
            return hasConflict;
        } catch (e) {
            return true;
        }
    }

    _isEligibleActor(actor) {
        if (!this._isReadyForEffect(actor)) return false;

        const cls = (actor.style_class || (typeof actor.get_style_class_name === 'function' ? actor.get_style_class_name() : '')) || '';

        // Hard-exclude any right-dock elements
        if (cls.includes('right-dock')) {
            // Logged once per actor scan if needed
            return false;
        }
        if (cls.includes('hover-zone') || cls.includes('drag-placeholder')) return false;

        if (this._hasConflictingOffscreenEffect(actor)) return false;

        return true;
    }

    _getChromeActors() {
        const actors = new Set();

        // 1. LayoutManager tracked actors (docks, top bar, panels)
        const tracked = Main.layoutManager._trackedActors ||
                        (Main.layoutManager._chrome && Main.layoutManager._chrome._trackedActors) ||
                        [];
        for (const item of tracked) {
            const actor = item.actor || item;
            if (this._isEligibleActor(actor) && actor !== Main.panel)
                actors.add(actor);
        }

        // 2. Scan uiGroup & modalDialogGroup children for custom extension panels & Alt+Tab popups
        const containers = [
            Main.uiGroup,
            Main.layoutManager.modalDialogGroup,
            Main.layoutManager._modalDialogGroup,
        ].filter(Boolean);

        for (const container of containers) {
            try {
                for (const child of container.get_children()) {
                    if (!this._isEligibleActor(child) || child === Main.panel || child === Main.layoutManager._backgroundGroup)
                        continue;

                    const cls = (child.style_class || (typeof child.get_style_class_name === 'function' ? child.get_style_class_name() : '')) || '';
                    if (cls.includes('dock') || cls.includes('dash') || cls.includes('switcher') || cls.includes('popup') || cls.includes('dialog')) {
                        actors.add(child);
                    }
                }
            } catch (_) {}
        }

        return actors;
    }

    _syncChromeActors() {
        if (!this._enabled) return;

        const currentChromeActors = this._getChromeActors();

        for (const actor of currentChromeActors) {
            try {
                if (!this._chromeEffects.has(actor) && !actor.get_effect(EFFECT_NAME)) {
                    const effect = this._makeEffect();
                    this._applyParamsToEffect(effect);
                    actor.add_effect_with_name(EFFECT_NAME, effect);
                    this._chromeEffects.set(actor, effect);
                    const cls = actor.style_class || (typeof actor.get_style_class_name === 'function' ? actor.get_style_class_name() : '') || actor.constructor.name;
                    console.log(`[Desktop Tint] Attached tint effect to chrome actor: ${cls}`);
                }
            } catch (_) {}
        }

        for (const [actor, effect] of this._chromeEffects) {
            try {
                if (!currentChromeActors.has(actor) || actor.is_finalized?.() || !this._isEligibleActor(actor)) {
                    try { actor.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
                    this._chromeEffects.delete(actor);
                }
            } catch (_) {
                this._chromeEffects.delete(actor);
            }
        }
    }

    _detachFromChromeActors() {
        for (const [actor, effect] of this._chromeEffects) {
            try { actor.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
        }
        this._chromeEffects.clear();
    }

    // ── Fixed actors (Panel, Background, Overview) ───────────────────────────

    _attachToPanel() {
        if (!Main.panel || this._panelEffect) return;
        try {
            this._panelEffect = this._makeEffect();
            this._applyParamsToEffect(this._panelEffect);
            Main.panel.add_effect_with_name(EFFECT_NAME, this._panelEffect);
        } catch (e) {
            console.error('[Desktop Tint] attach to panel failed:', e);
            this._panelEffect = null;
        }
    }

    _detachFromPanel() {
        if (!Main.panel || !this._panelEffect) return;
        try { Main.panel.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
        this._panelEffect = null;
    }

    _attachToBackground() {
        const bgGroup = Main.layoutManager._backgroundGroup;
        if (!bgGroup || this._bgEffect) return;
        try {
            this._bgEffect = this._makeEffect();
            this._applyParamsToEffect(this._bgEffect);
            bgGroup.add_effect_with_name(EFFECT_NAME, this._bgEffect);
        } catch (e) {
            console.error('[Desktop Tint] attach to background failed:', e);
            this._bgEffect = null;
        }
    }

    _detachFromBackground() {
        const bgGroup = Main.layoutManager._backgroundGroup;
        if (!bgGroup || !this._bgEffect) return;
        try { bgGroup.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
        this._bgEffect = null;
    }

    _attachToOverview() {
        const overviewActor = Main.overview._overview || Main.overview._controls;
        if (!overviewActor || this._overviewEffect) return;
        try {
            this._overviewEffect = this._makeEffect();
            this._applyParamsToEffect(this._overviewEffect);
            overviewActor.add_effect_with_name(EFFECT_NAME, this._overviewEffect);
        } catch (e) {
            console.error('[Desktop Tint] attach to overview failed:', e);
            this._overviewEffect = null;
        }
    }

    _detachFromOverview() {
        const overviewActor = Main.overview._overview || Main.overview._controls;
        if (overviewActor && this._overviewEffect) {
            try { overviewActor.remove_effect_by_name(EFFECT_NAME); } catch (_) {}
        }
        this._overviewEffect = null;
    }

    // ── Refresh all active effects ───────────────────────────────────────────

    _refreshAll() {
        for (const { effect } of this._windowEffects.values())
            this._applyParamsToEffect(effect);

        for (const effect of this._chromeEffects.values())
            this._applyParamsToEffect(effect);

        this._applyParamsToEffect(this._panelEffect);
        this._applyParamsToEffect(this._bgEffect);
        this._applyParamsToEffect(this._overviewEffect);
    }

    _queueSync() {
        if (this._syncSourceId) {
            GLib.source_remove(this._syncSourceId);
            this._syncSourceId = null;
        }
        this._syncSourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._syncSourceId = null;
            if (this._enabled) {
                this._syncWindowActors();
                this._syncChromeActors();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelSync() {
        if (this._syncSourceId) {
            GLib.source_remove(this._syncSourceId);
            this._syncSourceId = null;
        }
    }

    // ── Watchdog ─────────────────────────────────────────────────────────────

    _startWatchdog() {
        if (!this._windowCreatedId) {
            this._windowCreatedId = global.display.connect('window-created', () => {
                this._queueSync();
            });
        }

        if (!this._overviewShowId && Main.overview) {
            this._overviewShowId = Main.overview.connect('showing', () => {
                this._attachToOverview();
                this._syncChromeActors();
                if (this._overviewEffect)
                    this._applyParamsToEffect(this._overviewEffect);
            });
        }
    }

    _stopWatchdog() {
        this._cancelSync();
        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }
        if (this._overviewShowId && Main.overview) {
            Main.overview.disconnect(this._overviewShowId);
            this._overviewShowId = null;
        }
    }

    _cancelRecovery() {
        if (this._recoverySourceId) {
            GLib.source_remove(this._recoverySourceId);
            this._recoverySourceId = null;
        }
    }

    _scheduleRecovery() {
        this._cancelRecovery();
        this._recoverySourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._recoverySourceId = null;
            if (!this._enabled) return GLib.SOURCE_REMOVE;

            this._syncWindowActors();
            this._syncChromeActors();

            for (const { effect } of this._windowEffects.values())
                effect.queue_repaint();

            for (const effect of this._chromeEffects.values())
                effect.queue_repaint();

            if (this._overviewEffect)
                this._overviewEffect.queue_repaint();

            return GLib.SOURCE_REMOVE;
        });
    }

    // ── Public API ───────────────────────────────────────────────────────────

    enableEffect(presetId, intensity) {
        const preset = getPreset(presetId);
        this._currentPresetId  = preset.id;
        this._currentIntensity = Math.max(0.05, Math.min(1.0, intensity));

        if (preset.id === 'off') {
            this.disableEffect();
            return;
        }

        this._enabled = true;

        this._attachToBackground();
        this._syncWindowActors();
        this._syncChromeActors();
        this._attachToPanel();
        this._attachToOverview();
        this._refreshAll();
        this._startWatchdog();
    }

    disableEffect() {
        this._stopWatchdog();
        this._detachFromAllWindowActors();
        this._detachFromChromeActors();
        this._detachFromPanel();
        this._detachFromBackground();
        this._detachFromOverview();
        this._enabled = false;
    }

    setPreset(presetId) {
        this._currentPresetId = presetId;
        if (this._enabled) {
            presetId === 'off'
                ? this.disableEffect()
                : this._refreshAll();
        }
    }

    setIntensity(intensity) {
        this._currentIntensity = Math.max(0.05, Math.min(1.0, intensity));
        if (this._enabled && this._currentPresetId !== 'off')
            this._refreshAll();
    }

    refresh() {
        if (this._enabled && this._currentPresetId !== 'off')
            this._refreshAll();
    }

    isEnabled() {
        return this._enabled;
    }

    destroy() {
        this.disableEffect();
    }
};

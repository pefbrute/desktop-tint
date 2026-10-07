# Desktop Tint — Known Issues & Fixes Log

Chronological technical log of issues encountered during development, root cause analysis, and implemented solutions.

---

## ✅ ISSUE 1 — `Adw.SwitchRow is not a constructor`

**Trigger:** Opening extension preferences dialog (Extension Manager → ⚙).

**Error:**
```text
TypeError: Adw.SwitchRow is not a constructor
  fillPreferencesWindow @ prefs.js:33
```

**Root Cause:**  
`Adw.SwitchRow` was introduced in libadwaita 1.4 (GNOME 45+). On GNOME 44 and earlier, the class does not exist and direct instantiation with `new Adw.SwitchRow()` throws a TypeError.

**Solution:**  
Implemented a compatibility factory helper:
```javascript
function _makeSwitchRow(title, subtitle, settings, key) {
    if (typeof Adw.SwitchRow === 'function') {
        // GNOME 45+ (libadwaita 1.4+)
        const row = new Adw.SwitchRow({ title, subtitle });
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
    // Fallback: ActionRow + Gtk.Switch suffix
    const row    = new Adw.ActionRow({ title, subtitle });
    const toggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
}
```

**File:** [`prefs.js`](./prefs.js)

---

## ✅ ISSUE 2 — `gettext() used without calling initTranslations() first`

**Trigger:** Loading extension in GNOME Shell.

**Error:**
```text
gettext() is used without calling initTranslations() first
```

**Root Cause:**  
`ExtensionUtils.gettext()` was invoked before `initTranslations()`. In GNOME 45+, GNOME Shell automatically invokes `initTranslations()` before calling `fillPreferencesWindow()`. Manual calls in `init()` cause duplicate initialization warnings.

**Solution:**
- Removed manual `ExtensionUtils.initTranslations()` from `prefs.js → init()`.
- Wrapped `gettext` calls in a safe try-catch wrapper with string fallback:
```javascript
function _(s) {
    try { return ExtensionUtils.gettext(s); }
    catch (_) { return s; }
}
```

**Files:** [`prefs.js`](./prefs.js), [`lib/indicator.js`](./lib/indicator.js)

---

## ✅ ISSUE 3 — Screen turns completely gray after enabling (Emergency Recovery)

**Trigger:** Initial prototype using custom `Clutter.ShaderEffect`.

**Symptom:**  
Enabling the filter resulted in a solid gray screen obscuring the desktop except for the mouse cursor.

**Root Cause:**  
Initial prototype with raw `Clutter.ShaderEffect` replaced the rendering pipeline output without proper texture sampling coordinates or alpha channel pass-through.

**Solution:**  
Switched to single-pass `Shell.GLSLEffect` utilizing snippet hooks on fragment shaders (`add_glsl_snippet(Shell.SnippetHook.FRAGMENT, ...)`).

---

## ✅ ISSUE 4 — Offscreen Framebuffer Drop in Telegram Desktop on Wayland

**Trigger:** Opening Telegram Desktop or playing media in Qt 6 applications.

**Symptom:**  
Filter silently turned off for the entire screen when focusing Telegram or media windows.

**Root Cause:**  
Attaching offscreen effects directly to `Main.uiGroup` requires multi-monitor full-screen GPU textures. Qt Wayland sub-surface updates trigger damage recalculations that cause Cogl texture allocations to fail (`cogl_texture_2d_new_with_size` returns `NULL`).

**Solution:**  
Redesigned architecture to per-actor single-pass GLSL engine (`_syncWindowActors()`, `_syncChromeActors()`).

---

## ✅ ISSUE 5 — Dynamic GSettings Schema Compilation

**Trigger:** Reading settings key before compiling XML schema.

**Solution:**  
Added `glib-compile-schemas` build step and automated verification script.

---

## ✅ ISSUE 6 — Icon Path Resolution Across GNOME Shell Versions

**Trigger:** Icon failing to render in top bar on GNOME 45+.

**Root Cause:**  
In GNOME 45+, `ExtensionUtils.getCurrentExtension()` path metadata changed format.

**Solution:**  
Added robust path fallback `const path = Me.path || extension.path || '';`.

---

## ✅ ISSUE 7 — GLSL Uniform Redeclaration Link Error

**Trigger:** Creating multiple `Shell.GLSLEffect` instances across windows.

**Error:**
```text
Cogl fragment shader compilation error: u_intensity redeclared
```

**Root Cause:**  
Cogl concatenates fragment shader declarations when multiple shader effects exist in the pipeline.

**Solution:**  
Wrapped uniform declarations in `#ifndef DESKTOP_TINT_UNIFORMS` preprocessor guards.

---

## ✅ ISSUE 8 — Alt+Tab Switcher & Dock Coverage

**Trigger:** Pressing Alt+Tab or hovering over side docks.

**Symptom:**  
Alt+Tab popup switcher list displayed in unfiltered color.

**Solution:**  
Expanded `_getChromeActors()` to inspect `Main.layoutManager._trackedActors`, `uiGroup`, and `modalDialogGroup` for `switcher-popup` and dock containers.

---

## ✅ ISSUE 9 — System Lag & Invisible Hover Zone Blockage

**Trigger:** Attaching offscreen effects to invisible UI elements.

**Symptom:**  
Desktop experienced lag, and `right-dock` stopped sliding out on edge hover.

**Root Cause:**  
`right-dock-hover-zone` is an invisible touch zone with `width = 0`. Attaching offscreen effects to 0-sized actors caused 60 Cogl assertion failures per second (`width > 0 && height > 0` failed).

**Solution:**  
Added `_isEligibleActor(actor)` helper checking `get_transformed_size() >= 2px`, `opacity > 0`, and filtering out `hover-zone` elements.

---

## ✅ ISSUE 10 — Intensity Slider Not Updating Active Effects

**Trigger:** Moving intensity slider or scrolling mouse wheel on top bar icon.

**Symptom:**  
Menu label updated percentage, but active windows didn't update visual tint strength.

**Root Cause:**  
`enableEffect()` updated internal intensity variable but skipped calling `_refreshAll()` for already-attached effects.

**Solution:**  
Added `this._refreshAll()` call inside `enableEffect()` to immediately upload updated `u_intensity` uniforms via `set_uniform_float`.

---

## ✅ ISSUE 11 — Structural Sync Debouncing & Signal Cleanup Safety

**Trigger:** Rapid window creation or DND event bursts.

**Symptom:**  
Multiple concurrent `idle_add` sources queued during rapid window/actor creation, leading to redundant layout syncs and event churn.

**Root Cause:**  
Undebounced `global.display 'window-created'` handlers pushed duplicate sync passes per frame.

**Solution:**  
Implemented single-flight `_queueSync()` debouncer using `GLib.source_remove()` and strict signal cleanup in `_stopWatchdog()`.

---

## ✅ ISSUE 12 — Preview Popup Hover Storm Interception (Group C2 Click Loss)

**Trigger:** Moving mouse rapidly over dock icons.

**Symptom:**  
Clicking on an icon rendered 0 reaction (`button-press` event log was 100% missing on the target icon actor).

**Root Cause:**  
Moving the mouse across icons spawned independent hover timers for each icon, spawning preview popups under/over the cursor. The preview overlay captured the mouse click, blocking `button-press` from reaching `DockAppIcon`.

**Solution:**  
Implemented a single dock-wide `_scheduleWindowPreview` timer with a 350ms delay and an incrementing `_previewToken` guard. On hover leave or `button-press`, `_cancelPreviewShow()` instantly invalidates pending timers. Positioned preview popups strictly to the left of the dock with a 12px gap (`posX = stageX - popupW - 12`), guaranteeing zero bounding rectangle overlap.

---

## ✅ ISSUE 13 — Stale Array Index Mutation in `_syncApps()` (Favorite Icons Disappearing)

**Trigger:** Running dock for several hours with window creation/destruction.

**Symptom:**  
Favorite application icons disappeared from the dock or got repositioned out of view.

**Root Cause:**  
`let currentChildren = this._appsBox.get_children()` was computed ONCE prior to the re-ordering loop. When `set_child_at_index(item, expectedIndex)` was called inside the loop, Clutter dynamically altered the container's child order, causing subsequent loop iterations to compare against a stale `currentChildren` array and place actors into corrupted indices.

**Solution:**  
Replaced stale `currentChildren` snapshot with live `this._appsBox.get_child_at_index(expectedIndex)` check on every iteration:
```javascript
let currentItem = this._appsBox.get_child_at_index(expectedIndex);
if (currentItem !== item) {
    this._appsBox.set_child_at_index(item, expectedIndex);
}
```

---

## ✅ ISSUE 14 — GJS Class Prototype Caching in Wayland Session

**Trigger:** Reloading extensions via `gnome-extensions disable/enable`.

**Symptom:**  
GNOME Shell continued executing old class handlers and old method implementations even after editing `extension.js`.

**Root Cause:**  
GJS caches registered GObject classes by `GTypeName`. With a static `'DockAppIcon'` name, GJS ignored re-registration within the same `gnome-shell` PID lifetime.

**Solution:**  
Made `GTypeName` dynamic per reload:
```javascript
## ✅ ISSUE 15 — Transient Empty AppFavorites Array Destroys Pinned Icons

**Trigger:** GSettings/DBus state update during desktop operation.

**Symptom:**  
Favorite icons suddenly disappear from the dock layout.

**Root Cause:**  
When `AppFavorites.getAppFavorites().getFavorites()` returned an empty array `[]` during GSettings sync, `orderedTargetApps` contained only running apps. `_syncApps()` then evaluated `if (!addedSet.has(appId))` for all 11 favorites, found them missing from `addedSet`, and executed `item.destroy()`, wiping all favorite icons from the dock.

**Solution:**  
Added a protective guard inside `_syncApps()`: if `favs` returns empty `[]` while existing favorite icons (`existingFavCount > 0`) are present in `this._appIconMap`, `_syncApps()` protects all existing favorite icons from destruction and retains them in `orderedTargetApps`:
```javascript
## ✅ ISSUE 16 — Scene Graph Reparenting During Pointer Interactions Suppresses Click Events

**Trigger:** `_syncApps()` triggering while the user is pressing or hovering over a dock icon.

**Symptom:**  
Clicking an icon produces 0 reaction (`vfunc_clicked` is suppressed by Clutter).

**Root Cause:**  
When `_syncApps()` ran while the cursor was hovering or pressing an icon, `set_child_at_index()` detached/re-parented the child actor in Clutter's scene graph. Reparenting an actor under the cursor invalidates Clutter's picking sequence target, so `St.Button` missed `button-release` and suppressed `vfunc_clicked()`.

**Solution:**  
1. Added a deferred sync guard at the start of `_syncApps()`: if `_pointerInteractionActive` or `_isDraggingIcon` is true, `_syncApps()` logs a deferral and sets `_syncPending = true`.
2. Added `_setPointerInteractionActive(active)` setter method: when interaction finishes (`active = false`), any deferred sync is safely scheduled via `GLib.idle_add`:
```javascript
_setPointerInteractionActive(active) {
    this._pointerInteractionActive = active;
    if (!active && this._syncPending) {
        this._syncPending = false;
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._syncApps();
            return GLib.SOURCE_REMOVE;
        });
    }
}
```

---

## ✅ ISSUE 17 — Custom Desktop IDs & Null lookup_app Fallback Failure

**Trigger:** Extension initialization when AppFavorites is uninitialized or returning empty `[]`.

**Symptom:**  
Favorite app icons fail to render at startup or reload.

**Root Cause:**  
`Shell.AppSystem.lookup_app(id)` returns `null` for user-installed or custom `.desktop` files (e.g. `antigravity.desktop`, `hiddify-root.desktop`). Filtering `null` values resulted in `favs = []`.

**Solution:**  
Enhanced the fallback to use `Shell.App.new_for_desktop_id(id)` when `lookup_app(id)` returns `null`:
```javascript
favs = favIds.map(id => {
    if (!id) return null;
    let app = appSys ? appSys.lookup_app(id) : null;
    if (!app && typeof Shell.App.new_for_desktop_id === 'function') {
        try { app = Shell.App.new_for_desktop_id(id); } catch (_) {}
    }
    return app;
}).filter(app => app !== null && app !== undefined);
```

---

## ✅ ISSUE 18 — Disposed C Object Reference Leak on `_appGridBtn` & `_appsSeparator`

**Trigger:** Disabling and re-enabling extension during GNOME Shell session.

**Symptom:**  
Log error: `Object St.Widget, has been already disposed — impossible to access it` at `extension.js:1854`, wiping all icons from dock.

**Root Cause:**  
`disable()` destroyed `_dockContainer` (which recursively disposed `_appGridBtn` and `_appsSeparator`), but did not reset JS references `this._appGridBtn = null` and `this._appsSeparator = null`. On re-enable, calling methods on disposed C objects crashed `_syncApps()`.

**Solution:**  
1. Set `this._appGridBtn = null` and `this._appsSeparator = null` in `disable()`.
2. Added C object validity checks before method invocations in `_syncApps()`.

---

## ✅ ISSUE 19 — Pango Markup Syntax Crash from Truncating App/Window Titles

**Trigger:** Preview generation or tooltip creation for windows or apps containing ampersands `&`.

**Symptom:**  
Log error: `Failed to set the markup of the actor '<unnamed>[<ClutterText>]': Error on line 1: Entity did not end with a semicolon`.

**Root Cause:**  
Truncating raw title strings with `.substring(0, 21)` BEFORE calling `GLib.markup_escape_text()` cut markup entities in half (like `&amp;` cut to `&am`), causing Pango text parser to crash inside `St.Label`.

**Solution:**  
Truncate plain text FIRST, and then apply `GLib.markup_escape_text()` to the truncated string.

---

## Quick Reference

### Extension Architecture
```text
extension.js          — Lifecycle management (enable/disable), settings bindings
lib/effectManager.js  — Per-actor GLSL shader manager & watchdog
lib/indicator.js      — Top bar panel menu, scroll handler, OSD
lib/presets.js        — Preset definitions (Amber, Green, Cyan, Sepia, Grayscale)
prefs.js              — Preferences GTK4 + Libadwaita window
schemas/              — GSettings XML schema & compiled binary
```

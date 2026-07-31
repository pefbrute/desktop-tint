# 📑 RightDock Subproblems & Technical Resolutions Index

This document tracks all fine-grained sub-problems, empirical log findings, and exact code resolutions across `right-dock@pasynkov`.

---

## 📊 Interactive Subproblem Symptoms & Fix Matrix

| ID | Symptom | Empirical Log Evidence | Code Fix Location | Diagnostic Test |
|---|---|---|---|---|
| **SUBPROBLEM-01** | Click lost during preview popup hover | 7 consecutive `showWindowPreviews` calls in 1s | `extension.js:460` | `diagnose_live_clicks_0219.py` |
| **SUBPROBLEM-02** | Icon order corrupted during sync | `Repositioning icon from index 15 to 13` | `extension.js:1840` | `dock_health_auditor.py` |
| **SUBPROBLEM-03** | Favorites array wiped on GSettings update | `_syncApps()` running at GSettings change | `extension.js:1805` | `dock_health_auditor.py` |
| **SUBPROBLEM-04** | Custom app IDs (`antigravity.desktop`) missing | `lookup_app(id)` returning `null` | `extension.js:1780` | `diagnose_favorites_visibility_live.py` |
| **SUBPROBLEM-05** | Click ignored during icon movement/DND | 10 consecutive `_syncApps()` during hover | `extension.js:1810` | `diagnose_live_clicks_0219.py` |
| **SUBPROBLEM-06** | `_appGridBtn` missing from `_appsBox` | `_appsBox` children count mismatch | `extension.js:1835` | `dock_health_auditor.py` |
| **SUBPROBLEM-07** | `get_child_at_index()` error on `St.BoxLayout` | GJS method evaluation failure | `extension.js:1850` | `dock_health_auditor.py` |
| **SUBPROBLEM-08** | Pango markup crash on title truncation | `Entity did not end with a semicolon` | `extension.js:500` | `dock_health_auditor.py` |
| **SUBPROBLEM-09** | Disposed C object reference leak | `Object St.Widget has been already disposed` | `extension.js:1440` | `dock_health_auditor.py` |
| **SUBPROBLEM-11** | Autohide not activating on mouse edge hover | Dock failing to trigger `_showDock()` | `extension.js:1325` | `dock_health_auditor.py` |
| **SUBPROBLEM-13** | Window not raising/focusing on click | `activateOrMinimize` running but window unfocused | `extension.js:365` | `diagnose_live_clicks_0219.py` |
| **SUBPROBLEM-15** | Favorite icons disappearing when tray loads | `Stole 13 indicator icons from top panel` | `extension.js:825` | `run_all_tests.sh` |

---

## 📌 Subproblem Index

### 1. SUBPROBLEM-01: Preview Popup Hover Storm Interception (Group C2 Click Loss)
- **Log Evidence:** 7 consecutive `showWindowPreviews` calls within 1 second for 7 separate windows.
- **Mechanism:** Mouse movement generated independent hover timers. Popup overlays spawned directly over icon bounds, capturing pointer press before `DockAppIcon` received `button-press`.
- **Resolution:**
  - Single dock-wide `_scheduleWindowPreview` with a 350ms delay timer and `_previewToken` guard.
  - Positioned popup with a strict 12px left gap (`posX = stageX - popupW - 12`).

---

### 2. SUBPROBLEM-02: Stale Array Index Mutation in `_syncApps()`
- **Log Evidence:** Logs showing `Repositioning icon for pasynkov-connect.desktop from index 15 to 13` / `window:168 from index 13 to 14`.
- **Mechanism:** `currentChildren = this._appsBox.get_children()` was cached once before the loop. Calling `set_child_at_index()` mutated the container's live child list, causing subsequent loop iterations to evaluate against stale indices.
- **Resolution:** Replaced static array snapshot with live `this._appsBox.get_child_at_index(expectedIndex)` check on every iteration.

---

### 3. SUBPROBLEM-03: Transient Empty `AppFavorites` Array Wiping Dock Layout
- **Log Evidence:** `_syncApps()` running at 01:15:11 during GSettings update.
- **Mechanism:** `AppFavorites.getAppFavorites().getFavorites()` returned `[]` transiently. `_syncApps()` evaluated `!addedSet.has(appId)` for all 11 favorites and executed `item.destroy()`.
- **Resolution:** Added a protective guard: if `favs` returns `[]` while existing favorite icons (`existingFavCount > 0`) are present in `_appIconMap`, `_syncApps()` retains existing favorite icons.

---

### 4. SUBPROBLEM-04: Custom App Desktop IDs Returning Null in Fallback Lookup
- **Log Evidence:** Favorites list empty at extension reload when `AppFavorites` was uninitialized.
- **Mechanism:** `Shell.AppSystem.lookup_app(id)` returns `null` for user-installed or custom `.desktop` IDs (like `antigravity.desktop`, `hiddify-root.desktop`, `antigravity-ide.desktop`). Filtering out `null` resulted in an empty `favs` array.
- **Resolution:** Enhanced fallback to use `Shell.App.new_for_desktop_id(id)` when `lookup_app(id)` returns `null`:
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

### 5. SUBPROBLEM-05: Scene Graph Reparenting During Pointer Interactions
- **Log Evidence:** 10 consecutive `_syncApps()` calls at 01:18:00 while interacting with the dock.
- **Mechanism:** `set_child_at_index()` detached/re-parented child actors under the cursor during hover or press, invalidating Clutter's pointer picking target sequence.
- **Resolution:** Added deferred sync guard (`_syncPending = true`) in `_syncApps()` when `_pointerInteractionActive` or `_isDraggingIcon` is true. `_setPointerInteractionActive(false)` schedules deferred sync via `GLib.idle_add`.

---

### 6. SUBPROBLEM-06: Container Index Mismatch for `_appGridBtn` and `_appsSeparator`
- **Log Evidence:** Icons disappearing when `_appGridBtn` parent reference became detached.
- **Mechanism:** `if (!this._appGridBtn)` skipped re-inserting `_appGridBtn` into `_appsBox` if `_appGridBtn` instance already existed, leaving `_appsBox` children at index 0 and 1 empty.
- **Resolution:** Explicitly verify `_appGridBtn.get_parent() === _appsBox` and `_appsSeparator.get_parent() === _appsBox` on every `_syncApps()` pass, inserting them at indices 0 and 1.

---

### 7. SUBPROBLEM-07: Invalid `get_child_at_index()` Method Call on `St.BoxLayout` Container
- **Log Evidence:** `_syncApps()` terminating before log audit evaluation.
- **Mechanism:** `St.BoxLayout` does not expose `get_child_at_index(index)` as a native GJS method. Calling it caused evaluation errors during child position checks.
- **Resolution:** Replaced `get_child_at_index(index)` with native GJS child array indexing `this._appsBox.get_children()[expectedIndex]`.

---

### 8. SUBPROBLEM-08: Pango Markup Syntax Crash from Truncating App/Window Titles
- **Log Evidence:** `Failed to set the markup of the actor '<unnamed>[<ClutterText>]': Error on line 1: Entity did not end with a semicolon`.
- **Mechanism:** Truncating raw window/app titles with `.substring(0, 21)` cut Pango markup entities in half (like `&amp;` cut to `&am`), causing `St.Label` creation to throw an unhandled exception inside GJS.
- **Resolution:** Truncate raw plain text FIRST, and then apply `GLib.markup_escape_text()` to the truncated string:
```javascript
let rawTitle = win.get_title() || this.app.get_name() || '';
if (rawTitle.length > 24) rawTitle = rawTitle.substring(0, 21) + '...';
let winTitle = GLib.markup_escape_text(rawTitle, -1);
```

---

### 9. SUBPROBLEM-09: Disposed C Object Reference Leak on `_appGridBtn` & `_appsSeparator`
- **Log Evidence:** `Object St.Widget, has been already disposed — impossible to access it` at `extension.js:1854`.
- **Mechanism:** `disable()` destroyed `_dockContainer` (which recursively disposed its child actors `_appGridBtn` and `_appsSeparator`), but did NOT reset `this._appGridBtn` or `this._appsSeparator` references to `null`. On extension re-enable, `_syncApps()` called methods on the disposed C objects, triggering a fatal GJS exception that aborted `_syncApps()` before favorite icons were initialized.
- **Resolution:**
  - Explicitly nullified `_appGridBtn` and `_appsSeparator` in `disable()`.
  - Added C object validity checks in `_syncApps()`:
```javascript
if (this._appGridBtn) {
    try { let p = this._appGridBtn.get_parent(); } catch (_) { this._appGridBtn = null; }
}
if (this._appsSeparator) {
    try { let p = this._appsSeparator.get_parent(); } catch (_) { this._appsSeparator = null; }
}
```

---

---

### 11. SUBPROBLEM-11: Narrow 4px Hover Zone Preventing Autohide Activation
- **Log Evidence:** Hover zone failing to trigger `_showDock()` on quick cursor movement near screen edge.
- **Mechanism:** A 4px hover zone was too narrow to capture cursor enter events before `show-delay` timer evaluated hover state on high-DPI displays.
- **Resolution:** Expanded `_hoverZone` width from `4px` to `16px` on the right edge of the monitor.

---

### 13. SUBPROBLEM-13: Focus Stealing Prevention Blocking Window Raise
- **Log Evidence:** `vfunc_clicked` firing and calling `activateOrMinimize()`, but window failing to raise or focus.
- **Mechanism:** Passing stale/zero `event.get_time()` timestamps to `Main.activateWindow(win, time)` triggered Mutter's Focus Stealing Prevention, causing Mutter to ignore the activation call.
- **Resolution:** Replaced event timestamp with `global.get_current_time()`, and added explicit `ws.activate(now)`, `targetWin.unminimize()`, `Main.activateWindow(targetWin, now)`, `targetWin.raise()`, and `targetWin.focus(now)` sequence.

---

### 15. SUBPROBLEM-15: Stolen Tray Icons & Status Box Pushing Favorites Off-Screen
- **Log Evidence:** Favorites initially visible at startup, then disappearing once `_stealTrayIcons()` logged `Stole 13 indicator icons from top panel`.
- **Mechanism:** `_trayBox` (364px) and `_statusBox` (180px) were positioned at the TOP of `_dockContainer` above `_appsBox`. When 13 tray icons loaded, the 544px top offset pushed `_appsBox` (all 11 favorite icons) completely off the bottom edge of the monitor. Additionally, setting `Main.panel.set_height(0)` broke top panel chrome allocation.
- **Resolution:**
  - Re-ordered `_dockContainer` child hierarchy so `_appsBox` is positioned FIRST at the very top of the dock, giving favorite icons top priority.
  - Removed `Main.panel.set_height(0)` to preserve GNOME Shell top bar layout stability.

# 🧪 RightDock Architecture & Bug Investigation Log

> **DECISION:** Refactor `DockAppIcon` from scratch on top of GNOME Shell's native `AppDisplay.AppIcon` & `St.Button`.  
> **GOAL:** Eliminate overlapping custom event handlers, manual pointer grabs, stale child array indexing, and preview hover storms.  
> **DETAILED SUBPROBLEMS LOG:** See [SUBPROBLEMS_AND_RESOLUTIONS.md](file:///home/fedor/projects/desktop-tint/SUBPROBLEMS_AND_RESOLUTIONS.md) for full breakdown.

---

## 🐞 Critical Issues & Empirical Root Causes Identified

### 1. ISSUE 12: Preview Popup Hover Storm Interception (Group C2 Click Loss)
- **Symptom:** Hovering across dock icons rendered clicks completely non-responsive (`button-press` log was 100% missing on the target icon actor).
- **Empirical Log Evidence:** 7 consecutive `showWindowPreviews` calls occurred within 1 second for 7 separate windows (4ch, Brave, Hiddify, PulseEffects, Desktop Tint, Steam).
- **Root Cause:** Moving the mouse across icons spawned independent hover timers for each icon, spawning preview popups under/over the cursor. The preview overlay captured the mouse click, blocking `button-press` from reaching `DockAppIcon`.
- **Fix Applied:**
  - Implemented a single dock-wide `_scheduleWindowPreview` timer with a 350ms delay and an incrementing `_previewToken` guard.
  - On hover leave or `button-press`, `_cancelPreviewShow()` instantly invalidates pending timers.
  - Positioned preview popups strictly to the left of the dock with a 12px gap (`posX = stageX - popupW - 12`), guaranteeing zero bounding rectangle overlap.

---

### 2. ISSUE 13: Stale Array Index Mutation in `_syncApps()` (Favorite Icons Disappearing)
- **Symptom:** After several hours of use, favorite application icons disappeared from the dock or got repositioned out of view.
- **Empirical Log Evidence:** Log entries `Repositioning icon for desktop-connect.desktop from index 15 to 13` / `window:168 from index 13 to 14` / `steam.desktop from index 14 to 15`.
- **Root Cause:** `let currentChildren = this._appsBox.get_children()` was computed ONCE prior to the re-ordering loop. When `set_child_at_index(item, expectedIndex)` was called inside the loop, Clutter dynamically altered the container's child order, causing subsequent loop iterations to compare against a stale `currentChildren` array and place actors into corrupted indices.
- **Fix Applied:** Replaced stale `currentChildren` snapshot with live `this._appsBox.get_child_at_index(expectedIndex)` check on every iteration:
```javascript
let currentItem = this._appsBox.get_child_at_index(expectedIndex);
if (currentItem !== item) {
    this._appsBox.set_child_at_index(item, expectedIndex);
}
```

---

### 3. ISSUE 14: GJS Class Prototype Caching in Wayland Session
- **Symptom:** `gnome-extensions disable/enable` did not reload updated JS class definitions in GJS memory.
- **Root Cause:** GJS caches registered GObject classes by `GTypeName`. With a static `'DockAppIcon'` name, GJS ignored re-registration within the same `gnome-shell` PID lifetime.
- **Fix Applied:** Made `GTypeName` dynamic per reload:
```javascript
const DOCK_BUILD_ID = Date.now();
const DockAppIcon = GObject.registerClass({
    GTypeName: `DockAppIcon_${DOCK_BUILD_ID}`,
}, class DockAppIcon extends St.Button { ... });
```

### 4. ISSUE 15: Transient Empty AppFavorites Array Destroys Pinned Icons
- **Symptom:** Favorite icons suddenly disappear from the dock after several minutes of operation.
- **Empirical Log Evidence:** At 01:15:11 `_syncApps()` fired during a GSettings/DBus update. `favs` returned `[]` transiently.
- **Root Cause:** When `AppFavorites.getAppFavorites().getFavorites()` returned an empty array `[]` during GSettings sync, `orderedTargetApps` contained only running apps. `_syncApps()` then evaluated `if (!addedSet.has(appId))` for all 11 favorites, found them missing from `addedSet`, and called `item.destroy()`, wiping all favorite icons from the dock layout.
- **Fix Applied:** Added a protective guard inside `_syncApps()`: if `favs` returns empty `[]` while existing favorite icons (`existingFavCount > 0`) are present in `this._appIconMap`, `_syncApps()` protects all existing favorite icons from destruction and retains them in `orderedTargetApps`.

### 5. ISSUE 16: Scene Graph Reparenting During Pointer Interactions Suppresses Click Events
- **Symptom:** Clicking an icon occasionally produced 0 click response.
- **Empirical Log Evidence:** 10 consecutive `_syncApps()` calls fired within 1 second right at 01:18:00 while the user was interacting with the dock.
- **Root Cause:** When `_syncApps()` ran while the cursor was hovering or pressing an icon, `set_child_at_index()` detached/re-parented the child actor in Clutter's scene graph. Reparenting an actor under the cursor invalidates Clutter's picking sequence target, so `St.Button` missed `button-release` and suppressed `vfunc_clicked()`.
- **Fix Applied:**
  - Added a deferred sync guard at the start of `_syncApps()`: if `_pointerInteractionActive` or `_isDraggingIcon` is true, `_syncApps()` logs a deferral and sets `_syncPending = true`.
  - Added `_setPointerInteractionActive(active)` setter method: when interaction finishes (`active = false`), any deferred sync is safely scheduled via `GLib.idle_add`.

---

## 🏗 Decoupled Architecture Design

```text
AppModel
  └── App list, window references, state tracking

DockView
  └── Layout container for persistent actors (uses live get_child_at_index)

DockAppIcon (extends St.Button / AppDisplay.AppIcon)
  └── Native GNOME vfunc_clicked(button), fake_release() on right/middle click, _pointerInteractionActive lock

PreviewController
  └── Single dock-wide 350ms schedule timer with _previewToken guard

VisibilityController
  └── Autohide & intellihide (frozen during pointer interactions)
```

---

## 🚫 Structural Sync Rules

`windows-changed` **MUST NOT** trigger structural `_syncApps()`.  
Structural sync runs **ONLY** on:
- `AppFavorites` changes.
- App state transitions (`STOPPED` $\leftrightarrow$ `RUNNING`).
- App addition or deletion from dock list.

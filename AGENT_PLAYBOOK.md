# 🤖 AI AGENT AUTONOMOUS OPERATING PLAYBOOK

> **ATTENTION ALL AI CODING AGENTS (ANTIGRAVITY / GEMINI / CLAUDE / CURSOR / COPILOT)**  
> This document defines the MANDATORY autonomous workflow rules, diagnostic protocols, and known architectural traps for this repository. Follow these rules without requiring human user intervention.

---

## ⚡ 1. MANDATORY FIRST ACTION FOR EVERY TURN

**DO NOT guess diagnostic hypotheses, edit source files, or form assumptions without running the automated test suite first!**

Your **VERY FIRST TOOL CALL** when processing any bug report or feature request MUST be:
```bash
bash "/home/fedor/projects/Desktop Tint/scripts/run_all_tests.sh"
```
Or view the pre-computed machine-readable state JSON:
`view_file` -> `file:///home/fedor/projects/desktop-tint/scratch/agent_last_audit.json`

---

## 📂 2. SINGLE SOURCE OF TRUTH & REPOSITORY REGISTRY

Read and maintain these living documents during your turn:

| File | Purpose |
|---|---|
| **[`AGENT_PLAYBOOK.md`](file:///home/fedor/projects/desktop-tint/AGENT_PLAYBOOK.md)** | This document — Mandatory onboarding rules & architectural traps for AI agents. |
| **[`SUBPROBLEMS_AND_RESOLUTIONS.md`](file:///home/fedor/projects/desktop-tint/SUBPROBLEMS_AND_RESOLUTIONS.md)** | Single Source of Truth log for SUBPROBLEM-01 through SUBPROBLEM-15. |
| **[`README_DIAGNOSTICS.md`](file:///home/fedor/projects/desktop-tint/README_DIAGNOSTICS.md)** | Executable diagnostic scripts catalog (`scripts/`). |
| **[`scratch/agent_last_audit.json`](file:///home/fedor/projects/desktop-tint/scratch/agent_last_audit.json)** | Machine-readable real-time health audit JSON. |

---

## ⚠️ 3. KNOWN GNOME SHELL & GJS ARCHITECTURAL TRAPS

When working on `extension.js`, enforce these mandatory rules to prevent regressions:

### 1. Disposed C-Object Trap (GObject Lifecycle)
- **Trap:** Destroying a parent widget (e.g. `_dockContainer.destroy()`) disposes C-level GObjects recursively, but leaves JS variable pointers (e.g. `this._appsBox`) holding invalid references. Calling methods on disposed objects throws `Object St.Widget has been already disposed` and aborts execution.
- **Rule:** In `disable()`, ALWAYS set `this._appGridBtn = null`, `this._appsSeparator = null`, `this._appsBox = null`, `this._dockContainer = null`. Check `!actor || actor.is_finalized?.()` before operating on C widgets.

### 2. Pango Markup Text Truncation Trap
- **Trap:** Calling `substring(0, 21)` on text AFTER escaping XML entities cut entities in half (`&amp;` cut to `&am`), causing `St.Label` creation to throw unhandled Pango markup errors.
- **Rule:** ALWAYS truncate plain raw string text FIRST, then pass to `GLib.markup_escape_text()`.

### 3. Mutter Focus Stealing Prevention Trap
- **Trap:** Passing stale `event.get_time()` or timestamp `0` to `Main.activateWindow(win, time)` causes Mutter to silently drop window activation and raise requests.
- **Rule:** ALWAYS pass `global.get_current_time()` to window activation and call `targetWin.unminimize()`, `Main.activateWindow(win, now)`, `targetWin.raise()`, `targetWin.focus(now)`.

### 4. Container Re-ordering & Height Overflow Trap
- **Trap:** Placing `_trayBox` or `_statusBox` above `_appsBox` inside `_dockContainer` causes stolen tray icons (364px) to push `_appsBox` (favorite icons) completely off the bottom edge of the screen.
- **Rule:** `this._appsBox` MUST be added FIRST inside `this._dockContainer` to guarantee favorite app icons stay at the very top of the dock.

---

## 📋 4. MANDATORY AUTONOMOUS SELF-VERIFICATION PROTOCOL

Before delivering any response to the user:
1. Validate JS syntax: `node -c "/home/fedor/projects/Ubuntu-Panel/right-dock/extension.js"`.
2. Recompile schemas if modified: `glib-compile-schemas "/home/fedor/projects/Ubuntu-Panel/right-dock/schemas"`.
3. Reload GNOME Shell extensions: `bash "/home/fedor/projects/Desktop Tint/scripts/restart_gnome_shell.sh"`.
4. Run `bash "/home/fedor/projects/Desktop Tint/scripts/run_all_tests.sh"` and verify exit code is `0`.
5. Update `SUBPROBLEMS_AND_RESOLUTIONS.md` with any new subproblem or fix details.

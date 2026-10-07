# 🛠 Desktop Tint & RightDock Diagnostic Toolset & Documentation Playbook

This document provides a guide to the automated diagnostic scripts and living documentation files created during the stability investigation.

---

## 📂 1. Core Documentation Structure

| File | Purpose & Contents |
|---|---|
| **[`SUBPROBLEMS_AND_RESOLUTIONS.md`](file:///home/fedor/projects/desktop-tint/SUBPROBLEMS_AND_RESOLUTIONS.md)** | **Single Source of Truth** for all subproblems (SUBPROBLEM-01 through SUBPROBLEM-15), including log tracebacks, root causes, and exact JS fixes. |
| **[`BUGS_AND_FIXES.md`](file:///home/fedor/projects/desktop-tint/BUGS_AND_FIXES.md)** | Architectural bug repository detailing issue triggers, symptoms, code solutions, and component maps. |
| **[`DOCK_STABILITY_INVESTIGATION.md`](file:///home/fedor/projects/desktop-tint/DOCK_STABILITY_INVESTIGATION.md)** | Living log of empirical investigation steps, test results, and scene graph reordering rules. |
| **[`README_DIAGNOSTICS.md`](file:///home/fedor/projects/desktop-tint/README_DIAGNOSTICS.md)** | This guide — diagnostic script reference manual and execution protocols. |

---

## 🛠 2. Executable Diagnostic Toolset (`scripts/`)

All system diagnostics, log audits, and extension state management must be performed exclusively via these scripts:

### 0. `scripts/run_all_tests.sh` (Master Test Suite)
- **What it does:** One-stop verification script that runs JS syntax checks, GSettings schema compilation, desktop file paths audit, and live health auditor in a single automated suite.
- **Execution:**
  ```bash
  bash "/home/fedor/projects/Desktop Tint/scripts/run_all_tests.sh"
  ```

### 1. `scripts/dock_health_auditor.py` (Main Automated Auditor)
- **What it does:** Performs real-time health audit covering 5 critical dimensions:
  1. Favorite apps GSettings configuration (11 pinned apps).
  2. Pango markup syntax & title truncation errors (0 errors).
  3. Sync engine & GJS exception check (0 errors).
  4. Real-time click event pairing (`button-press` == `button-release` == `vfunc_clicked`).
  5. Live window activation & Focus Stealing Prevention warnings (0 errors).
- **Execution:**
  ```bash
  python3 "/home/fedor/projects/Desktop Tint/scripts/dock_health_auditor.py"
  ```

### 2. `scripts/restart_gnome_shell.sh` (Safe Session & Extension Reload)
- **What it does:** Safely cycles `right-dock` and `desktop-tint` extension states and triggers re-initialization without crashing the Wayland session.
- **Execution:**
  ```bash
  bash "/home/fedor/projects/Desktop Tint/scripts/restart_gnome_shell.sh"
  ```

### 3. `scripts/diagnose_live_clicks_0219.py` (Real-time Click Inspector)
- **What it does:** Filters `journalctl` logs for `button-press`, `button-release`, `vfunc_clicked`, and `activateOrMinimize` event sequences to diagnose dropped clicks or window focus failures.
- **Execution:**
  ```bash
  python3 "/home/fedor/projects/Desktop Tint/scripts/diagnose_live_clicks_0219.py"
  ```

### 4. `scripts/diagnose_favorites_visibility_live.py` (GSettings & Desktop Path Inspector)
- **What it does:** Verifies existence of desktop files in `/usr/share/applications` and `~/.local/share/applications` for all pinned favorite IDs.
- **Execution:**
  ```bash
  python3 "/home/fedor/projects/Desktop Tint/scripts/diagnose_favorites_visibility_live.py"
  ```

---

## 🚀 3. Key Recommendations for Further Diagnostic & Documentation Improvements

1. **Matrix Mapping in `SUBPROBLEMS_AND_RESOLUTIONS.md`**:
   - Maintain a 1-to-1 symptom matrix mapping user reports to exact SUBPROBLEM IDs.

2. **Automated Pre-Commit Script Guard**:
   - Run `dock_health_auditor.py` automatically before any response to ensure 100% health status before delivering code edits.

3. **In-Code Diagnostic Class (`DockDiagnostics`)**:
   - Continue utilizing `DockDiagnostics.logInfo()` and `DockDiagnostics.logWarn()` inside `extension.js` to log critical layout events directly to `journalctl`.

#!/usr/bin/env python3
import subprocess
import re

def run_health_audit():
    print("==========================================================")
    print("      RIGHT DOCK AUTOMATED HEALTH AUDITOR & DETECTOR      ")
    print("==========================================================")

    audit_results = {}

    # 1. Favorites List Audit
    res_gsettings = subprocess.run(["gsettings", "get", "org.gnome.shell", "favorite-apps"], capture_output=True, text=True)
    fav_ids = re.findall(r"'([^']+)'", res_gsettings.stdout)
    audit_results['gsettings_fav_count'] = len(fav_ids)

    # 2. Journalctl log inspection for last 2 minutes
    res_journal = subprocess.run(["journalctl", "--since", "2 minutes ago", "--no-pager", "/usr/bin/gnome-shell"], capture_output=True, text=True)
    logs = res_journal.stdout.splitlines()

    pango_errors = [l for l in logs if ("Entity did not end with a semicolon" in l or "markup of the actor" in l) and "right-dock" in l]
    sync_errors = [l for l in logs if "_syncApps failed" in l or "TypeError" in l]
    dropped_clicks = [l for l in logs if "button-press" in l and not any("button-release" in x for x in logs)]

    press_count = sum(1 for l in logs if "button-press" in l)
    release_count = sum(1 for l in logs if "button-release" in l)
    clicked_count = sum(1 for l in logs if "vfunc_clicked" in l)

    audit_results['pango_errors'] = len(pango_errors)
    audit_results['sync_errors'] = len(sync_errors)
    audit_results['press_count'] = press_count
    audit_results['release_count'] = release_count
    audit_results['clicked_count'] = clicked_count

    print(f"\n[1] FAVORITES CONFIGURATION:")
    print(f"  - Total GSettings Pinned Apps: {len(fav_ids)}")

    print(f"\n[2] PANGO MARKUP & SYNTAX HEALTH (SUBPROBLEM-08):")
    if len(pango_errors) == 0:
        print("  - STATUS: HEALTHY ✅ (0 Pango markup truncation errors)")
    else:
        print(f"  - STATUS: FAILED ❌ ({len(pango_errors)} Pango markup errors detected!)")
        for err in pango_errors[-3:]:
            print("    ", err)

    print(f"\n[3] CONTAINER & SYNC ENGINE HEALTH (SUBPROBLEMS 02, 03, 06, 07):")
    if len(sync_errors) == 0:
        print("  - STATUS: HEALTHY ✅ (0 _syncApps execution errors)")
    else:
        print(f"  - STATUS: FAILED ❌ ({len(sync_errors)} sync engine errors detected!)")
        for err in sync_errors[-3:]:
            print("    ", err)

    print(f"\n[4] CLICK & WINDOW ACTIVATION REACTION HEALTH:")
    print(f"  - Press events:         {press_count}")
    print(f"  - Release events:       {release_count}")
    print(f"  - Clicked events:       {clicked_count}")

    activation_logs = [l for l in logs if "ACTIVATE" in l or "Cycling to window" in l]
    focus_stealing_warnings = [l for l in logs if "Focus stealing" in l or "WMSpec" in l]

    print(f"  - Total App Activations: {len(activation_logs)}")
    print(f"  - Focus Stealing Errs:  {len(focus_stealing_warnings)}")

    if press_count == release_count and len(focus_stealing_warnings) == 0:
        print("  - STATUS: HEALTHY ✅ (100% Press/Release pairing & Clean Window Activation)")
    else:
        print(f"  - STATUS: WARNING ⚠️ (Disparity or Focus Stealing detected!)")

    is_passed = (audit_results['pango_errors'] == 0 and audit_results['sync_errors'] == 0 and len(focus_stealing_warnings) == 0)
    audit_results['status'] = "PASSED" if is_passed else "FAILED"
    audit_results['click_pairing'] = (press_count == release_count)
    audit_results['focus_stealing_errors'] = len(focus_stealing_warnings)

    print("\n==========================================================")
    if is_passed:
        print("    OVERALL DOCK HEALTH STATUS: PASSED ALL CHECKS ✅   ")
    else:
        print("    OVERALL DOCK HEALTH STATUS: ISSUES DETECTED ❌      ")
    print("==========================================================")

    # Save machine-readable JSON for AI agents
    import json
    import os
    json_paths = [
        "/home/fedor/projects/Desktop Tint/scratch/agent_last_audit.json",
        "/home/fedor/.gemini/antigravity/brain/cb829770-8b9a-4ddf-b1d4-40a1c1286419/scratch/agent_last_audit.json"
    ]
    for p in json_paths:
        try:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                json.dump(audit_results, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning writing JSON to {p}: {e}")

if __name__ == "__main__":
    run_health_audit()

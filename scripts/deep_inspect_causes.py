#!/usr/bin/env python3
import subprocess
import re
from datetime import datetime

def run_deep_inspection():
    print("==========================================================")
    print("DEEP SYSTEM DIAGNOSTIC REPORT: WHY CLICKS ARE STILL DROPPING")
    print("==========================================================")

    # 1. Fetch extensive journal logs
    cmd = ["journalctl", "-n", "5000", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    lines = res.stdout.splitlines()

    dock_lines = [l for l in lines if "RightDock" in l or "desktop" in l]

    print(f"\n[1] LOG VOLUME: Captured {len(dock_lines)} dock log entries out of {len(lines)} total lines.")

    # 2. Analyze press vs release vs click gap
    press_events = []
    release_events = []
    clicked_events = []
    sync_events = []
    preview_events = []

    for idx, l in enumerate(dock_lines):
        if "button-press" in l:
            press_events.append((idx, l))
        elif "button-release" in l:
            release_events.append((idx, l))
        elif "clicked" in l:
            clicked_events.append((idx, l))
        elif "SYNC" in l or "_syncApps" in l:
            sync_events.append((idx, l))
        elif "showWindowPreviews" in l:
            preview_events.append((idx, l))

    print(f"\n[2] EVENT COUNTS:")
    print(f"  - button-press events:   {len(press_events)}")
    print(f"  - button-release events: {len(release_events)}")
    print(f"  - clicked events:        {len(clicked_events)}")
    print(f"  - _syncApps calls:       {len(sync_events)}")
    print(f"  - preview refreshes:     {len(preview_events)}")

    # 3. Pinpoint exact failure windows
    failed_presses = []
    for p_idx, p_line in press_events:
        # Check if there is a clicked event in the next 15 dock log lines
        matched = any(c_idx > p_idx and c_idx - p_idx <= 15 for c_idx, _ in clicked_events)
        if not matched:
            failed_presses.append((p_idx, p_line))

    print(f"\n[3] ROOT CAUSE ANATOMY ({len(failed_presses)} FAILED CLICKS FOUND):")

    for f_idx, f_line in failed_presses:
        print("\n----------------------------------------------------------")
        print("FAILED CLICK DETECTED:")
        print("  Press Log:", f_line)

        # Look at surrounding 5 events before and after this failed press
        start = max(0, f_idx - 3)
        end = min(len(dock_lines), f_idx + 4)
        print("  Context around failure:")
        for ctx_idx in range(start, end):
            prefix = "  ==> " if ctx_idx == f_idx else "      "
            print(f"{prefix}{dock_lines[ctx_idx]}")

    print("\n==========================================================")

if __name__ == "__main__":
    run_deep_inspection()

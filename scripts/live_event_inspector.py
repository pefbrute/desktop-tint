#!/usr/bin/env python3
import subprocess
import re
from datetime import datetime

def inspect_recent_failures():
    print("==========================================================")
    print("LIVE EVENT INSPECTOR: RECENT DOCK INTERACTION ANALYSIS")
    print("==========================================================")

    # Fetch gnome-shell logs for the last 30 minutes
    cmd = ["journalctl", "--since", "30 minutes ago", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    dock_logs = [l for l in logs if "RightDock" in l or "desktop" in l or "DockAppIcon" in l]

    print(f"Total gnome-shell log lines in last 30 min: {len(logs)}")
    print(f"Total dock-related log lines: {len(dock_logs)}\n")

    presses = []
    releases = []
    clicks = []
    previews = []
    syncs = []

    for idx, l in enumerate(dock_logs):
        if "button-press" in l or "press-event" in l:
            presses.append((idx, l))
        elif "RELEASE" in l or "button-release" in l:
            releases.append((idx, l))
        elif "clicked" in l:
            clicks.append((idx, l))
        elif "showWindowPreviews" in l or "Preview" in l:
            previews.append((idx, l))
        elif "SYNC" in l or "_syncApps" in l:
            syncs.append((idx, l))

    print(f"Event Statistics Breakdown:")
    print(f"  - Press events:    {len(presses)}")
    print(f"  - Release events:  {len(releases)}")
    print(f"  - Clicked events:  {len(clicks)}")
    print(f"  - Preview events:  {len(previews)}")
    print(f"  - Sync events:     {len(syncs)}\n")

    print("=== TIMELINE OF RECENT PRESS & RELEASE EVENTS ===")
    for p_idx, p_line in presses[-15:]:
        # Find matching release or click
        rel = next((r_line for r_idx, r_line in releases if 0 <= r_idx - p_idx <= 10), None)
        clk = next((c_line for c_idx, c_line in clicks if 0 <= c_idx - p_idx <= 10), None)

        status = "SUCCESS (Clicked)" if clk else ("RELEASED (No Click)" if rel else "DROPPED (No Release)")
        print(f"\n[PRESS EVENT]: {p_line}")
        print(f"  Result: {status}")
        if rel:
            print(f"  Release Details: {rel}")

    print("\n==========================================================")

if __name__ == "__main__":
    inspect_recent_failures()

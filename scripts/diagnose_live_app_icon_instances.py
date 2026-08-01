#!/usr/bin/env python3
import subprocess

def inspect_live_icons():
    print("==========================================================")
    print("      DIAGNOSING LIVE DOCKAPPICON INSTANCES & VISIBILITY  ")
    print("==========================================================")

    cmd = ["journalctl", "-n", "80", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    live_logs = [l for l in logs if any(k in l for k in ["RightDock", "SYNC", "SelfHealingGuard", "ERROR", "WARN"])]

    print(f"Total matching live logs: {len(live_logs)}\n")
    for l in live_logs[-35:]:
        print("  ", l)

    print("==========================================================")

if __name__ == "__main__":
    inspect_live_icons()

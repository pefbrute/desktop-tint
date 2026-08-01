#!/usr/bin/env python3
import subprocess

def inspect_disappearance():
    print("==========================================================")
    print("      DIAGNOSING FAVORITES DISAPPEARANCE AT 13:57         ")
    print("==========================================================")

    cmd = ["journalctl", "--since", "30 minutes ago", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    print(f"Total journalctl lines in last 30 mins: {len(logs)}\n")

    dock_logs = [l for l in logs if any(k in l for k in ["RightDock", "SelfHealingGuard", "syncApps", "ERROR", "WARN", "stole", "Stole"])]
    print(f"Dock relevant logs count: {len(dock_logs)}\n")

    for l in dock_logs[-40:]:
        print("  ", l)

    print("==========================================================")

if __name__ == "__main__":
    inspect_disappearance()

#!/usr/bin/env python3
import subprocess

def diagnose_now():
    print("==========================================================")
    print("RIGHT NOW DIAGNOSTIC: LAST 60 SECONDS OF GNOME SHELL LOGS")
    print("==========================================================")

    cmd = ["journalctl", "--since", "2 minutes ago", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    dock_logs = [l for l in logs if any(k in l for k in ["RightDock", "desktop", "DockAppIcon", "button-press", "clicked", "ACTIVATE"])]

    print(f"Captured {len(dock_logs)} dock-related log lines in the last 2 minutes:\n")

    for l in dock_logs:
        print("  ", l)

    print("==========================================================")

if __name__ == "__main__":
    diagnose_now()

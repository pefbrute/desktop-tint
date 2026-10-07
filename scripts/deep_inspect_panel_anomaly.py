#!/usr/bin/env python3
import subprocess

def inspect_panel_anomaly():
    print("==========================================================")
    print("      DEEP INSPECTION: PANEL ANOMALY DIAGNOSIS (01:43)    ")
    print("==========================================================")

    # 1. Read all gnome-shell logs for the last 5 minutes
    cmd = ["journalctl", "--since", "5 minutes ago", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    print(f"Total gnome-shell log lines in last 5 minutes: {len(logs)}\n")

    # Filter critical warnings, errors, or anomalies
    anomalies = []
    for l in logs:
        if any(k in l for k in ["RightDock", "Desktop", "error", "Error", "warning", "Warning", "CRITICAL", "allocat", "stole", "intellihide"]):
            anomalies.append(l)

    print("=== CHRONOLOGICAL LOGS OF ANOMALIES & EXTENSION EVENTS ===")
    for l in anomalies[-40:]:
        print("  ", l)

    print("==========================================================")

if __name__ == "__main__":
    inspect_panel_anomaly()

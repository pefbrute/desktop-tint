#!/usr/bin/env python3
import subprocess

def analyze_logs():
    print("=== DOCK SYSTEM LOG ANALYSIS ===")
    
    # Fetch gnome-shell logs from journalctl
    cmd = ["journalctl", "-n", "500", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    rightdock_logs = [line for line in logs if "RightDock" in line or "desktop" in line]
    print(f"Found {len(rightdock_logs)} RightDock entries in recent 500 journal lines.\n")

    events = {
        "press": [],
        "clicked": [],
        "activate": [],
        "sync": [],
        "preview": []
    }

    for line in rightdock_logs:
        if "button-press" in line:
            events["press"].append(line)
        elif "clicked" in line:
            events["clicked"].append(line)
        elif "ACTIVATE" in line:
            events["activate"].append(line)
        elif "SYNC" in line:
            events["sync"].append(line)
        elif "Preview" in line:
            events["preview"].append(line)

    print(f"Summary of RightDock Log Events:")
    print(f" - Button Press Events:   {len(events['press'])}")
    print(f" - Clicked Events:        {len(events['clicked'])}")
    print(f" - Window Activations:    {len(events['activate'])}")
    print(f" - Structural Syncs:      {len(events['sync'])}")
    print(f" - Window Previews:       {len(events['preview'])}\n")

    print("Recent 10 RightDock events:")
    for line in rightdock_logs[-10:]:
        print("  ", line)

if __name__ == "__main__":
    analyze_logs()

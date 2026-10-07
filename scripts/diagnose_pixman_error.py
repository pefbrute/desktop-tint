#!/usr/bin/env python3
import subprocess

def inspect_pixman():
    print("==========================================================")
    print("INSPECTING PIXMAN & GRAPHICS BUFFER LOGS AROUND 01:42:31")
    print("==========================================================")

    cmd = ["journalctl", "--since", "01:42:00", "--until", "01:43:00", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    print(f"Total log lines: {len(logs)}\n")
    for l in logs:
        if any(k in l for k in ["pixman", "Clutter", "texture", "Preview", "RightDock", "Desktop"]):
            print("  ", l)

    print("==========================================================")

if __name__ == "__main__":
    inspect_pixman()

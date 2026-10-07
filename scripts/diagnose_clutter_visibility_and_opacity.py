#!/usr/bin/env python3
import subprocess

def diagnose_visibility_and_autohide():
    print("==========================================================")
    print("      DIAGNOSING CLUTTER VISIBILITY, OPACITY & AUTOHIDE  ")
    print("==========================================================")

    res1 = subprocess.run(["gsettings", "get", "org.gnome.shell.extensions.right-dock", "autohide-mode"], capture_output=True, text=True)
    print("GSettings autohide-mode:", res1.stdout.strip())

    res2 = subprocess.run(["gsettings", "get", "org.gnome.shell.extensions.right-dock", "icon-size"], capture_output=True, text=True)
    print("GSettings icon-size:", res2.stdout.strip())

    res3 = subprocess.run(["gsettings", "get", "org.gnome.shell.extensions.right-dock", "intellihide"], capture_output=True, text=True)
    print("GSettings intellihide:", res3.stdout.strip())

    res4 = subprocess.run(["python3", "/home/fedor/projects/Desktop Tint/scripts/inspect_journalctl.py", "40"], capture_output=True, text=True)
    print("\nRecent Journalctl Logs:\n", res4.stdout.strip())

if __name__ == "__main__":
    diagnose_visibility_and_autohide()

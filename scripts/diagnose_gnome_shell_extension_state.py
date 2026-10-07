#!/usr/bin/env python3
import subprocess

def diagnose_extension_state():
    print("==========================================================")
    print("      DIAGNOSING GNOME EXTENSION ENABLED STATE            ")
    print("==========================================================")

    res1 = subprocess.run(["gsettings", "get", "org.gnome.shell", "enabled-extensions"], capture_output=True, text=True)
    print("Enabled Extensions GSettings:", res1.stdout.strip())

    res2 = subprocess.run(["gsettings", "get", "org.gnome.shell", "disabled-extensions"], capture_output=True, text=True)
    print("Disabled Extensions GSettings:", res2.stdout.strip())

    res3 = subprocess.run(["gnome-extensions", "info", "right-dock"], capture_output=True, text=True)
    print("\nExtension Info:\n", res3.stdout.strip())

    res4 = subprocess.run(["journalctl", "-n", "40", "--no-pager", "/usr/bin/gnome-shell"], capture_output=True, text=True)
    logs = res4.stdout.splitlines()
    error_logs = [l for l in logs if any(k in l for k in ["right-dock", "JS ERROR", "disposed", "Error"])]
    print(f"\nRecent Journalctl Errors ({len(error_logs)} matching):")
    for l in error_logs[-15:]:
        print("  ", l)

if __name__ == "__main__":
    diagnose_extension_state()

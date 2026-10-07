#!/usr/bin/env python3
import subprocess

def check_live_state():
    print("=== LIVE EXTENSION STATE CHECK ===")

    # Check gnome-extensions info
    cmd = ["gnome-extensions", "info", "right-dock"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("gnome-extensions info right-dock:")
    print(res.stdout.strip() if res.stdout else res.stderr.strip())

    # Check dbus state of right-dock
    dbus_cmd = [
        "gdbus", "call", "--session",
        "--dest", "org.gnome.Shell",
        "--object-path", "/org/gnome/Shell",
        "--method", "org.gnome.Shell.Extensions.GetExtensionInfo",
        "right-dock"
    ]
    dbus_res = subprocess.run(dbus_cmd, capture_output=True, text=True)
    print("\nDBus Extension State:")
    print(dbus_res.stdout.strip() if dbus_res.stdout else dbus_res.stderr.strip())

if __name__ == "__main__":
    check_live_state()

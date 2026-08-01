#!/usr/bin/env python3
import subprocess
import time

def force_enable():
    print("==========================================================")
    print("      FORCING GNOME SHELL EXTENSION STATE RESET          ")
    print("==========================================================")

    # 1. Disable extension in GSettings
    subprocess.run(["gnome-extensions", "disable", "right-dock@pasynkov"], capture_output=True)
    time.sleep(0.5)

    # 2. Re-enable extension in GSettings
    subprocess.run(["gnome-extensions", "enable", "right-dock@pasynkov"], capture_output=True)
    time.sleep(0.5)

    # 3. Reload GNOME Shell ExtensionManager via DBus Eval if available
    eval_script = 'Main.extensionManager.reloadExtension(Main.extensionManager.lookup("right-dock@pasynkov"));'
    cmd = ["gdbus", "call", "--session", "--dest", "org.gnome.Shell", "--object-path", "/org/gnome/Shell", "--method", "org.gnome.Shell.Eval", eval_script]
    subprocess.run(cmd, capture_output=True, text=True)

    # 4. Check extension info state
    res = subprocess.run(["gnome-extensions", "info", "right-dock@pasynkov"], capture_output=True, text=True)
    print("Current Extension Info State:")
    print(res.stdout.strip())
    print("==========================================================")

if __name__ == "__main__":
    force_enable()

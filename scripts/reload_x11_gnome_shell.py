#!/usr/bin/env python3
import subprocess
import time

def reload_x11_gnome_shell():
    print("==========================================================")
    print("      RESTARTING GNOME SHELL IN PLACE ON X11              ")
    print("==========================================================")

    # Re-enable right-dock in GSettings first
    subprocess.run(["gsettings", "set", "org.gnome.shell", "enabled-extensions", "['gnomebedtime@ionutbortis.gmail.com', 'desktop-tint@pefbrute.github.io', 'right-dock']"], capture_output=True)

    # Issue killall -HUP gnome-shell to restart X11 window manager in place
    res = subprocess.run(["killall", "-HUP", "gnome-shell"], capture_output=True, text=True)
    print("killall -HUP output:", res.stdout.strip(), res.stderr.strip())

    time.sleep(2.0)

    # Check extension info state after reload
    res_info = subprocess.run(["gnome-extensions", "info", "right-dock"], capture_output=True, text=True)
    print("\nUpdated Extension Info State:\n", res_info.stdout.strip())
    print("==========================================================")

if __name__ == "__main__":
    reload_x11_gnome_shell()

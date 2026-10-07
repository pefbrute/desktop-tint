#!/usr/bin/env python3
import os
import subprocess

def check_copy():
    target = "/home/fedor/.local/share/gnome-shell/extensions/right-dock"
    source = "/home/fedor/projects/Ubuntu-Panel/right-dock"

    print(f"Target path: {target}")
    print(f"Is symlink: {os.path.islink(target)}")
    if os.path.islink(target):
        print(f"Symlink points to: {os.readlink(target)}")
    else:
        print("Target is a DIRECTORY (NOT A SYMLINK!)")

    # Compare extension.js files
    res = subprocess.run(["diff", "-u", f"{source}/extension.js", f"{target}/extension.js"], capture_output=True, text=True)
    if res.stdout:
        print("DIFF FOUND BETWEEN SOURCE AND INSTALLED EXTENSION.JS:")
        print(res.stdout[:500])
    else:
        print("Source and Installed extension.js are IDENTICAL.")

if __name__ == "__main__":
    check_copy()

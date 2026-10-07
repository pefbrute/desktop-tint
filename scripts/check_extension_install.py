#!/usr/bin/env python3
import os
import subprocess
import hashlib

def run_check():
    print("==========================================================")
    print("EXTENSION INSTALLATION & SYMLINK DIAGNOSTIC")
    print("==========================================================")

    proj_dir = "/home/fedor/projects/Ubuntu-Panel/right-dock"
    loaded_dir = "/home/fedor/.local/share/gnome-shell/extensions/right-dock"

    print(f"1. Checking Paths:")
    print(f"   Project Dir: {proj_dir}")
    print(f"   Loaded Dir:  {loaded_dir}\n")

    for path_name, p in [("Project Dir", proj_dir), ("Loaded Dir", loaded_dir)]:
        if os.path.exists(p):
            rp = os.path.realpath(p)
            print(f"   [OK] {path_name} exists -> realpath: {rp}")
        else:
            print(f"   [MISSING] {path_name} does NOT exist at {p}")

    print("\n2. Checking extension.js files:")
    proj_js = os.path.join(proj_dir, "extension.js")
    loaded_js = os.path.join(loaded_dir, "extension.js")

    for label, path in [("Project extension.js", proj_js), ("Loaded extension.js", loaded_js)]:
        if os.path.exists(path):
            real_path = os.path.realpath(path)
            with open(real_path, "rb") as f:
                h = hashlib.sha256(f.read()).hexdigest()
            print(f"   {label}: realpath={real_path} sha256={h[:16]}...")
        else:
            print(f"   {label}: DOES NOT EXIST at {path}")

    print("\n3. Grepping for button-press-event and activateOrMinimize:")
    dirs_to_grep = [p for p in [proj_dir, loaded_dir] if os.path.exists(p)]
    
    if dirs_to_grep:
        cmd = ["grep", "-RInE", "button-press-event|vfunc_button_press_event|activateOrMinimize", *dirs_to_grep]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.stdout.strip():
            print(res.stdout)
        else:
            print("   No occurrences found.")
    else:
        print("   No valid directories to grep.")

    print("\n4. Checking all installed extension UUIDs in ~/.local/share/gnome-shell/extensions:")
    ext_root = os.path.expanduser("~/.local/share/gnome-shell/extensions")
    if os.path.exists(ext_root):
        exts = os.listdir(ext_root)
        for e in exts:
            full = os.path.join(ext_root, e)
            print(f"   - {e} -> realpath={os.path.realpath(full)}")
    else:
        print("   Directory ~/.local/share/gnome-shell/extensions does not exist.")

    print("==========================================================")

if __name__ == "__main__":
    run_check()

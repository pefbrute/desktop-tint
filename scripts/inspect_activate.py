#!/usr/bin/env python3

def inspect_activate():
    target_file = "/home/fedor/projects/Ubuntu-Panel/right-dock/extension.js"
    with open(target_file, "r") as f:
        lines = f.readlines()

    print("=== INSPECTING LINES 270 to 330 OF RIGHTDOCK EXTENSION.JS ===")
    for i in range(269, min(len(lines), 335)):
        print(f"{i+1:4d}: {lines[i]}", end="")

if __name__ == "__main__":
    inspect_activate()

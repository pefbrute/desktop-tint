#!/usr/bin/env python3

def inspect_lines():
    target_file = "/home/fedor/projects/Ubuntu-Panel/right-dock/extension.js"
    with open(target_file, "r") as f:
        lines = f.readlines()

    print("=== INSPECTING LINES 170 to 220 OF RIGHTDOCK EXTENSION.JS ===")
    for i in range(169, min(len(lines), 230)):
        print(f"{i+1:4d}: {lines[i]}", end="")

if __name__ == "__main__":
    inspect_lines()

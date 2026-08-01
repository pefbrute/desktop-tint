#!/usr/bin/env python3
import sys
import subprocess

def inspect_journal(lines=50, filter_term=None):
    cmd = ["journalctl", "-n", str(lines), "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    out = res.stdout.splitlines()
    if filter_term:
        out = [l for l in out if filter_term.lower() in l.lower()]
    print(f"=== JOURNALCTL AUTOMATED INSPECTOR (last {lines} lines) ===")
    for line in out[-lines:]:
        print(line)

if __name__ == "__main__":
    lines = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    filter_term = sys.argv[2] if len(sys.argv) > 2 else None
    inspect_journal(lines, filter_term)

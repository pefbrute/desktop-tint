#!/usr/bin/env bash
# Script to reload / restart GNOME Shell and extensions safely

echo "=== RESTARTING / RELOADING GNOME SHELL EXTENSIONS ==="
echo "Timestamp: $(date -Iseconds)"

# 1. Trigger DBus Eval restart for GNOME Shell (if X11/supported)
busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting...")' 2>/dev/null || true

# 2. Cycle disable/enable for all active local extensions
echo "Cycling extension states..."
gnome-extensions disable right-dock 2>/dev/null || true
gnome-extensions disable desktop-tint@pefbrute.github.io 2>/dev/null || true

sleep 1

gnome-extensions enable desktop-tint@pefbrute.github.io 2>/dev/null || true
gnome-extensions enable right-dock 2>/dev/null || true

echo "=== GNOME SHELL RELOAD COMPLETE ==="

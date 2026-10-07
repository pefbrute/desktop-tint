#!/usr/bin/env python3
import subprocess
import re

def reclassify_click_events():
    print("==========================================================")
    print("ENHANCED CLICK DIAGNOSTIC & EVENT SUB-CLASSIFICATION")
    print("==========================================================")

    cmd = ["journalctl", "-n", "5000", "--no-pager", "/usr/bin/gnome-shell"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    logs = res.stdout.splitlines()

    dock_logs = [l for l in logs if "RightDock" in l or "desktop" in l]

    presses = []
    releases = []
    clicks = []
    drags = []

    for idx, l in enumerate(dock_logs):
        if "button-press" in l or "press-event" in l:
            presses.append((idx, l))
        elif "RELEASE" in l or "button-release" in l:
            releases.append((idx, l))
        elif "clicked" in l:
            clicks.append((idx, l))
        elif "drag-begin" in l or "DND" in l:
            drags.append((idx, l))

    print(f"Stats over last {len(dock_logs)} dock log lines:")
    print(f"  - Press events:   {len(presses)}")
    print(f"  - Release events: {len(releases)}")
    print(f"  - Clicked events: {len(clicks)}")
    print(f"  - Drag events:    {len(drags)}\n")

    # Classification buckets
    group_a_no_release = []        # press without release (Lifecycle/Grab loss)
    group_b_dnd = []               # press + release + drag (Normal DND)
    group_c1_dock_moved = []       # contained=false, dock coords changed (autohide/transition)
    group_c2_preview_popup = []     # contained=false, coords unchanged, picked=preview (popup overlay)
    group_c3_micro_move = []       # contained=false, picked=another icon (micro-move cancellation)
    group_d_state_corrupt = []     # contained=true, but missing clicked (St.Button corruption)

    for p_idx, p_line in presses:
        rel_match = next((r_line for r_idx, r_line in releases if 0 <= r_idx - p_idx <= 10), None)
        clk_match = next((c_line for c_idx, c_line in clicks if 0 <= c_idx - p_idx <= 10), None)
        drag_match = next((d_line for d_idx, d_line in drags if 0 <= d_idx - p_idx <= 10), None)

        if not rel_match:
            group_a_no_release.append(p_line)
        elif drag_match:
            group_b_dnd.append((p_line, rel_match))
        elif "contained=false" in rel_match:
            if "dockMoved=true" in rel_match or "coordsChanged" in rel_match:
                group_c1_dock_moved.append((p_line, rel_match))
            elif "picked=Preview" in rel_match or "StWidget" in rel_match:
                group_c2_preview_popup.append((p_line, rel_match))
            elif "picked=DockAppIcon" in rel_match:
                group_c3_micro_move.append((p_line, rel_match))
            else:
                group_c2_preview_popup.append((p_line, rel_match))
        elif not clk_match:
            group_d_state_corrupt.append((p_line, rel_match))

    print("=== RECLASSIFIED CLICK FAILURES & SUB-GROUPS ===")
    print(f"Group A (Press without Release -> Real Grab/Lifecycle Loss): {len(group_a_no_release)}")
    for l in group_a_no_release[:3]:
        print("  [Group A]", l)

    print(f"\nGroup B (Press + Release + Drag -> Normal DND): {len(group_b_dnd)}")

    print(f"\nGroup C1 (Contained=False, Dock Coords Changed -> Autohide/Transition): {len(group_c1_dock_moved)}")
    print(f"Group C2 (Contained=False, Coords Unchanged, Picked=Preview -> Popup Overlay): {len(group_c2_preview_popup)}")
    print(f"Group C3 (Contained=False, Picked=Adjacent Icon -> Mouse Micro-Movement): {len(group_c3_micro_move)}")

    print(f"\nGroup D (Contained=True, but NO Clicked -> St.Button Corrupted): {len(group_d_state_corrupt)}")
    print("==========================================================")

if __name__ == "__main__":
    reclassify_click_events()

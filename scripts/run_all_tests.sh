#!/usr/bin/env bash
# Master Test Suite & Verification Runner for Pasynkov Tint & RightDock

set -e

echo "=========================================================="
echo "      RUNNING MASTER TEST SUITE FOR RIGHT DOCK EXTENSION   "
echo "=========================================================="

EXTENSION_DIR="/home/fedor/projects/Ubuntu-Panel-Pasynkov/right-dock@pasynkov"
TINT_DIR="/home/fedor/projects/Pasynkov Tint"

# 1. JS Syntax Check
echo "[1/4] Checking JS syntax with Node..."
node -c "$EXTENSION_DIR/extension.js"
echo "  - JS Syntax: OK ✅"

# 2. GSettings Schema Validation
echo "[2/4] Validating and compiling GSettings schema..."
glib-compile-schemas "$EXTENSION_DIR/schemas"
echo "  - GSettings Schema: OK ✅"

# 3. Desktop Files Integrity Check
echo "[3/4] Running favorites desktop files audit..."
python3 "$TINT_DIR/scripts/diagnose_favorites_visibility_live.py" > /dev/null
echo "  - Desktop Files: OK ✅"

# 4. Automated Health Auditor
echo "[4/4] Executing live health auditor..."
python3 "$TINT_DIR/scripts/dock_health_auditor.py"

echo "=========================================================="
echo "      ALL MASTER TESTS COMPLETED SUCCESSFULLY ✅          "
echo "=========================================================="

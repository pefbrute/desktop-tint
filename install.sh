#!/usr/bin/env bash
#
# Desktop Tint - Automatic Installer Script
# Installs and enables Desktop Tint GNOME Shell extension in one command.
#

set -e

UUID="pasynkov-tint@fedor-pasynkov.ru"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🎨 Installing Desktop Tint GNOME Extension..."

# 1. Create extension directory
mkdir -p "$INSTALL_DIR"

# 2. Copy extension files
echo "📦 Copying files to $INSTALL_DIR..."
rsync -a --exclude='.git' \
         --exclude='Pasynkov_Tint_TZ.md' \
         --exclude='ARTICLE_DEV_TO.md' \
         --exclude='BUG_OFFSCREEN_FRAMEBUFFER.md' \
         --exclude='BUGS_AND_FIXES.md' \
         --exclude='install.sh' \
         "$SCRIPT_DIR/" "$INSTALL_DIR/"

# 3. Compile GSettings schemas
if [ -d "$INSTALL_DIR/schemas" ]; then
    echo "⚙️ Compiling GSettings schemas..."
    glib-compile-schemas "$INSTALL_DIR/schemas/"
fi

# 4. Enable extension
if command -v gnome-extensions >/dev/null 2>&1; then
    echo "🚀 Enabling extension..."
    gnome-extensions enable "$UUID" || true
    echo "✨ Desktop Tint successfully installed and enabled!"
else
    echo "⚠️ gnome-extensions CLI not found. Please enable '$UUID' via Extension Manager."
fi

echo ""
echo "🎉 Done! You can now control Desktop Tint from your top panel."

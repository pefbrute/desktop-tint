/**
 * Desktop Tint - Top Bar Panel Indicator
 * Panel button with popup menu for preset selection, intensity slider,
 * and emergency reset. Supports scroll-to-adjust-intensity.
 */

const { GObject, St, Clutter, Gio } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider    = imports.ui.slider;
const Main      = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function _(str) {
    try {
        return ExtensionUtils.gettext(str);
    } catch (_) {
        return str;
    }
}

const { getNextPresetId, getPreset, PRESETS, PRESET_ORDER } = Me.imports.lib.presets;

// Emoji / symbol for each preset shown in the panel icon label area
const PRESET_EMOJI = {
    off:       '○',
    amber:     '🟡',
    green:     '🟢',
    cyan:      '🔵',
    sepia:     '🟤',
    grayscale: '⬜',
};

var DesktopTintIndicator = GObject.registerClass(
class DesktopTintIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Desktop Tint', false);
        this._extension = extension;
        this._settings  = ExtensionUtils.getSettings();

        // --- Icon ---
        const path = Me.path || extension.path || '';
        const iconPath = `${path}/icons/desktop-tint-symbolic.svg`;
        this._gicon = Gio.icon_new_for_string(iconPath);
        this._icon  = new St.Icon({
            gicon:       this._gicon,
            style_class: 'system-status-icon desktop-tint-icon',
        });
        this.add_child(this._icon);

        this._buildMenu();

        this.connect('scroll-event',       this._onScroll.bind(this));
        this.connect('button-press-event', this._onButtonPress.bind(this));

        this._settingsSignals = [];
        this._bindSettings();
        this._updateUi();
    }

    _bindSettings() {
        ['effect-enabled', 'preset', 'intensity', 'click-action', 'show-osd']
            .forEach(key => {
                const id = this._settings.connect(`changed::${key}`, () => this._updateUi());
                this._settingsSignals.push(id);
            });
    }

    _buildMenu() {
        // ── 1. Enable / Disable toggle ──────────────────────────────────────
        this._switchItem = new PopupMenu.PopupSwitchMenuItem(
            _('Filter Active'),
            this._settings.get_boolean('effect-enabled')
        );
        this._switchItem.connect('toggled', (_item, state) => {
            this._settings.set_boolean('effect-enabled', state);
        });
        this.menu.addMenuItem(this._switchItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Color Filter')));

        // ── 2. Preset radio items ────────────────────────────────────────────
        this._presetMenuItems = {};

        PRESET_ORDER.forEach(presetId => {
            const preset = PRESETS[presetId];
            const emoji  = PRESET_EMOJI[presetId] || '';
            const label  = `${emoji}  ${_(preset.name)}`;
            const item   = new PopupMenu.PopupMenuItem(label);

            item.connect('activate', () => {
                this._settings.set_string('preset', presetId);
                this._settings.set_boolean('effect-enabled', presetId !== 'off');

                // Grayscale: jump to max intensity so the user sees true B&W
                if (presetId === 'grayscale') {
                    this._settings.set_double('intensity', 1.0);
                }
            });

            this._presetMenuItems[presetId] = item;
            this.menu.addMenuItem(item);
        });

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Intensity')));

        // ── 3. Intensity slider ──────────────────────────────────────────────
        const intensityHeader = new PopupMenu.PopupMenuItem(_('Intensity'), { reactive: false });
        this._intensityLabel  = new St.Label({
            text:     `${Math.round(this._settings.get_double('intensity') * 100)}%`,
            x_align:  Clutter.ActorAlign.END,
            x_expand: true,
        });
        intensityHeader.add_child(this._intensityLabel);
        this.menu.addMenuItem(intensityHeader);

        const sliderItem  = new PopupMenu.PopupBaseMenuItem({ activate: false });
        this._slider      = new Slider.Slider(this._settings.get_double('intensity'));
        this._slider.connect('notify::value', slider => {
            const v = Math.round(slider.value * 20) / 20;          // step 5%
            const c = Math.max(0.05, Math.min(1.0, v));
            this._intensityLabel.text = `${Math.round(c * 100)}%`;
            this._settings.set_double('intensity', c);
        });
        sliderItem.add_child(this._slider);
        this.menu.addMenuItem(sliderItem);

        // Quick buttons: Min / Max
        const quickItem   = new PopupMenu.PopupBaseMenuItem({ activate: false });
        const quickBox    = new St.BoxLayout({ x_expand: true });

        const minBtn = new St.Button({
            label:       _('5%'),
            style_class: 'desktop-quick-btn',
            x_expand:    true,
        });
        minBtn.connect('clicked', () => this._settings.set_double('intensity', 0.05));

        const maxBtn = new St.Button({
            label:       _('100% (B&W)'),
            style_class: 'desktop-quick-btn',
            x_expand:    true,
        });
        maxBtn.connect('clicked', () => this._settings.set_double('intensity', 1.0));

        quickBox.add_child(minBtn);
        quickBox.add_child(maxBtn);
        quickItem.add_child(quickBox);
        this.menu.addMenuItem(quickItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // ── 4. Emergency Reset (always visible!) ────────────────────────────
        const resetItem = new PopupMenu.PopupMenuItem(`⚠  ${_('Emergency Reset')}`);
        resetItem.connect('activate', () => this.emergencyReset());
        this.menu.addMenuItem(resetItem);

        // ── 5. Preferences ──────────────────────────────────────────────────
        const prefsItem = new PopupMenu.PopupMenuItem(_('Preferences…'));
        prefsItem.connect('activate', () => {
            try {
                // GNOME 45+: openPreferences is on the Extension object
                if (typeof Me.openPreferences === 'function') {
                    Me.openPreferences();
                } else if (typeof ExtensionUtils.openPreferences === 'function') {
                    ExtensionUtils.openPreferences();
                }
            } catch (e) {
                console.error('[Desktop Tint] Cannot open preferences:', e);
            }
        });
        this.menu.addMenuItem(prefsItem);
    }

    // ─── Emergency Reset ────────────────────────────────────────────────────
    emergencyReset() {
        try {
            this._settings.set_boolean('effect-enabled', false);
            this._settings.set_string('preset', 'off');
            this._settings.set_double('intensity', 0.65);

            if (this._extension && this._extension._effectManager) {
                this._extension._effectManager.disableEffect();
            }

            if (Main.osdWindowManager) {
                Main.osdWindowManager.show(-1, this._gicon, _('Desktop Tint: Reset'), 0);
            }
        } catch (e) {
            console.error('[Desktop Tint] emergencyReset error:', e);
        }
    }

    // ─── UI State Update ────────────────────────────────────────────────────
    _updateUi() {
        const enabled   = this._settings.get_boolean('effect-enabled');
        const presetId  = this._settings.get_string('preset');
        const intensity = this._settings.get_double('intensity');

        // Icon style
        if (enabled && presetId !== 'off') {
            this._icon.remove_style_class_name('desktop-tint-icon-disabled');
            this._icon.add_style_class_name('desktop-tint-icon-enabled');
            this.add_style_class_name('desktop-tint-indicator-active');
        } else {
            this._icon.remove_style_class_name('desktop-tint-icon-enabled');
            this._icon.add_style_class_name('desktop-tint-icon-disabled');
            this.remove_style_class_name('desktop-tint-indicator-active');
        }

        // Toggle switch
        this._switchItem.setToggleState(enabled);

        // Preset ornaments (radio-like dot)
        PRESET_ORDER.forEach(id => {
            const item = this._presetMenuItems[id];
            if (!item) return;
            const active = (id === presetId) && (enabled || id === 'off');
            item.setOrnament(active ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        });

        // Slider & label
        this._slider.value    = intensity;
        this._intensityLabel.text = `${Math.round(intensity * 100)}%`;
    }

    // ─── Scroll: adjust intensity ────────────────────────────────────────────
    _onScroll(_actor, event) {
        const dir = event.get_scroll_direction();
        let cur   = this._settings.get_double('intensity');
        const step = 0.05;

        if (dir === Clutter.ScrollDirection.UP) {
            cur = Math.min(1.0, cur + step);
        } else if (dir === Clutter.ScrollDirection.DOWN) {
            cur = Math.max(0.05, cur - step);
        } else if (dir === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            if      (dy < 0) cur = Math.min(1.0, cur + step);
            else if (dy > 0) cur = Math.max(0.05, cur - step);
        }

        cur = Math.round(cur * 20) / 20;
        if (cur !== this._settings.get_double('intensity')) {
            this._settings.set_double('intensity', cur);
            if (this._settings.get_boolean('show-osd')) {
                this._showOsd(cur);
            }
        }
        return Clutter.EVENT_STOP;
    }

    // ─── Primary click: cycle / toggle / open menu ───────────────────────────
    //
    // NOTE: PanelMenu.Button._onEvent() already toggles the menu on ANY
    // button-press event (before our handler fires). So:
    //   • Right-click  → parent opened the menu; we do nothing extra. ✓
    //   • Left-click (cycle/toggle) → parent opened the menu; we close it,
    //     then perform our action.
    //   • Left-click (menu) → parent already opened the menu; we just propagate.
    //
    _onButtonPress(_actor, event) {
        const button = event.get_button();
        const action = this._settings.get_string('click-action');

        if (button === 1) {
            if (action === 'cycle') {
                // Parent already opened the menu — close it.
                this.menu.close();
                const cur    = this._settings.get_string('preset');
                const on     = this._settings.get_boolean('effect-enabled');
                const nextId = getNextPresetId(on ? cur : 'off');
                this._settings.set_string('preset', nextId);
                this._settings.set_boolean('effect-enabled', nextId !== 'off');
                return Clutter.EVENT_STOP;
            } else if (action === 'toggle') {
                this.menu.close();
                this._settings.set_boolean('effect-enabled',
                    !this._settings.get_boolean('effect-enabled'));
                return Clutter.EVENT_STOP;
            }
            // action === 'menu': parent already opened the menu → propagate.
        }
        // Right-click (button 3): parent already toggled the menu → nothing to do.
        return Clutter.EVENT_PROPAGATE;
    }

    // ─── OSD overlay ────────────────────────────────────────────────────────
    _showOsd(intensity) {
        try {
            const preset = getPreset(this._settings.get_string('preset'));
            const label  = `Desktop Tint · ${_(preset.name)} · ${Math.round(intensity * 100)}%`;
            if (Main.osdWindowManager) {
                Main.osdWindowManager.show(-1, this._gicon, label, intensity);
            }
        } catch (e) {
            console.error('[Desktop Tint] OSD error:', e);
        }
    }

    // ─── Cleanup ─────────────────────────────────────────────────────────────
    destroy() {
        if (this._settingsSignals) {
            this._settingsSignals.forEach(id => this._settings.disconnect(id));
            this._settingsSignals = [];
        }
        super.destroy();
    }
});

/**
 * Desktop Tint – Preferences Window
 * GTK4 / Libadwaita settings dialog for GNOME Shell 45+.
 *
 * Note: In GNOME 45+, initTranslations() is called automatically by the shell
 * before fillPreferencesWindow(). Do NOT call it again here.
 */

const { Adw, Gtk, Gio, GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

function _(s) {
    try {
        return ExtensionUtils.gettext(s);
    } catch (_) {
        return s;
    }
}

/** Called by GNOME Shell before fillPreferencesWindow(). */
function init() {
    // initTranslations is already called by the shell; nothing needed here.
}

/**
 * Build a switch row that works on both libadwaita 1.0 (GNOME 43–44) and
 * libadwaita 1.4+ (GNOME 45+, has Adw.SwitchRow).
 */
function _makeSwitchRow(title, subtitle, settings, key) {
    if (typeof Adw.SwitchRow === 'function') {
        const row = new Adw.SwitchRow({ title, subtitle });
        if (settings) {
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        }
        return row;
    }
    // Fallback: ActionRow + Gtk.Switch suffix
    const row    = new Adw.ActionRow({ title, subtitle });
    const toggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
    if (settings) {
        settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
}

// ────────────────────────────────────────────────────────────────────────────
function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings();

    // ══════════════════════════════════════════════════════
    //  Page 1 · General
    // ══════════════════════════════════════════════════════
    const generalPage = new Adw.PreferencesPage({
        title:     _('General'),
        icon_name: 'preferences-system-symbolic',
    });
    window.add(generalPage);

    // ── Group: Filter ─────────────────────────────────────
    const filterGroup = new Adw.PreferencesGroup({
        title:       _('Color Filter'),
        description: _('Select a visual preset and adjust its strength'),
    });
    generalPage.add(filterGroup);

    // Preset combo
    const presetValues = ['off', 'amber', 'green', 'cyan', 'sepia', 'grayscale'];
    const presetLabels = [
        _('Off'),
        _('Amber – warm yellow (reduces blue light)'),
        _('Green – vintage CRT monochrome'),
        _('Cyan – cool high-contrast blue'),
        _('Sepia – classic warm photo tint'),
        _('Grayscale – true black & white'),
    ];

    const presetRow = new Adw.ComboRow({
        title:    _('Color Preset'),
        subtitle: _('Active desktop color filter'),
        model:    Gtk.StringList.new(presetLabels),
    });

    const curPreset  = settings.get_string('preset');
    const presetIdx  = presetValues.indexOf(curPreset);
    presetRow.selected = presetIdx !== -1 ? presetIdx : 0;

    presetRow.connect('notify::selected', () => {
        const val = presetValues[presetRow.selected];
        if (!val) return;
        settings.set_string('preset', val);
        settings.set_boolean('effect-enabled', val !== 'off');
        // Grayscale: max intensity for true B&W
        if (val === 'grayscale') {
            settings.set_double('intensity', 1.0);
        }
    });
    filterGroup.add(presetRow);

    // Intensity scale row
    const intensityRow = new Adw.ActionRow({
        title:    _('Intensity'),
        subtitle: _('5% = faint tint · 100% = full desaturation (true B&W for Grayscale)'),
    });
    const scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0.05, 1.0, 0.05);
    scale.set_draw_value(true);
    scale.set_value_pos(Gtk.PositionType.RIGHT);
    scale.set_hexpand(true);
    scale.set_valign(Gtk.Align.CENTER);
    scale.set_value(settings.get_double('intensity'));
    scale.connect('value-changed', () => {
        const val = Math.round(scale.get_value() * 20) / 20;
        settings.set_double('intensity', val);
    });
    // Keep slider in sync when changed externally (e.g. from panel indicator)
    settings.connect('changed::intensity', () => {
        scale.set_value(settings.get_double('intensity'));
    });
    intensityRow.add_suffix(scale);
    filterGroup.add(intensityRow);

    // ── Group: Behaviour ──────────────────────────────────
    const behavGroup = new Adw.PreferencesGroup({
        title: _('Behaviour'),
    });
    generalPage.add(behavGroup);

    behavGroup.add(_makeSwitchRow(
        _('Restore effect after login'),
        _('Automatically re-apply the active filter on startup'),
        settings, 'restore-state'
    ));

    const clickRow = new Adw.ComboRow({
        title:    _('Primary Click Action'),
        subtitle: _('What happens when you left-click the panel icon'),
        model:    Gtk.StringList.new([_('Cycle Presets'), _('Toggle Effect'), _('Open Menu')]),
    });
    const clickValues  = ['cycle', 'toggle', 'menu'];
    const curAction    = settings.get_string('click-action');
    const clickIdx     = clickValues.indexOf(curAction);
    clickRow.selected  = clickIdx !== -1 ? clickIdx : 0;
    clickRow.connect('notify::selected', () => {
        const val = clickValues[clickRow.selected];
        if (val) settings.set_string('click-action', val);
    });
    behavGroup.add(clickRow);

    behavGroup.add(_makeSwitchRow(
        _('Show Intensity OSD'),
        _('On-screen display when scrolling intensity with the mouse wheel'),
        settings, 'show-osd'
    ));

    // ══════════════════════════════════════════════════════
    //  Page 2 · Presets
    // ══════════════════════════════════════════════════════
    const presetsPage = new Adw.PreferencesPage({
        title:     _('Presets'),
        icon_name: 'color-select-symbolic',
    });
    window.add(presetsPage);

    const presetsGroup = new Adw.PreferencesGroup({
        title:       _('Built-in Color Filters'),
        description: _('Descriptions of each available visual filter'),
    });
    presetsPage.add(presetsGroup);

    [
        ['⚫  ' + _('Off'),       _('No filter – normal rendering')],
        ['🟡  ' + _('Amber'),     _('Warm amber-yellow tint; reduces harsh blue light emission')],
        ['🟢  ' + _('Green'),     _('Vintage monochrome green CRT display aesthetic')],
        ['🔵  ' + _('Cyan'),      _('Cool cyan-blue tint for high-contrast focus mode')],
        ['🟤  ' + _('Sepia'),     _('Classic warm sepia photo matrix – nostalgic look')],
        ['⬜  ' + _('Grayscale'), _('Full black & white mode (set intensity to 100% for pure B&W)')],
    ].forEach(([name, desc]) => {
        presetsGroup.add(new Adw.ActionRow({ title: name, subtitle: desc }));
    });

    // ══════════════════════════════════════════════════════
    //  Page 3 · About
    // ══════════════════════════════════════════════════════
    const aboutPage = new Adw.PreferencesPage({
        title:     _('About'),
        icon_name: 'help-about-symbolic',
    });
    window.add(aboutPage);

    const aboutGroup = new Adw.PreferencesGroup();
    aboutPage.add(aboutGroup);

    [
        ['Desktop Tint',  _('Version 0.1.0 – Desktop Color Filters for GNOME Shell')],
        [_('Author'),      'pefbrute'],
        [_('License'),     'MIT License'],
        [_('Inspired by'), _('Tint All extension by Amaro Vita')],
    ].forEach(([title, subtitle]) => {
        aboutGroup.add(new Adw.ActionRow({ title, subtitle }));
    });
}

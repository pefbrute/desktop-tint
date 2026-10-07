/**
 * Desktop Tint - Main Extension Entrypoint
 * Manages extension lifecycle (enable, disable), settings listeners, and component connections.
 */

const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { EffectManager } = Me.imports.lib.effectManager;
const { DesktopTintIndicator } = Me.imports.lib.indicator;

class DesktopTintExtension {
    constructor(uuid) {
        this._uuid = uuid;
    }

    enable() {
        ExtensionUtils.initTranslations();
        this._settings = ExtensionUtils.getSettings();
        this._effectManager = new EffectManager();
        this._settingsSignals = [];

        // 1. Create Top Bar Panel Indicator
        this._indicator = new DesktopTintIndicator(this);
        Main.panel.addToStatusArea('desktop-tint', this._indicator);

        // 2. Connect Settings Changed Listeners
        this._bindSettings();

        // 3. Restore State
        this._restoreState();
    }

    _bindSettings() {
        const onSettingChanged = () => {
            this._applyCurrentSettings();
        };

        const keys = ['effect-enabled', 'preset', 'intensity'];
        keys.forEach(key => {
            const id = this._settings.connect(`changed::${key}`, onSettingChanged);
            this._settingsSignals.push(id);
        });
    }

    _restoreState() {
        const enabled      = this._settings.get_boolean('effect-enabled');
        const restoreState = this._settings.get_boolean('restore-state');

        // Respect 'restore-state': if false, don't auto-enable on startup
        if (restoreState && enabled) {
            this._applyCurrentSettings();
        } else if (!restoreState && enabled) {
            // User opted out of state persistence: turn off on startup
            this._settings.set_boolean('effect-enabled', false);
            this._effectManager.disableEffect();
        } else {
            this._effectManager.disableEffect();
        }
    }

    _applyCurrentSettings() {
        const enabled = this._settings.get_boolean('effect-enabled');
        const presetId = this._settings.get_string('preset');
        const intensity = this._settings.get_double('intensity');

        if (enabled && presetId !== 'off') {
            this._effectManager.enableEffect(presetId, intensity);
        } else {
            this._effectManager.disableEffect();
        }
    }

    disable() {
        // Disconnect settings listeners
        if (this._settingsSignals) {
            this._settingsSignals.forEach(id => this._settings.disconnect(id));
            this._settingsSignals = [];
        }

        // Destroy Effect Manager
        if (this._effectManager) {
            this._effectManager.destroy();
            this._effectManager = null;
        }

        // Destroy Top Bar Indicator
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}

function init(meta) {
    const ext = new DesktopTintExtension(meta.uuid);
    ext.path = meta.path;
    ext.dir = meta.dir;
    return ext;
}

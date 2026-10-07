/**
 * Desktop Tint - Preset Definitions
 * Defines color filter presets with shader parameters for the unified GLSL effect.
 */

/**
 * Shader parameters for each preset:
 *
 *   desat    — how much to desaturate (0.0 = keep color, 1.0 = full grayscale base)
 *   tint     — RGB color multiplier applied after desaturation [R, G, B] in 0.0–1.0
 *   tintMix  — how strongly the tint multiplier is blended in (0.0 = none, 1.0 = full)
 *
 * All three are scaled by the user's intensity slider before being sent to the shader.
 */
var PRESETS = {
    off: {
        id: 'off', name: 'Off',
        desat: 0.0, tint: [1.0, 1.0, 1.0], tintMix: 0.0,
    },
    amber: {
        id: 'amber', name: 'Amber',
        desat: 0.80, tint: [1.0, 0.72, 0.28], tintMix: 0.75,
    },
    green: {
        id: 'green', name: 'Green',
        desat: 0.80, tint: [0.45, 1.0, 0.35], tintMix: 0.70,
    },
    cyan: {
        id: 'cyan', name: 'Cyan',
        desat: 0.75, tint: [0.40, 0.88, 1.0], tintMix: 0.70,
    },
    sepia: {
        id: 'sepia', name: 'Sepia',
        desat: 0.85, tint: [1.0, 0.88, 0.55], tintMix: 0.65,
    },
    grayscale: {
        id: 'grayscale', name: 'Grayscale',
        desat: 1.0, tint: [1.0, 1.0, 1.0], tintMix: 0.0,
    },
};

var PRESET_ORDER = ['off', 'amber', 'green', 'cyan', 'sepia', 'grayscale'];

function getNextPresetId(currentId) {
    const idx = PRESET_ORDER.indexOf(currentId);
    if (idx === -1 || idx === PRESET_ORDER.length - 1)
        return PRESET_ORDER[0];
    return PRESET_ORDER[idx + 1];
}

function getPreset(presetId) {
    return PRESETS[presetId] || PRESETS.amber;
}

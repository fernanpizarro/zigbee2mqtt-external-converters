// Keeper external converters (TS0601 Tuya):
//   1) ML-206US        - dimmer 3 canales con backlight RGB  (_TZE204_odxhnome)
//   2) Roller shutter  - cortina 1 gang con backlight RGB    (_TZE284_19jwhi8c)
//
// DPs verificados empíricamente con el equipo físico (jun 2026). Ver detalle
// de cada mapa en los comentarios de cada definición.

const exposes = require('zigbee-herdsman-converters/lib/exposes');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const e = exposes.presets;
const ea = exposes.access;

// Paleta de color de los LEDs de las teclas, compartida por ambos equipos.
const switchColorLookup = {
    red: tuya.enum(0),
    blue: tuya.enum(1),
    green: tuya.enum(2),
    white: tuya.enum(3),
    yellow: tuya.enum(4),
    magenta: tuya.enum(5),
    cyan: tuya.enum(6),
    warm_white: tuya.enum(7),
    warm_yellow: tuya.enum(8),
};

// ---------------------------------------------------------------------------
// Dimmer 3 canales (_TZE204_odxhnome)
//   dp1/2, dp7/8, dp15/16 = state/brightness canales 1-3 (escala 0-1000)
//   dp3/5, 9/11, 17/19 = min/max brillo; dp4/10/18 light_type; dp6/12/20 countdown
//   dp14 power_on_behavior; dp21 backlight mode
//   dp101 color tecla ON; dp102 color tecla OFF (global)
// ---------------------------------------------------------------------------
const dimmer = {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE204_odxhnome']),
    model: 'ML-206US',
    vendor: 'Keeper',
    description: '3 gang smart dimmer with RGB key backlight',
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    exposes: [
        tuya.exposes.lightBrightnessWithMinMax().withEndpoint('l1'),
        tuya.exposes.lightBrightnessWithMinMax().withEndpoint('l2'),
        tuya.exposes.lightBrightnessWithMinMax().withEndpoint('l3'),
        tuya.exposes.countdown().withEndpoint('l1'),
        tuya.exposes.countdown().withEndpoint('l2'),
        tuya.exposes.countdown().withEndpoint('l3'),
        tuya.exposes.lightType().withEndpoint('l1'),
        tuya.exposes.lightType().withEndpoint('l2'),
        tuya.exposes.lightType().withEndpoint('l3'),
        e.power_on_behavior().withAccess(ea.STATE_SET),
        tuya.exposes.backlightModeOffNormalInverted().withAccess(ea.STATE_SET),
        e.enum('switch_color_on', ea.STATE_SET, Object.keys(switchColorLookup))
            .withDescription('LED color of a key while its light is ON'),
        e.enum('switch_color_off', ea.STATE_SET, Object.keys(switchColorLookup))
            .withDescription('LED color of a key while its light is OFF'),
    ],
    meta: {
        multiEndpoint: true,
        tuyaDatapoints: [
            [1, 'state_l1', tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [2, 'brightness_l1', tuya.valueConverter.scale0_254to0_1000],
            [3, 'min_brightness_l1', tuya.valueConverter.scale0_254to0_1000],
            [4, 'light_type_l1', tuya.valueConverter.lightType],
            [5, 'max_brightness_l1', tuya.valueConverter.scale0_254to0_1000],
            [6, 'countdown_l1', tuya.valueConverter.countdown],
            [7, 'state_l2', tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [8, 'brightness_l2', tuya.valueConverter.scale0_254to0_1000],
            [9, 'min_brightness_l2', tuya.valueConverter.scale0_254to0_1000],
            [10, 'light_type_l2', tuya.valueConverter.lightType],
            [11, 'max_brightness_l2', tuya.valueConverter.scale0_254to0_1000],
            [12, 'countdown_l2', tuya.valueConverter.countdown],
            [14, 'power_on_behavior', tuya.valueConverter.powerOnBehaviorEnum],
            [15, 'state_l3', tuya.valueConverter.onOff, {skip: tuya.skip.stateOnAndBrightnessPresent}],
            [16, 'brightness_l3', tuya.valueConverter.scale0_254to0_1000],
            [17, 'min_brightness_l3', tuya.valueConverter.scale0_254to0_1000],
            [18, 'light_type_l3', tuya.valueConverter.lightType],
            [19, 'max_brightness_l3', tuya.valueConverter.scale0_254to0_1000],
            [20, 'countdown_l3', tuya.valueConverter.countdown],
            [21, 'backlight_mode', tuya.valueConverter.backlightModeOffNormalInverted],
            [101, 'switch_color_on', tuya.valueConverterBasic.lookup(switchColorLookup)],
            [102, 'switch_color_off', tuya.valueConverterBasic.lookup(switchColorLookup)],
        ],
    },
    endpoint: (device) => {
        return {l1: 1, l2: 1, l3: 1};
    },
};

// ---------------------------------------------------------------------------
// Roller shutter 1 cortina, 3 botones (_TZE284_19jwhi8c)
//   dp1 control (0=abrir,1=stop,2=cerrar); dp2/3 posición 0-100 (100=abierta)
//   dp8 motor_reversal (0=normal,1=invertido); dp10 tiempo de calibración (s)
//   dp13 color tecla ON; dp103 color tecla OFF; dp14 backlight mode; dp102 brillo backlight
//   Sin mapear: dp7, dp101 (toggles), dp77 (estado read-only)
// ---------------------------------------------------------------------------
const roller = {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE284_19jwhi8c']),
    model: 'KEEPER-ROLLER',
    vendor: 'Keeper',
    description: 'Roller shutter switch with RGB key backlight',
    extend: [tuya.modernExtend.tuyaBase({dp: true})],
    options: [exposes.options.invert_cover()],
    exposes: [
        e.cover_position().setAccess('position', ea.STATE_SET),
        e.binary('motor_reversal', ea.STATE_SET, 'ON', 'OFF').withDescription('Invierte el sentido del motor'),
        e.numeric('calibration_time', ea.STATE_SET).withUnit('s').withValueMin(0).withValueMax(120)
            .withDescription('Tiempo de recorrido completo de la cortina'),
        tuya.exposes.backlightModeOffNormalInverted().withAccess(ea.STATE_SET),
        e.numeric('backlight_brightness', ea.STATE_SET).withUnit('%').withValueMin(1).withValueMax(100)
            .withDescription('Brillo de los LEDs de los botones'),
        e.enum('switch_color_on', ea.STATE_SET, Object.keys(switchColorLookup))
            .withDescription('Color del LED del botón mientras está activado'),
        e.enum('switch_color_off', ea.STATE_SET, Object.keys(switchColorLookup))
            .withDescription('Color del LED del botón mientras está desactivado'),
    ],
    meta: {
        tuyaDatapoints: [
            [1, 'state', tuya.valueConverterBasic.lookup({OPEN: tuya.enum(0), STOP: tuya.enum(1), CLOSE: tuya.enum(2)})],
            [2, 'position', tuya.valueConverter.coverPosition],
            [3, 'position', tuya.valueConverter.coverPosition],
            [8, 'motor_reversal', tuya.valueConverterBasic.lookup({OFF: tuya.enum(0), ON: tuya.enum(1)})],
            [10, 'calibration_time', tuya.valueConverter.raw],
            [14, 'backlight_mode', tuya.valueConverter.backlightModeOffNormalInverted],
            [102, 'backlight_brightness', tuya.valueConverter.raw],
            [13, 'switch_color_on', tuya.valueConverterBasic.lookup(switchColorLookup)],
            [103, 'switch_color_off', tuya.valueConverterBasic.lookup(switchColorLookup)],
        ],
    },
};

module.exports = [dimmer, roller];

// Keeper ML-206US 3-gang Tuya dimmer (TS0601 / _TZE204_odxhnome)
//
// Basado en el TS0601_dimmer_3 upstream (zigbee-herdsman-converters), con los
// datapoints especificos de Keeper verificados empiricamente (2026-06-11):
//   dp1/dp2   state/brightness canal 1
//   dp7/dp8   state/brightness canal 2
//   dp15/dp16 state/brightness canal 3
//   dp21      backlight mode (0=off, 1=normal, 2=inverted)
//   dp101     color del LED con tecla encendida (enum 0-8)
//   dp102     color del LED con tecla apagada (enum 0-8, global a las 3 teclas)
// dp103/dp104 (colores segun el converter del fabricante para la familia de
// switches) resultaron inertes en este dimmer, y no existe DP de brillo
// numerico del backlight (probados 22, 23, 25, 26, 27, 104, 105, 106, 107).

const exposes = require('zigbee-herdsman-converters/lib/exposes');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const e = exposes.presets;
const ea = exposes.access;

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

const definition = {
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

module.exports = definition;

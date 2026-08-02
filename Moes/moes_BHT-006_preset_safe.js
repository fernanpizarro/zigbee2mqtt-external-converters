// Moes BHT-002/BHT-006 (_TZE204_aoclfnxz) - Termostato Cruz (y hermanos Lavadero/Master).
//
// Override SOLO del converter de "preset". El original (moes_thermostat_mode,
// en zigbee-herdsman-converters/lib/legacy.js) no valida el valor recibido:
//   hold     = value === "hold" ? 0 : 1
//   schedule = value === "program" ? 0 : 1
// Home Assistant SIEMPRE ofrece "None" en el selector de preset de cualquier
// entidad climate con presets (fijo del frontend, no configurable). Si se
// elige "Ninguno", HA manda preset "none" -> ambas ramas caen en el "else"
// (hold=1, schedule=1) y el firmware lo interpreta como modo "program",
// cambiando el termostato sin que el usuario lo haya pedido realmente.
//
// Este override ignora (no-op) cualquier valor que no sea EXACTAMENTE "hold"
// o "program". El resto de la definicion (exposes, otros converters, extend)
// se copia igual que el original para no cambiar nada mas del comportamiento.
//
// Ademas, ESTE MISMO ARCHIVO absorbe el throttle del flood de firmware (ver
// memoria pantea-zigbee-throttle-debounce): el modelo tiene un bug conocido
// que repite datapoints en loop (~3 msg/s). En vez de depender de las
// opciones throttle/debounce/filtered_attributes en configuration.yaml (que
// hay que repetir por cada instancia/casa), el fromZigbee de abajo envuelve
// al original con una compuerta de tiempo: si no paso THROTTLE_MS desde el
// ultimo mensaje aceptado, devuelve undefined (z2m no publica NADA, ni
// siquiera linkquality, porque linkquality se agrega en publishEntityState()
// - ver receive.js/controller.js - que solo se llama si el converter
// devolvio contenido). Asi el converter queda autocontenido: alcanza con
// copiar este .js a external_converters/ de una instancia nueva, sin tocar
// su configuration.yaml.

const THROTTLE_MS = 30 * 1000;
const lastAccepted = new Map();

const tuya = require("zigbee-herdsman-converters/lib/tuya");
const legacy = require("zigbee-herdsman-converters/lib/legacy");
const exposes = require("zigbee-herdsman-converters/lib/exposes");
const e = exposes.presets;
const ea = exposes.access;

const exposesLocal = {
    hour: (name) => e.numeric(name, ea.STATE_SET).withUnit("h").withValueMin(0).withValueMax(23),
    minute: (name) => e.numeric(name, ea.STATE_SET).withUnit("m").withValueMin(0).withValueMax(59),
    program_temperature: (name) => e.numeric(name, ea.STATE_SET).withUnit("°C").withValueMin(5).withValueMax(35).withValueStep(0.5),
};

const moes_thermostat_mode_safe = {
    key: ["preset"],
    convertSet: async (entity, key, value, meta) => {
        if (value !== "hold" && value !== "program") {
            // Ignora "none" (y cualquier otro valor invalido) en vez de
            // caer en el else que arma la combinacion de datapoints de "program".
            return;
        }
        const hold = value === "hold" ? 0 : 1;
        const schedule = value === "program" ? 0 : 1;
        await tuya.sendDataPointEnum(entity, legacy.dataPoints.moesHold, hold);
        await tuya.sendDataPointEnum(entity, legacy.dataPoints.moesScheduleEnable, schedule);
    },
};

const moes_thermostat_throttled = {
    cluster: legacy.fz.moes_thermostat.cluster,
    type: legacy.fz.moes_thermostat.type,
    convert: (model, msg, publish, options, meta) => {
        const key = meta.device.ieeeAddr;
        const now = Date.now();
        const last = lastAccepted.get(key) || 0;
        if (now - last < THROTTLE_MS) {
            return undefined;
        }
        lastAccepted.set(key, now);
        return legacy.fz.moes_thermostat.convert(model, msg, publish, options, meta);
    },
};

function programFeatures() {
    const days = ["weekdays", "saturday", "sunday"];
    const periods = [1, 2, 3, 4];
    const features = [];
    for (const day of days) {
        for (const p of periods) {
            features.push(exposesLocal.hour(`${day}_p${p}_hour`));
            features.push(exposesLocal.minute(`${day}_p${p}_minute`));
            features.push(exposesLocal.program_temperature(`${day}_p${p}_temperature`));
        }
    }
    return features;
}

module.exports = {
    fingerprint: [{modelID: "TS0601", manufacturerName: "_TZE204_aoclfnxz", priority: 1}],
    model: "BHT-002",
    vendor: "Moes",
    description: "Moes BHT series Thermostat (preset seguro + throttle interno anti-flood)",
    fromZigbee: [moes_thermostat_throttled],
    toZigbee: [
        legacy.tz.moes_thermostat_child_lock,
        legacy.tz.moes_thermostat_current_heating_setpoint,
        moes_thermostat_mode_safe,
        legacy.tz.moes_thermostat_standby,
        legacy.tz.moes_thermostat_sensor,
        legacy.tz.moes_thermostat_calibration,
        legacy.tz.moes_thermostat_deadzone_temperature,
        legacy.tz.moes_thermostat_max_temperature_limit,
        legacy.tz.moes_thermostat_min_temperature_limit,
        legacy.tz.moes_thermostat_program_schedule,
    ],
    whiteLabel: [tuya.whitelabel("Moes", "BHT-002/BHT-006", "Smart heating thermostat", ["_TZE204_aoclfnxz"])],
    exposes: (device, options) => {
        const features = programFeatures();
        let programExpose = e
            .composite("program", "program", ea.STATE_SET)
            .withDescription("Time of day and setpoint to use when in program mode");
        for (const f of features) {
            programExpose = programExpose.withFeature(f);
        }
        return [
            e.child_lock(),
            e.deadzone_temperature(),
            e.max_temperature_limit().withValueMax(80),
            e.min_temperature_limit(),
            e
                .climate()
                .withSetpoint("current_heating_setpoint", 5, 45, 1, ea.STATE_SET)
                .withLocalTemperature(ea.STATE)
                .withLocalTemperatureCalibration(-30, 30, 1, ea.STATE_SET)
                .withSystemMode(["off", "heat"], ea.STATE_SET)
                .withRunningState(["idle", "heat", "cool"], ea.STATE)
                .withPreset(["hold", "program"]),
            e.temperature_sensor_select(["IN", "AL", "OU"]),
            programExpose,
        ];
    },
    extend: [tuya.modernExtend.tuyaBase({forceTimeUpdates: true, timeStart: "1970"})],
};

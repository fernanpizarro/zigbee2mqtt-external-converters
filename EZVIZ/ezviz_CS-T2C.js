// EZVIZ CS-T2C-A0-BG (model CS-T2C) - sensor de apertura de puerta.
//
// Override del nativo, que expone contact_alarm_1 y contact_alarm_2 (confuso:
// alarm_1 queda true al cerrar; alarm_2 no se usa). Este expone la propiedad
// estandar contact (true = puerta CERRADA), misma convencion que los Tuya TS0203
// (ej. Puerta Parrilla): contact = !(zoneStatus bit0). El bit IAS se enciende al
// ABRIR (hardware normal, verificado en vivo).
//
// FINGERPRINT CON NULOS: el modelID real del device es CS-T2C-A0-BG + 5 bytes
// nulos. findDefinition matchea zigbeeModel con includes(device.modelID) EXACTO
// (no recorta nulos); con 2+ candidatos eso falla y el device cae a generated. El
// match por fingerprint (device.modelID === fingerprint.modelID) requiere el
// modelID exacto con los nulos.

const fz = require("zigbee-herdsman-converters/converters/fromZigbee");
const e = require("zigbee-herdsman-converters/lib/exposes").presets;

module.exports = {
    fingerprint: [{modelID: "CS-T2C-A0-BG\u0000\u0000\u0000\u0000\u0000", manufacturerName: "EZVIZ"}],
    model: "CS-T2C",
    vendor: "EZVIZ",
    description: "Open/close sensor",
    fromZigbee: [fz.ias_contact_alarm_1, fz.ias_contact_alarm_1_report, fz.battery],
    toZigbee: [],
    exposes: [e.contact(), e.battery(), e.tamper(), e.battery_low()],
};

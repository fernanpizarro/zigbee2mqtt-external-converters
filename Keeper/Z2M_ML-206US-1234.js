const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const e = exposes.presets;
const ea = exposes.access;

const DEFAULT_CHANNEL_COUNT = 3;

// 获取通道数（基于制造商名称）
const getChannelCount = (device) => {
    if (!device?.manufacturerName) return DEFAULT_CHANNEL_COUNT;
    
    const manufacturerName = device.manufacturerName.toLowerCase();
    
    if (manufacturerName.includes('e4pf6l87')) return 3; // 三路设备
    if (manufacturerName.includes('dmckrsxg')) return 2; // 二路设备
    if (manufacturerName.includes('lnyz4a6v')) return 1; // 一路设备
    if (manufacturerName.includes('y4jqpry8')) return 4; // 四路设备
    if (manufacturerName.includes('sa2ueffe')) return 3; // tres canales   
    
    return DEFAULT_CHANNEL_COUNT;
};

// 端点映射（所有通道到物理端点1）
const createEndpointMap = (channels) => {
    const map = {l1: 1};
    // 添加虚拟端点映射到物理端点1
    if (channels >= 2) map.l2 = 1;
    if (channels >= 3) map.l3 = 1;
    if (channels >= 4) map.l4 = 1;
    return map;
};

// 使用端点ID后缀的属性名
const createExposes = (device) => {
    const channels = getChannelCount(device);
    const exposesList = [
        e.numeric('backlight_brightness', ea.STATE_SET)
            .withDescription('背光亮度')
            .withUnit('%')
            .withValueMin(0)
            .withValueMax(100)
            .withValueStep(1),
        e.child_lock().withAccess(ea.STATE_SET),
        e.enum('switch_color_on', ea.STATE_SET, ['red', 'blue', 'green', 'white', 'yellow', 'magenta', 'cyan', 'warm_white', 'warm_yellow'])
            .withDescription('开启时的指示灯颜色'),
        e.enum('switch_color_off', ea.STATE_SET, ['red', 'blue', 'green', 'white', 'yellow', 'magenta', 'cyan', 'warm_white', 'warm_yellow'])
            .withDescription('关闭时的指示灯颜色'),
    ];
    
    // 为每个通道添加特定控制项
    for (let i = 1; i <= channels; i++) {
        const endpoint = `l${i}`;
        exposesList.push(
            e.light_brightness().withEndpoint(endpoint),
            e.enum(`relay_status_${endpoint}`, ea.STATE_SET, ['power_on', 'power_off', 'restart_memory'])
                .withDescription(`开关${i}继电器状态`)
                .withEndpoint(endpoint)
        );
    }
    
    return exposesList;
};

// 数据转换器
const ignoreInvalidTuyaEnum = (converter) => ({
    to: converter.to,
    from: (v, meta) => {
        if (v === true || v === false || v === null || v === undefined) {
            return undefined;
        }
        return converter.from(v, meta);
    },
});

const valueConverterLocal = {
    indicatorStatus: ignoreInvalidTuyaEnum(tuya.valueConverterBasic.lookup({
        off: tuya.enum(0),
        on_off_status: tuya.enum(1),
        switch_position: tuya.enum(2),
    })),
    relayStatus: ignoreInvalidTuyaEnum(tuya.valueConverterBasic.lookup({
        power_off: tuya.enum(0),
        power_on: tuya.enum(1),
        restart_memory: tuya.enum(2),
    })),
    switchColor: tuya.valueConverterBasic.lookup({
        red: tuya.enum(0),
        blue: tuya.enum(1),
        green: tuya.enum(2),
        white: tuya.enum(3),
        yellow: tuya.enum(4),
        magenta: tuya.enum(5),
        cyan: tuya.enum(6),
        warm_white: tuya.enum(7),
        warm_yellow: tuya.enum(8),
    }),
    cycleSchedule: {
        to: (v, meta) => {
            const stringValue = String(v ?? '');
            const limitedString = stringValue.slice(0, 50);
            return limitedString.split('').map((char) => char.charCodeAt(0));
        },
        from: (v, meta) => {
            return Array.isArray(v) 
                ? v.map(String.fromCharCode).join('')
                : String(v);
        },
    },
    percent: {
        to: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                throw new Error(`Invalid percent value: ${v}`);
            }
            return Math.max(0, Math.min(100, Math.round(value)));
        },
        from: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                return undefined;
            }
            return Math.max(0, Math.min(100, Math.round(value)));
        },
    },
    brightness: {
        to: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                throw new Error(`Invalid brightness value: ${v}`);
            }
            const clamped = Math.max(0, Math.min(254, Math.round(value)));
            return Math.round((clamped / 254) * 1000);
        },
        from: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                return undefined;
            }
            const clamped = Math.max(0, Math.min(1000, Math.round(value)));
            return Math.round((clamped / 1000) * 254);
        },
    },
    brightnessRaw: {
        to: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                throw new Error(`Invalid brightness value: ${v}`);
            }
            return Math.max(0, Math.min(254, Math.round(value)));
        },
        from: (v, meta) => {
            const value = Number(v);
            if (Number.isNaN(value)) {
                return undefined;
            }
            return Math.max(0, Math.min(254, Math.round(value)));
        },
    },
};

const fzLocal = {
    datapointLogger: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataReport', 'commandDataResponse'],
        convert: (model, msg, publish, options, meta) => {
            const dpValues = msg.data?.dpValues || [];
            const payload = dpValues.map((dpValue) => {
                const raw = dpValue.data;
                const data = Array.isArray(raw) ? raw :
                    Buffer.isBuffer(raw) ? Array.from(raw) :
                    Array.isArray(raw?.data) ? raw.data :
                    Buffer.isBuffer(raw?.data) ? Array.from(raw.data) : [];
                const value = data.reduce((acc, byte) => (acc << 8) + byte, 0);

                return {
                    dp: dpValue.dp,
                    datatype: dpValue.datatype,
                    data,
                    value,
                };
            });
            if (payload.length > 0) {
                meta.logger.info(`ZM21 ZMS-206US datapoints: ${JSON.stringify(payload)}`);
            }
            return {};
        },
    },
};

const tzLocal = {
    brightnessL1: {
        key: ['brightness_l1'],
        convertSet: async (entity, key, value, meta) => {
            const brightness = valueConverterLocal.brightness.to(value, meta);
            await tuya.sendDataPointValue(entity, 5, brightness);
            return {state: {brightness_l1: value}};
        },
    },
};

// 设备定义
const definition = {
    icon: '/hacsfiles/images/ZMS-206US-1.jpg?',
    zigbeeModel: ['TS0601'],
    fingerprint: [
        {type: 'TS0601', manufacturerName: '_TZE204_e4pf6l87'},  // 三路设备
        {type: 'TS0601', manufacturerName: '_TZE204_dmckrsxg'},  // 二路设备
        {type: 'TS0601', manufacturerName: '_TZE204_lnyz4a6v'},   // 一路设备
        {type: 'TS0601', manufacturerName: '_TZE204_y4jqpry8'}, // 四路设备
        {type: 'TS0601', manufacturerName: '_TZE284_sa2ueffe'},  // 其他型号
    ],
    model: 'ZMS-206US',
    vendor: 'ZM21',
    description: '友程DIY智能开关（支持1-4路）',
    
    fromZigbee: [fzLocal.datapointLogger, tuya.fz.datapoints],
    toZigbee: [tzLocal.brightnessL1, tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime,
    
    configure: async (device, coordinatorEndpoint) => {
        try {
            const endpoint = device.getEndpoint(1);
            if (!endpoint) {
                console.error('设备没有端点1，无法配置');
                return;
            }
            
            await tuya.configureMagicPacket(device, coordinatorEndpoint, {endpoint});
        } catch (error) {
            console.error('设备配置错误:', error);
        }
    },
    
    endpoint: (device) => {
        try {
            const channels = getChannelCount(device);
            return createEndpointMap(channels);
        } catch (error) {
            console.error('端点映射错误:', error);
            return createEndpointMap(DEFAULT_CHANNEL_COUNT);
        }
    },
    
    exposes: (device) => {
        try {
            return createExposes(device);
        } catch (error) {
            console.error('暴露项创建错误:', error);
            return createExposes({manufacturerName: ''});
        }
    },
    
    meta: {
        multiEndpoint: true,
        multiEndpointSkip: ['child_lock', 'backlight_brightness',
                           'switch_color_on', 'switch_color_off'],
        tuyaDatapoints: [
            // 公共数据点
            [13, "state", tuya.valueConverter.onOff],
            [14, 'relay_status', tuya.valueConverter.raw],
            [15, 'state_l3', tuya.valueConverter.onOff],
            [16, 'brightness_l3', valueConverterLocal.brightness],
            [24, 'test_bit', tuya.valueConverter.raw],
            [101, 'child_lock', tuya.valueConverter.lockUnlock],
            [102, 'backlight_brightness', tuya.valueConverter.raw],
            [103, 'switch_color_off', valueConverterLocal.switchColor],
            [104, 'switch_color_on', valueConverterLocal.switchColor],
            [201, 'cycle_schedule', valueConverterLocal.cycleSchedule],
            
            // 通道1专用数据点
            [1, 'state_l1', tuya.valueConverter.onOff],
            [29, 'relay_status_l1', valueConverterLocal.relayStatus],
            [2, 'brightness_l1', valueConverterLocal.brightnessRaw],
            [7, 'state_l2', tuya.valueConverter.onOff],
            
            // 通道2专用数据点
            [30, 'relay_status_l2', valueConverterLocal.relayStatus],
            [8, 'brightness_l2', valueConverterLocal.brightness],
            
            // 通道3专用数据点
            [3, 'state_l3_alt', tuya.valueConverter.onOff],
            [31, 'relay_status_l3', valueConverterLocal.relayStatus],
            [9, 'countdown_l3', tuya.valueConverter.raw],
            
            // 通道4专用数据点
            [4, 'state_l4', tuya.valueConverter.onOff],
            [32, 'relay_status_l4', valueConverterLocal.relayStatus],
            [12, 'brightness_l4', valueConverterLocal.percent],
            [10, 'countdown_l4', tuya.valueConverter.raw],
        ]
    }
};

module.exports = definition;

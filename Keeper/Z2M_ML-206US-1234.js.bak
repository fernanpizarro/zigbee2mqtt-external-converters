const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const e = exposes.presets;
const ea = exposes.access;

const { TextEncoder, TextDecoder } = require('util');

// 获取通道数（基于制造商名称）
const getChannelCount = (device) => {
    if (!device?.manufacturerName) return 1;
    
    const manufacturerName = device.manufacturerName.toLowerCase();
    
    if (manufacturerName.includes('e4pf6l87')) return 3; // 三路设备
    if (manufacturerName.includes('dmckrsxg')) return 2; // 二路设备
    if (manufacturerName.includes('lnyz4a6v')) return 1; // 一路设备
    if (manufacturerName.includes('y4jqpry8')) return 4; // 四路设备
    
    return 1;
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
        tuya.exposes.backlightModeOffOn().withAccess(ea.STATE_SET),
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
        e.enum('indicator_status', ea.STATE_SET, ['off', 'on_off_status', 'switch_position'])
            .withDescription('指示灯模式'),
    ];
    
    // 为每个通道添加特定控制项
    for (let i = 1; i <= channels; i++) {
        const endpoint = `l${i}`;
        exposesList.push(
            e.switch().withEndpoint(endpoint),
            e.text('name', ea.STATE_SET)
                .withDescription(`开关${i}名称`)
                .withEndpoint(endpoint),
            e.enum(`relay_status_${endpoint}`, ea.STATE_SET, ['power_on', 'power_off', 'restart_memory'])
                .withDescription(`开关${i}继电器状态`)
                .withEndpoint(endpoint)
        );
    }
    
    return exposesList;
};

// 数据转换器
const valueConverterLocal = {
    indicatorStatus: tuya.valueConverterBasic.lookup({
        off: tuya.enum(0),
        on_off_status: tuya.enum(1),
        switch_position: tuya.enum(2),
    }),
    relayStatus: tuya.valueConverterBasic.lookup({
        power_off: tuya.enum(0),
        power_on: tuya.enum(1),
        restart_memory: tuya.enum(2),
    }),
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
    name: {
        to: (v, meta) => {
            const stringValue = String(v ?? '');
            const encoder = new TextEncoder();
            const encoded = encoder.encode(stringValue);
            const limitedBytes = encoded.slice(0, 50);
            return Array.from(limitedBytes);
        },
        from: (v, meta) => {
            if (!Array.isArray(v)) {
                return String(v);
            }
            const decoder = new TextDecoder('utf-8');
            const uint8Array = new Uint8Array(v);
            return decoder.decode(uint8Array);
        },
    },
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
    
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime,
    
    configure: async (device, coordinatorEndpoint) => {
        try {
            const endpoint = device.getEndpoint(1);
            if (!endpoint) {
                console.error('设备没有端点1，无法配置');
                return;
            }
            
            await tuya.configureMagicPacket(device, coordinatorEndpoint, {endpoint});
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
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
            return { l1: 1 };
        }
    },
    
    exposes: (device) => {
        try {
            return createExposes(device);
        } catch (error) {
            console.error('暴露项创建错误:', error);
            return [e.switch().withEndpoint('l1')];
        }
    },
    
    meta: {
        multiEndpoint: true,
        multiEndpointSkip: ['backlight_mode', 'child_lock', 'backlight_brightness', 
                           'switch_color_on', 'switch_color_off', 'indicator_status'],
        tuyaDatapoints: [
            // 公共数据点
            [13, "state", tuya.valueConverter.onOff],
            [14, 'relay_status', tuya.valueConverter.raw],
            [15, 'indicator_status', valueConverterLocal.indicatorStatus],
            [16, 'backlight_mode', tuya.valueConverter.onOff],
            [24, 'test_bit', tuya.valueConverter.raw],
            [101, 'child_lock', tuya.valueConverter.lockUnlock],
            [102, 'backlight_brightness', tuya.valueConverter.raw],
            [103, 'switch_color_off', valueConverterLocal.switchColor],
            [104, 'switch_color_on', valueConverterLocal.switchColor],
            [201, 'cycle_schedule', valueConverterLocal.cycleSchedule],
            
            // 通道1专用数据点
            [1, 'state_l1', tuya.valueConverter.onOff],
            [29, 'relay_status_l1', valueConverterLocal.relayStatus],
            [7, 'countdown_l1', tuya.valueConverter.raw],
            [105, 'name_l1', valueConverterLocal.name],
            
            // 通道2专用数据点
            [2, 'state_l2', tuya.valueConverter.onOff],
            [30, 'relay_status_l2', valueConverterLocal.relayStatus],
            [8, 'countdown_l2', tuya.valueConverter.raw],
            [106, 'name_l2', valueConverterLocal.name],
            
            // 通道3专用数据点
            [3, 'state_l3', tuya.valueConverter.onOff],
            [31, 'relay_status_l3', valueConverterLocal.relayStatus],
            [9, 'countdown_l3', tuya.valueConverter.raw],
            [107, 'name_l3', valueConverterLocal.name],
            
            // 通道4专用数据点
            [4, 'state_l4', tuya.valueConverter.onOff],
            [32, 'relay_status_l4', valueConverterLocal.relayStatus],
            [10, 'countdown_l4', tuya.valueConverter.raw],
            [108, 'name_l4', valueConverterLocal.name],
        ]
    }
};

module.exports = definition;
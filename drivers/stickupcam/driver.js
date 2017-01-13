"use strict";

const Driver = require('../../lib/Driver.js');

const statusTimeout = 10000;

class DriverStickUpCam extends Driver {

    constructor() {
        super();

        this._deviceType = 'stickupcam';
        this.capabilities = {};

        this.capabilities.measure_battery = {};
        this.capabilities.measure_battery.get = this._onExportsCapabilitiesBatteryGet.bind(this);

        this.capabilities.alarm_motion = {};
        this.capabilities.alarm_motion.get = this._onExportsCapabilitiesAlarmMotionGet.bind(this);

        Homey.app.on('refresh_device', this._syncDevice.bind(this));
        Homey.app.on('refresh_devices', this._syncDevices.bind(this));
    }

    _syncDevice(data) {
        this.debug('_syncDevice', data);

        data.forEach((device_data) => {
            if (device_data.state === 'ringing') {
                let device = this.getDevice({ id: device_data.doorbot_id });

                if (device instanceof Error) {
                    return this.error(device);
                }

                if (device_data.kind === 'motion' || device_data.motion) {
                    device.state.alarm_motion = true;
                    module.exports.realtime(device.data, 'alarm_motion', true);

                    clearTimeout(device.timer.motion);
                    device.timer.motion = setTimeout(() => { module.exports.realtime(device.data, 'alarm_motion', false); }, statusTimeout);
                }
            }
        });
    }

    _syncDevices(data) {
        this.debug('_syncDevices', data);

        data.stickup_cams.forEach((device_data) => {
            let device = this.getDevice({ id: device_data.id });

            if (device instanceof Error) {
                return this.error(device);
            }

            if (device.info === null) {
                device.info = device_data;
            }

            device.state.measure_battery = device_data.battery_life;
            module.exports.realtime(device.data, 'measure_battery', device_data.battery_life);

            this.isFirmwareChanged(device_data, (error, result) => {
                if (error) {
                    return this.error(error);
                }

                device.info = device_data;
            });
        });
    }

    _onExportsPairListDevices(data, callback) {
        let foundDevices = [];

        Homey.app.getRingDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            result.stickup_cams.forEach((device_data) => {
                foundDevices.push({
                    name : device_data.description,
                    data : {
                        id: device_data.id
                    },
                    info : device_data
                });
            });

            Promise.all(foundDevices).then((results) => {
                callback(null, foundDevices);
            });
        });
    }

    _onExportsCapabilitiesBatteryGet(device_data, callback) {
        this.debug('_onExportsCapabilitiesBatteryGet', device_data.id);

        let device = this.getDevice(device_data);

        if (device instanceof Error) {
            return callback(device);
        }

        callback(null, device.state.measure_battery);
    }

    _onExportsCapabilitiesAlarmMotionGet(device_data, callback) {
        this.debug('_onExportsCapabilitiesAlarmMotionGet', device_data.id);

        let device = this.getDevice(device_data);

        if (device instanceof Error) {
            return callback(device);
        }

        callback(null, device.state.alarm_motion);
    }
}

module.exports = new DriverStickUpCam();

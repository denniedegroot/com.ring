"use strict";

const Driver = require('../../lib/Driver.js');

const pollInterval = 2500;
const statusTimeout = 10000;

class DriverDoorbell extends Driver {

    constructor() {
        super();

        this._deviceType = 'doorbell';
        this.capabilities = {};

        this.capabilities.alarm_generic = {};
        this.capabilities.alarm_generic.get = this._onExportsCapabilitiesAlarmGenericGet.bind(this);

        this.capabilities.alarm_motion = {};
        this.capabilities.alarm_motion.get = this._onExportsCapabilitiesAlarmMotionGet.bind(this);

        setInterval(this._refreshDevice.bind(this), pollInterval);
    }

    _onExportsPairListDevices(data, callback) {
        let foundDevices = [];

        Homey.app.getRingDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            result.doorbots.forEach((device_data) => {
                foundDevices.push({
                    name : device_data.description,
                    data : device_data
                });
            });

            Promise.all(foundDevices).then((results) => {
                callback(null, foundDevices);
            });
        });
    }

    _onExportsCapabilitiesAlarmGenericGet(device_data, callback) {
        this.debug('_onExportsCapabilitiesAlarmGenericGet', device_data.id);

        let device = this.getDevice(device_data);

        if (device instanceof Error) {
            return callback(device);
        }

        callback(null, device.state.alarm_generic);
    }

    _onExportsCapabilitiesAlarmMotionGet(device_data, callback) {
        this.debug('_onExportsCapabilitiesAlarmMotionGet', device_data.id);

        let device = this.getDevice(device_data);

        if (device instanceof Error) {
            return callback(device);
        }

        callback(null, device.state.alarm_motion);
    }

    _refreshDevice() {
        this.debug('_refreshDevice');

        Homey.app.getRingDings((error, result) => {
            if (error) {
                return this.error(error);
            }

            result.forEach((data) => {
                if (data.state === 'ringing') {
                    let device = this.getDevice({ id: data.doorbot_id });

                    if (device instanceof Error) {
                        // return this.error(device);
                        return;
                    }

                    if (data.kind === 'ding') {
                        device.state.alarm_generic = true;
                        module.exports.realtime(device.data, 'alarm_generic', true);

                        clearTimeout(device.timer.ding);
                        device.timer.ding = setTimeout(() => { module.exports.realtime(device.data, 'alarm_generic', false); }, statusTimeout);
                    }

                    if (data.kind === 'motion' || data.motion) {
                        device.state.alarm_motion = true;
                        module.exports.realtime(device.data, 'alarm_motion', true);

                        clearTimeout(device.timer.motion);
                        device.timer.motion = setTimeout(() => { module.exports.realtime(device.data, 'alarm_motion', false); }, statusTimeout);
                    }
                }
            });
        });
    }

}

module.exports = new DriverDoorbell();

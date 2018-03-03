'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusTimeout = 10000;

class DeviceStickUpCam extends Device {

    _initDevice() {
        this.log('_initDevice');

        this.device = {}
        this.device.timer = {};

        this.setCapabilityValue('alarm_motion', false).catch(error => {
            this.error(error);
        });

        Homey.on('refresh_device', this._syncDevice.bind(this));
        Homey.on('refresh_devices', this._syncDevices.bind(this));
    }

    _syncDevice(data) {
        this.log('_syncDevice', data);

        data.forEach((device_data) => {
            if (device_data.state === 'ringing') {
                if (device_data.doorbot_id !== this.getData().id)
                    return;

                if (device_data.kind === 'motion' || device_data.motion) {
                    this.setCapabilityValue('alarm_motion', true).catch(error => {
                        this.error(error);
                    });

                    clearTimeout(this.device.timer.motion);

                    this.device.timer.motion = setTimeout(() => {
                        this.setCapabilityValue('alarm_motion', false).catch(error => {
                            this.error(error);
                        });
                    }, statusTimeout);
                }
            }
        });
    }

    _syncDevices(data) {
        this.log('_syncDevices', data);

        data.stickup_cams.forEach((device_data) => {
            if (device_data.id !== this.getData().id)
                return;

            let battery = device_data.battery_life;

            if (battery > 100)
                battery = 100;

            this.setCapabilityValue('measure_battery', battery).catch(error => {
                this.error(error);
            });
        });
    }

}

module.exports = DeviceStickUpCam;

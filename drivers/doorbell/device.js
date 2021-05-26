'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusTimeout = 10000;

class DeviceDoorbell extends Device {

    _initDevice() {
        this.log('_initDevice');

        this.device = {}
        this.device.timer = {};

        this.setCapabilityValue('alarm_generic', false).catch(error => {
            this.error(error);
        });

        this.setCapabilityValue('alarm_motion', false).catch(error => {
            this.error(error);
        });

        this.setAvailable();
        this._setupCameraView(this.getData());

        Homey.on('refresh_device', this._syncDevice.bind(this));
        Homey.on('refresh_devices', this._syncDevices.bind(this));
    }

    _setupCameraView(device_data) {
        this.log('_setupCamera', device_data);
        this.device.cameraImage = new Homey.Image();
        this.device.cameraImage.setStream(async (stream) => {
            await Homey.app.grabImage(device_data, (error, result) => {
                if (!error) {
                    let Duplex = require('stream').Duplex;
                    let snapshot = new Duplex();
                    snapshot.push(Buffer.from(result, 'binary'));
                    snapshot.push(null);
                    return snapshot.pipe(stream);
                } else {
                    let Duplex = require('stream').Duplex;
                    let snapshot = new Duplex();
                    snapshot.push(null);
                    return snapshot.pipe(stream);
                }
            })
        })
        this.device.cameraImage.register().catch(console.error).then(function() {
            this.setCameraImage(this.getName(),'snapshot',this.device.cameraImage);
        }.bind(this));
    }

    _syncDevice(data) {
        this.log('_syncDevice', data);

        data.forEach((device_data) => {
            if (device_data.state === 'ringing') {
                if (device_data.doorbot_id !== this.getData().id)
                    return;

                if (device_data.kind === 'ding') {
                    this.setCapabilityValue('alarm_generic', true).catch(error => {
                        this.error(error);
                    });

                    clearTimeout(this.device.timer.ding);

                    this.device.timer.ding = setTimeout(() => {
                        this.setCapabilityValue('alarm_generic', false).catch(error => {
                            this.error(error);
                        });
                    }, statusTimeout);
                }

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

        data.doorbots.forEach((device_data) => {
            if (device_data.id !== this.getData().id)
                return;

            let battery = parseInt(device_data.battery_life);

            if (battery > 100)
                battery = 100;

            this.setCapabilityValue('measure_battery', battery).catch(error => {
                this.error(error);
            });
        });
    }

    grabImage(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        return new Promise(function(resolve, reject) {
            _this.device.cameraImage.update().then(() =>{
                new Homey.FlowCardTrigger('ring_snapshot_received').register().trigger({ring_image: _this.device.cameraImage}).catch(error => { _this.error(error); });
                return resolve(true);
            });
        });
    }

    enableMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            Homey.app.enableMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    disableMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            Homey.app.disableMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

}

module.exports = DeviceDoorbell;

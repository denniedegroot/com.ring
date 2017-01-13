"use strict";

const Driver = require('../../lib/Driver.js');

class DriverChime extends Driver {

    constructor() {
        super();

        this._deviceType = 'chime';
        this.capabilities = {};

        Homey.app.on('refresh_devices', this._syncDevices.bind(this));
    }

    _syncDevices(data) {
        this.debug('_syncDevices', data);

        data.chimes.forEach((device_data) => {
            let device = this.getDevice({ id: device_data.id });

            if (device instanceof Error) {
                return this.error(device);
            }

            if (device.info === null) {
                device.info = device_data;
            }

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

            result.chimes.forEach((device_data) => {
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
}

module.exports = new DriverChime();

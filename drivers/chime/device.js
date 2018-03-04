'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

class DeviceChime extends Device {

    _initDevice() {
        this.log('_initDevice');
    }

    ringChime() {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            Homey.app.ringChime(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

}

module.exports = DeviceChime;

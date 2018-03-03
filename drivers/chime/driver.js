'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverChime extends Driver {

    onInit() {
        this.log('onInit');
    }

    _onPairListDevices(data, callback) {
        this.log('_onPairListDevices');

        let foundDevices = [];

        Homey.app.getRingDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            result.chimes.forEach((device_data) => {
                foundDevices.push({
                    name : device_data.description,
                    data : {
                        id: device_data.id,
                        info : device_data
                    }
                });
            });

            Promise.all(foundDevices).then((results) => {
                callback(null, foundDevices);
            });
        });
    }

}

module.exports = DriverChime;

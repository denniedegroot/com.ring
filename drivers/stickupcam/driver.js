'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverStickUpCam extends Driver {

    _onPairListDevices(data, callback) {
        this.log('_onPairListDevices');

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
                    }
                });
            });

            Promise.all(foundDevices).then((results) => {
                callback(null, foundDevices);
            });
        });
    }

}

module.exports = DriverStickUpCam;

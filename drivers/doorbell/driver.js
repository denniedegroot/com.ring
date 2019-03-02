'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverDoorbell extends Driver {

    onInit() {
        this.log('onInit');

        new Homey.FlowCardAction('ring_grab_snapshot')
            .register()
            .registerRunListener((args, state) => args.device.grabImage());
    }

    _onPairListDevices(data, callback) {
        this.log('_onPairListDevices');

        let foundDevices = [];

        Homey.app.getRingDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            result.doorbots.forEach((device_data) => {
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

module.exports = DriverDoorbell;

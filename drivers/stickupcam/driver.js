'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverStickUpCam extends Driver {

    onInit() {
        this.log('onInit');

        new Homey.FlowCardAction('stickupcam_grab_snapshot')
            .register()
            .registerRunListener((args, state) => args.device.grabImage());


        new Homey.FlowCardAction('stickupcam_enable_motion')
            .register()
            .registerRunListener((args, state) => args.device.enableMotion());

        new Homey.FlowCardAction('stickupcam_disable_motion')
            .register()
            .registerRunListener((args, state) => args.device.disableMotion());
    }

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

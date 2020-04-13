'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverStickUpCam extends Driver {

    onInit() {
        this.log('onInit');

        new Homey.FlowCardAction('stickupcam_grab_snapshot')
            .register()
            .registerRunListener((args, state) => args.device.grabImage());

        new Homey.FlowCardAction('stickupcam_light_on')
            .register()
            .registerRunListener((args, state) => args.device.lightOn());
        
        new Homey.FlowCardAction('stickupcam_light_off')
            .register()
            .registerRunListener((args, state) => args.device.lightOff());

        new Homey.FlowCardAction('stickupcam_siren_on')
            .register()
            .registerRunListener((args, state) => args.device.sirenOn());
        
        new Homey.FlowCardAction('stickupcam_siren_off')
            .register()
            .registerRunListener((args, state) => args.device.sirenOff());

        new Homey.FlowCardCondition('stickupcam_floodLight_on')
            .register()
            .registerRunListener(async ( args, state ) => {
                return args.device.isLightOn(); // Promise<boolean>
            })
            
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

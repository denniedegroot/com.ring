'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    onPair (socket) {
        this.log('onPair');

        socket.on('list_devices', (data, callback) => {
            if (this._onPairListDevices) {
                this._onPairListDevices(data, callback);
            } else {
                callback(new Error('missing _onPairListDevices'));
            }
        });

        socket.on('authenticate', (data, callback) => {
            if (Homey.ManagerSettings.get('ringAccesstoken')) return callback(null, true);

            console.log('invalid_token');

            return callback(new Error('invalid_token'));
        });
    }

}

module.exports = Driver;

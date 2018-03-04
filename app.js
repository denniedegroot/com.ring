'use strict';

const Homey = require('homey');

const api = require('./lib/Api.js');
const events = require('events');

class App extends Homey.App {

    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    onInit() {
        console.log(`${Homey.manifest.id} running...`);

        this._api = new api();

        this._api.on('refresh_device', this._syncDevice.bind(this));
        this._api.on('refresh_devices', this._syncDevices.bind(this));

        this._api.init();
    }

    _syncDevice(data) {
        Homey.emit('refresh_device', data);
    }

    _syncDevices(data) {
        Homey.emit('refresh_devices', data);
    }

    getRingDevices(callback) {
        this._api.getDevices(callback);
    }

    ringChime(data, callback) {
        this._api.ringChime(data, callback);
    }

}

module.exports = App;

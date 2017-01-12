"use strict";

const api = require('./lib/Api.js');
const events = require('events');

class App extends events.EventEmitter {

    constructor() {
        super();

        this.init = this._onExportsInit.bind(this);
        this._api = new api();

        this._api.on('refresh_device', this._syncDevice.bind(this));
        this._api.on('refresh_devices', this._syncDevices.bind(this));
    }

    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    _onExportsInit() {
        console.log(`${Homey.manifest.id} running...`);
        this._api.init();
    }

    _syncDevice(data) {
        this.emit('refresh_device', data);
    }

    _syncDevices(data) {
        this.emit('refresh_devices', data);
    }

    getRingDevices(callback) {
        this._api.getDevices(callback);
    }

}

module.exports = new App();

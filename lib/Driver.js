"use strict";

class Driver {

    constructor() {
        this._debug = true;
        this._devices = [];

        this.init = this._onExportsInit.bind(this);
        this.pair = this._onExportsPair.bind(this);
        this.added = this._onExportsAdded.bind(this);
        this.deleted = this._onExportsDeleted.bind(this);
    }

    debug() {
        if (this._debug) {
            this.log.apply(this, arguments);
        }
    }

    log() {
        if (Homey.app) {
            Homey.app.log.bind(Homey.app, `[${this.constructor.name}]`).apply(Homey.app, arguments);
        }
    }

    error() {
        if (Homey.app) {
            Homey.app.error.bind(Homey.app, `[${this.constructor.name}]`).apply(Homey.app, arguments);
        }
    }

    _onExportsInit (devices_data, callback) {
        this.debug('_onExportsInit', devices_data);

        devices_data.forEach(this._initDevice.bind(this));

        callback();
    }

    _onExportsPair (socket) {
        this.debug('_onExportsPair');

        socket.on('list_devices', (data, callback) => {
            if (this._onExportsPairListDevices) {
                this._onExportsPairListDevices(data, callback);
            } else {
                callback(new Error('missing _onExportsPairListDevices'));
            }
        });

        socket.on('authenticate', (data, callback) => {
            if (Homey.manager('settings').get('ringAccesstoken')) return callback(null, true);

            this.debug('invalid_token');

            return callback(new Error('invalid_token'));
        });
    }

    _onExportsAdded (device_data) {
        this.debug('_onExportsAdded', device_data);
        this._initDevice(device_data);
    }

    _onExportsDeleted (device_data) {
        this.debug('_onExportsDeleted', device_data);
        this._uninitDevice(device_data);
    }

    _initDevice (device_data) {
        this.debug('_initDevice', device_data.id);

        this.getCapabilities(device_data, (err, capabilities) => {
            if (err) return this.error(err);

            this._devices[device_data.id] = {
                data: device_data,
                state: {},
                timer: {}
            }

            capabilities.forEach((capability) => {
                this._devices[device_data.id].state[capability] = false;
            });
        });
    }

    _uninitDevice (device_data) {
        this.debug('_uninitDevice', device_data);

        let device = this._devices[device_data.id];

        if (device) {
            delete this._devices[device_data.id];
        }
    }

    getDevice (device_data) {
        return this._devices[device_data.id] || new Error('invalid_device');
    }
}

module.exports = Driver;

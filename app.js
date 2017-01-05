"use strict";

const Api = require('./lib/Api.js');

class App {

    constructor() {
        this.init = this._onExportsInit.bind(this);
    }

    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    _onExportsInit() {
        console.log(`${Homey.manifest.id} running...`);
        Api.init();
    }

    getRingDevices(callback) {
        Api.getDevices(callback);
    }

    getRingDings(callback) {
        Api.getDings(callback);
    }

}

module.exports = new App();

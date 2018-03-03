'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

class DeviceChime extends Device {

    _initDevice() {
        this.log('_initDevice');
    }

}

module.exports = DeviceChime;

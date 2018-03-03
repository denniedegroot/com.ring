'use strict';

const Homey = require('homey');

class Device extends Homey.Device {

    onInit () {
        this.log('_onInit');
        this._initDevice();
    }

    onAdded () {
        this.log('onAdded');
    }

    onDeleted () {
        this.log('onDeleted');
    }

    onRenamed () {
        this.log('onAdded');
    }

}

module.exports = Device;

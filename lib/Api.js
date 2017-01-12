"use strict";

const https = require('https');
const events = require('events');
const stringify = require('querystring').stringify;

const refreshDeviceTimeout = 5000;
const refreshDevicesTimeout = 600000;
const verifyAuthenticationTimeout = 60000;

class Api extends events.EventEmitter {

    constructor() {
        super();

        this._debug = true;
        this._token = null;
        this._uniqueid = null;
        this._authenticated = false;
        this._apiversion = 9;

        Homey.manager('settings').on('set', this._onSetSettings.bind(this));

        setInterval(this._refreshDevice.bind(this), refreshDeviceTimeout);
        setInterval(this._refreshDevices.bind(this), refreshDevicesTimeout);
        setInterval(this._verifyAuthentication.bind(this), verifyAuthenticationTimeout);
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

    init () {
        let token = Homey.manager('settings').get('ringAccesstoken');

        Homey.manager('api').realtime('com.ring.status', { state: 'api_init'});

        Homey.manager('cloud').getHomeyId((error, cloudId) => {
            if (error) {
                return this.error(new Error('no_uniqueid'));
            }

            this._uniqueid = cloudId;

            if (token) {
                this._token = token;
                this._authenticated = true;
            } else {
                this._verifyAuthentication();
            }
        });
    }

    _https (method, path, callback) {
        this.debug('_https', path);

        let data = [];
        let headers = {};

        if (method === 'POST') {
            let auth = Homey.manager('settings').get('ringCredentials');

            if (auth === undefined) {
                return callback(new Error('invalid_credentials'));
            }

            data['device[os]'] = 'ios',
            data['device[hardware_id]'] = this._uniqueid;
            data.api_version = this._apiversion;

            data = stringify(data);

            headers['Authorization'] = 'Basic ' + new Buffer(auth.user + ':' + auth.pass).toString('base64');
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['Content-Length'] = data.length;
        } else {
            if (!this._authenticated) {
                return callback(new Error('not_authenticated'));
            }

            path = path + '?api_version=' + this._apiversion + '&auth_token=' + this._token;
        }

        headers['User-Agent'] = 'Homey';

        let request = https.request({
            host: 'api.ring.com',
            port: 443,
            path: '/clients_api' + path,
            method: method,
            headers: headers,
            form: data,
            agent: false
        }, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                if (response.statusCode >= 400) {
                    this._authenticated = false;
                    return callback(new Error('invalid_authentication ' + response.statusCode + ' ' + data));
                }

                try {
                    callback(null, JSON.parse(data));
                } catch (error) {
                    callback(new Error(error));
                }
            });

            response.on('error', (error) => {
                callback(error);
            });
        });

        request.setTimeout(2500, () => {
            request.abort();
        });

        request.on('error', (error) => {
            callback(error);
        });

        if (method === 'POST') {
            request.write(data);
        }

        request.end();
    }

    _onSetSettings (name) {
        this.debug('_onSetSettings', name);

        if (name === 'ringCredentials') {
            let auth = Homey.manager('settings').get(name);

            this._authenticate((error, result) => {
                if (error) {
                    Homey.manager('api').realtime('com.ring.status', { state: error });
                    return this.log(error);
                }

                Homey.manager('api').realtime('com.ring.status', { state: 'authenticated'});
            });
        } else if (name === 'ringAccesstoken') {
            let token = Homey.manager('settings').get(name);
            this._token = token;

            Homey.manager('api').realtime('com.ring.status', { state: 'authenticated'});
        }
    }

    _verifyAuthentication () {
        this.debug('_verifyAuthentication');

        if (this._authenticated) {
            return;
        }

        this._authenticate((error, result) => {
            if (error) {
                return this.error(new Error('error'));
            }
        });
    }

    _authenticate (callback) {
        this.debug('authenticate');

        this._https('POST', '/session', (error, result) => {
            if (error) {
                this._authenticated = false;
                return callback(error);
            }

            try {
                if (result.profile && result.profile.authentication_token) {
                    this._token = result.profile.authentication_token;
                    this._authenticated = true;

                    Homey.manager('settings').set('ringAccesstoken', result.profile.authentication_token);

                    return callback(null, true);
                } else {
                    this._authenticated = false;
                    return callback(result);
                }
            } catch (e) {
                this._authenticated = false;
                return callback(e);
            }
        });
    }


    _refreshDevice () {
        this.debug('_refreshDevice');

        this._getDings((error, result) => {
            if (error) {
                return this.error(error);
            }

            this.emit('refresh_device', result);
        });
    }

    _refreshDevices () {
        this.debug('_refreshDevices');

        this.getDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            this.emit('refresh_devices', result);
        });
    }

    _getDings (callback) {
        this._https('GET', '/dings/active', (error, result) => {
            callback(error, result);
        });
    }

    getDevices (callback) {
        this._https('GET', '/ring_devices', (error, result) => {
            callback(error, result);
        });
    }

}

module.exports = Api;

'use strict';

const Homey = require('homey');

const https = require('https');
const crypto = require('crypto');
const events = require('events');
const stringify = require('querystring').stringify;

const refreshTimeout = 5000;
const refreshDeviceInterval = 5000;
const refreshDevicesInterval = 600000;
const verifyAuthenticationInterval = 60000;

const parse = require('url').parse;
const hardware_id = crypto.randomBytes(16).toString('hex');

class Api extends Homey.SimpleClass {

    constructor() {
        super();

        this._token = null;
        this._uniqueid = null;
        this._authenticated = false;
        this._apiversion = 11;

        Homey.ManagerSettings.on('set', this._onSetSettings.bind(this));

        setInterval(this._refreshDevice.bind(this), refreshDeviceInterval);
        setInterval(this._refreshDevices.bind(this), refreshDevicesInterval);
        setInterval(this._verifyAuthentication.bind(this), verifyAuthenticationInterval);
    }

    init () {
        let token = Homey.ManagerSettings.get('ringAccesstoken');

        Homey.ManagerApi.realtime('com.ring.status', { state: 'api_init'});

        Homey.ManagerCloud.getHomeyId((error, cloudId) => {
            if (error) {
                return this.error(new Error('no_uniqueid'));
            }

            this._uniqueid = cloudId;

            if (token) {
                this._token = token;
                this._authenticated = true;
                this._refreshDevices();
            } else {
                this._verifyAuthentication();
            }
        });
    }

    _https_token (token, callback) {
        console.log('_https_token');

        let postdata = JSON.stringify({
            device: {
                hardware_id: hardware_id,
                metadata: {
                    api_version: '9',
                },
                os: 'android'
            }
        });

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://api.ring.com/clients_api/session?api_version=9', true);
        url.method = 'POST';
        url.headers = {
            Authorization: 'Bearer ' + token,
            'content-type': 'application/json',
            'content-length': postdata.length
        };

        let request = https.request(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};

                if (response.statusCode >= 400) {
                    this._authenticated = false;
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                } else {
                    try {
                        result = JSON.parse(data);
                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                callback(error, result);
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                callback(error);
            });
        });

        request.on('error', (error) => {
            clearTimeout(timeout);
            callback(error);
        });

        request.write(postdata);

        request.end();
    }

    _https_auth (callback) {
        console.log('_https_auth');

        let auth = Homey.ManagerSettings.get('ringCredentials');

        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            grant_type: "password",
            username: auth.user,
            password: auth.pass,
            scope: "client"
        });

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'content-type': 'application/json',
            'content-length': postdata.length
        };

        let request = https.request(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};

                if (response.statusCode >= 400) {
                    this._authenticated = false;
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                } else {
                    try {
                        result = JSON.parse(data);
                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                callback(error, result);
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                callback(error);
            });
        });

        request.on('error', (error) => {
            clearTimeout(timeout);
            callback(error);
        });

        request.write(postdata);

        request.end();
    }

    _https (method, path, raw, callback) {
        console.log('_https', path);

        let headers = {};
        let postdata = [];

        if (method === 'POST') {
            let auth = Homey.ManagerSettings.get('ringCredentials');

            if (auth === null || auth === undefined) {
                return callback(new Error('invalid_credentials'));
            }

            postdata['device[os]'] = 'ios',
            postdata['device[hardware_id]'] = this._uniqueid;
            postdata.api_version = this._apiversion;

            postdata = stringify(postdata);

            headers['Authorization'] = 'Basic ' + new Buffer(auth.user + ':' + auth.pass).toString('base64');
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['Content-Length'] = postdata.length;
        } else {
            if (!this._authenticated) {
                return callback(new Error('not_authenticated'));
            }
        }

        headers['User-Agent'] = 'Homey';

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        let request = https.request({
            host: 'api.ring.com',
            port: 443,
            path: '/clients_api' + path + '?api_version=' + this._apiversion + '&auth_token=' + this._token,
            method: method,
            headers: headers,
            agent: false
        }, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};

                if (response.statusCode >= 400) {
                    this._authenticated = false;
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                } else {
                    try {
                        if (!raw)
                            result = JSON.parse(data);
                        else
                            result = data;
                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                callback(error, result);
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                callback(error);
            });
        });

        request.on('error', (error) => {
            clearTimeout(timeout);
            callback(error);
        });

        if (method === 'POST') {
            request.write(postdata);
        }

        request.end();
    }

    _onSetSettings (name) {
        console.log('_onSetSettings', name);

        if (name === 'ringCredentials') {
            let auth = Homey.ManagerSettings.get(name);

            if (auth == null) {
                this._authenticated = false;
                return;
            }

            this._authenticate((error, result) => {
                if (error) {
                    Homey.ManagerApi.realtime('com.ring.status', { state: error });
                    return console.log(error);
                }

                Homey.ManagerApi.realtime('com.ring.status', { state: 'authenticated'});
            });
        } else if (name === 'ringAccesstoken') {
            let token = Homey.ManagerSettings.get(name);

            if (token == null) {
                this._authenticated = false;
                return;
            }

            this._token = token;

            Homey.ManagerApi.realtime('com.ring.status', { state: 'authenticated'});
        }
    }

    _verifyAuthentication () {
        console.log('_verifyAuthentication');

        if (!this._authenticated) {
            this._authenticate((error, result) => {
                if (error) {
                    console.log(error);
                }
            });
        }
    }

    _authenticate (callback) {
        console.log('_authenticate');

        this._https_auth((error, result) => {
            if (error) {
                this._authenticated = false;
                return callback(error);
            }

            this._https_token(result.access_token, (error, result) => {
                if (result.profile && result.profile.authentication_token) {
                    this._token = result.profile.authentication_token;
                    this._authenticated = true;

                    Homey.ManagerSettings.set('ringAccesstoken', result.profile.authentication_token);

                    return callback(null, true);
                } else {
                    this._authenticated = false;
                    return callback(result);
                }
            });
        });
    }

    _refreshDevice () {
        console.log('_refreshDevice');

        this._https('GET', '/dings/active', false, (error, result) => {
            if (error) {
                return this.error(error);
            }

            this.emit('refresh_device', result);
        });
    }

    _refreshDevices () {
        console.log('_refreshDevices');

        this.getDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            this.emit('refresh_devices', result);
        });
    }

    getDevices (callback) {
        this._https('GET', '/ring_devices', false, (error, result) => {
            callback(error, result);
        });
    }

    ringChime (device_data, callback) {
        console.log('ringChime', device_data);

        this._https('POST', '/chimes/' + device_data.id + '/play_sound', true, (error, result) => {
            callback(error, result);
        });
    }

}

module.exports = Api;

'use strict';

const Homey = require('homey');

const https = require('https');
const crypto = require('crypto');
const events = require('events');
const stringify = require('querystring').stringify;

const client_api_host = 'api.ring.com';
const app_api_host = 'app.ring.com';

const refreshTimeout = 5000;
const refreshDeviceInterval = 5000;
//Light, Siren and statusses like these only are available in the devices call. Since they need a timely response in Homey the timer needs to be shorter.
const refreshDevicesInterval = 5000;
const refreshLocationModeInterval = 5000;
const verifyAuthenticationInterval = 60000;

const parse = require('url').parse;

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    });
}

class Api extends Homey.SimpleClass {

    constructor() {
        super();

        this._token = null;
        this._bearer = null;
        this._uniqueid = null;
        this._authenticated = false;
        this._apiversion = 11;

        Homey.ManagerSettings.on('set', this._onSetSettings.bind(this));

        setInterval(this._refreshDevice.bind(this), refreshDeviceInterval);
        setInterval(this._refreshDevices.bind(this), refreshDevicesInterval);
        setInterval(this._refreshLocationModes.bind(this), refreshLocationModeInterval);
        setInterval(this._verifyAuthentication.bind(this), verifyAuthenticationInterval);
    }

    init () {
        let token = Homey.ManagerSettings.get('ringAccesstoken');
        let bearer = Homey.ManagerSettings.get('ringBearer');

        Homey.ManagerApi.realtime('com.ring.status', { state: 'api_init'});

        Homey.ManagerCloud.getHomeyId((error, cloudId) => {
            if (error) {
                return this.error(new Error('no_uniqueid'));
            }

            this._uniqueid = cloudId;

            if (token && bearer) {
                this._token = token;
                this._bearer = bearer;
            }

            this._verifyAuthentication((error, result) => {
                if (!error)
                {
                    this._refreshDevices();
                    this._refreshLocationModes();
                }
            });
        });
    }

    _https_token (token, callback) {
        console.log('_https_token');

        Homey.ManagerSettings.set('ringBearer', token);
        this._bearer = token;

        let postdata = JSON.stringify({
            device: {
                hardware_id: this._uniqueid,
                metadata: {
                    api_version: '11',
                },
                os: 'android'
            }
        });

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://api.ring.com/clients_api/session?api_version=11', true);
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

                if (response.statusCode >= 400 ) {
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

    _https_auth_postdata_refresh () {
        let refreshToken = Homey.ManagerSettings.get('ringRefreshToken');

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            scope: "client"
        });

        return postdata;
    }
    _https_auth_postdata_auth (auth)
    {
        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            grant_type: "password",
            username: auth.user,
            password: auth.pass,
            scope: "client"
        });

        return postdata;
    }

    _https_auth_mfa_refresh (callback) {
        console.log('_https_auth_mfa_refresh');

        let postdata = this._https_auth_postdata_refresh();

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
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
                    console.log('_https_auth_mfa_refresh : invalid_refresh : ', response.statusCode);
                    error = new Error('invalid_refresh ' + response.statusCode + ' ' + data);
                } else {
                    try {
                        result = JSON.parse(data);
                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                console.log('_https_auth_mfa_refresh: update cached refresh token for later use')
                Homey.ManagerSettings.set('ringRefreshToken', result.refresh_token);
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

    //Use this method to trigger the MFA message to use
    //Pass the auth object containing the user and pass
    _https_auth_cred (auth, callback) {
        console.log('_https_auth_cred');
        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }
        let postdata = this._https_auth_postdata_auth(auth);

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
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
                    if(response.statusCode==412)
                    {
                        this._authenticated = false;
                        console.log('_https_auth_cred : require mfa code : ', response.statusCode);
                    } else {
                        this._authenticated = false;
                        console.log('_https_auth_cred : authentication error : ', response.statusCode);
                        error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                    }
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

    //Use this methode to pass the MFA code along with the request
    _https_auth_code (auth, code, callback) {
        console.log('_https_auth_code');

        //let auth = Homey.ManagerSettings.get('ringCredentials');

        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }

        let postdata = this._https_auth_postdata_auth(auth);

        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
            '2fa-code': code || '',
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
                    console.log('_https_auth_code : invalid_authentication : ', response.statusCode);
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                } else {
                    try {
                        result = JSON.parse(data);
                        console.log('_https_auth_code: retrieved the refresh and access token')
                        Homey.ManagerSettings.set('ringRefreshToken', result.refresh_token);
                        //console.log('_https_auth_code: refresh token ['+result.refresh_token+']')
                        this._bearer = result.access_token;
                        Homey.ManagerSettings.set('ringBearer', result.access_token);
                        //console.log('_https_auth_code: bearer token ['+result.access_token+']')
                        this._authenticated = true;
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

    _https (method, host, path, postdata, raw, callback) {
        console.log('_https', path);

        let headers = {};

        if (postdata == null)
            postdata = [];


        if (host == client_api_host && (method === 'POST' || method === 'PATCH')) {

            postdata['device[os]'] = 'ios',
            postdata['device[hardware_id]'] = this._uniqueid;
            postdata.api_version = this._apiversion;

            postdata = JSON.stringify(postdata);

            headers['hardware_id'] = this._uniqueid;
            headers['authorization'] = 'Bearer ' + this._bearer;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['Content-Length'] = postdata.length;
            headers['User-Agent'] = 'Homey';
            console.log('Sending headers for client api');
        } else if (host == app_api_host) {
            headers['hardware_id'] = this._uniqueid;
            headers['authorization'] = 'Bearer ' + this._bearer;
            headers['User-Agent'] = 'android:com.ringapp';
            console.log('sending headers for app api');
        } else {
            headers['Authorization'] = 'Bearer ' + this._bearer;
            headers['User-Agent'] = 'Homey';
            console.log('sending base authentication only');
            if (!this._authenticated) {
                console.log('_https : not_authenticated');
                return callback(new Error('not_authenticated'));
            }
        }


        if (path.includes('image')) {
            headers['hardware_id'] = this._uniqueid;            
            headers['authorization'] = 'Bearer ' + this._bearer;
        }


        var timeout = setTimeout(() => {
            request.abort();
        }, refreshTimeout);

        let request = https.request({
            host: host,
            port: 443,
            path: path + '?auth_token=' + this._token + '&api_version=' + this._apiversion ,
            method: method,
            headers: headers,
            agent: false
        }, (response) => {
            let data = '';

            if (raw)
                response.setEncoding('binary');

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};

                if (response.statusCode == 404) { //Not found
                    console.log('_https : resource not found : ', response.statusCode, data);
                    error = new Error('resource not found ' + response.statusCode + ' ' + data);
                } else if (response.statusCode >= 400) {
                    this._authenticated = false;
                    console.log('_https : invalid_authentication : ', response.statusCode, data);
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

        if (method === 'POST' || method === 'PATCH') {
            request.write(postdata);
        }

        request.end();
    }

    _onSetSettings (name) {
        console.log('_onSetSettings', name);

        if (name === 'ringAccesstoken') {
            let token = Homey.ManagerSettings.get(name);

            if (token == null) {
                this._authenticated = false;
                return;
            }

            this._token = token;

            Homey.ManagerApi.realtime('com.ring.status', { state: 'authenticated'});
        }
    }

    _verifyAuthentication (callback) {
        console.log('_verifyAuthentication');

        if (!this._authenticated) {
            this._authenticate((error, result) => {
                if (error) {
                    console.log(error);
                }

                if (callback)
                    return callback(error, true);
            });
        }
    }

    //This method requires that the refresh token is already present
    _authenticate (callback) {
        console.log('_authenticate');

        this._https_auth_mfa_refresh((error, result) => {
            if (error) {
                this._authenticated = false;
                return callback(error);
            }

            this._bearer = result.access_token;
            Homey.ManagerSettings.set('ringBearer', result.access_token);

            this._https_token(result.access_token, (error, result) => {
                if (error) {
                    this._authenticated = false;
                    return callback(error);
                }

                if (typeof(result) == 'object' && result.hasOwnProperty('profile') &&
                    typeof(result.profile) == 'object' && result.profile.hasOwnProperty('authentication_token')) {
                    this._token = result.profile.authentication_token;
                    this._authenticated = true;

                    Homey.ManagerSettings.set('ringAccesstoken', result.profile.authentication_token);

                    return callback(null, true);
                } else {
                    this._authenticated = false;
                    return callback(new Error('authenticated_failed'));
                }
            });
        });
    }

    _refreshDevice () {
        console.log('_refreshDevice');

        this._https('GET', client_api_host, '/clients_api/dings/active', null, false, (error, result) => {
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
        this._https('GET', client_api_host, '/clients_api/ring_devices', null, false, (error, result) => {
            callback(error, result);
        });
    }

    ringChime (device_data, callback) {
        console.log('ringChime', device_data);

        this._https('POST', client_api_host, '/clients_api/chimes/' + device_data.id + '/play_sound', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOn (device_data, callback) {
        console.log('lightOn', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/floodlight_light_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOff (device_data, callback) {
        console.log('lightOff', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/floodlight_light_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOn (device_data, callback) {
        console.log('sirenOn', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/siren_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOff (device_data, callback) {
        console.log('sirenOff', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/siren_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOn (device_data, callback) {
        console.log('lightOn', device_data);
        this._https('PUT', client_api_host, '/doorbots/' + device_data.id + '/floodlight_light_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOff (device_data, callback) {
        console.log('lightOff', device_data);
        this._https('PUT', client_api_host, '/doorbots/' + device_data.id + '/floodlight_light_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOn (device_data, callback) {
        console.log('sirenOn', device_data);
        this._https('PUT', client_api_host, '/doorbots/' + device_data.id + '/siren_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOff (device_data, callback) {
        console.log('sirenOff', device_data);
        this._https('PUT', client_api_host, '/doorbots/' + device_data.id + '/siren_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    async grabImage (device_data, callback) {
        console.log('grabImage', device_data);

        let retries = 3;
        let postdata = {};
        let grab_time = Math.floor(Date.now() / 1000);
        let new_image = false;

        postdata['doorbot_ids'] = [device_data.id];

        for (let i = 0; i < retries; i++) {
            this._https('POST', client_api_host, '/clients_api/snapshots/timestamps', postdata, false, (error, result) => {
                if (error) {
                    this._https_auth_mfa_refresh((error, result) => {
                        if (error) {
                            this._authenticated = false;
                        } else {
                            Homey.ManagerSettings.set('ringBearer', result.access_token);
                            this._bearer = result.access_token;
                        }
                    });
                }

                if (!error && result && result.timestamps && result.timestamps[0] && result.timestamps[0].timestamp && ((result.timestamps[0].timestamp / 1000) >= grab_time))
                    new_image = true;
            });

            await sleep(1000);

            if (new_image)
                break;
        }

        /* new_image indicates a fresh image, but we always return a image anyway */
        this._https('GET', client_api_host, '/clients_api/snapshots/image/' + device_data.id, null, true, (error, result) => {
            if (error) {
                console.log(JSON.stringify(error));
                this._https_auth_mfa_refresh((error, result) => {
                    if (error) {
                        this._authenticated = false;
                        return callback(error, result);
                    } else {
                        Homey.ManagerSettings.set('ringBearer', result.access_token);
                        this._bearer = result.access_token;
                        this._https('GET', client_api_host, '/clients_api/snapshots/image/' + device_data.id, null, true, (error, result) => {
                            return callback(error, result);
                        });
                    }
                });
            } else {
                return callback(error, result);
            }
        });
    }

    enableMotion (device_data, callback) {
        console.log('enableMotion', device_data);

        let postdata = this.getMotionSettings(true);

        this._https('PATCH', client_api_host, '/devices/v1/devices/' + device_data.id + '/settings', postdata, false, (error, result) => {
            if (error){
                console.log(error);
            }
            callback(error, result);
        });
    }

    disableMotion (device_data, callback) {
        console.log('disableMotion', device_data);
    
        let postdata = this.getMotionSettings(false);

        this._https('PATCH', client_api_host, '/devices/v1/devices/' + device_data.id + '/settings', postdata, false, (error, result) => {
            callback(error, result);
        });
    }

    getMotionSettings (enabled) {
        return {
            motion_settings: {
                motion_detection_enabled: enabled
            }
        };
    }

    userLocations() {
        this.log(`userLocations: Send request to retrieve all user locations in Ring`);
        return new Promise((resolve, reject) => {
          this._getLocations((error, result) => {
            if (error) {
              this.error(`getLocations: error with result:`, result);
              return reject(error);
            }
            const locations = result.user_locations.map(location => {
                return {
                    name: location.name,
                    id: location.location_id,
                    mode: 'unset'
                }
            });
            return resolve(locations);
          })
        });
    }

    _refreshLocationModes () {
        console.log('_refreshLocationModes');

        this.userLocations().then(locations => {
            return locations;
        }).then(locations => {
            locations.forEach(location => {
                this.getLocationMode(location.id, (error,result) => {
                    if(error)
                        return error;
                    location.mode = result.mode;
                    this.emit('refresh_locationMode', location);
                });
            });
        });

    }
    

    _getLocations (callback) {
        console.log('_getLocations');
        this._https('GET', client_api_host, '/devices/v1/locations', null, false, (error, result) => {
            if (error) {
                callback(error,null);
            }
            callback(error,result);
        });
    }

    getLocationMode (locationId, callback) {
        this._https('GET', app_api_host, '/api/v1/mode/location/'+locationId, null, false, (error, result) => {
            callback(error, result);
        });
    }

    setLocationMode(locationId,  mode) {
        this.log(`setLocationMode: Send request to switch the location to a new mode`);
        return new Promise((resolve, reject) => {
          this._setLocationMode(locationId,  mode, (error, result) => {
            if (error) {
              this.error(`setLocationMode: error with result:`, result);
              return reject(error);
            }
            return resolve(result);
          })
        });
    }

    mapLocationMode (mode) {
        return {
           mode: mode
        };
    }

    _setLocationMode (locationId,  mode, callback) {
        let postdata = this.mapLocationMode(mode);
        this._https('POST', app_api_host, '/api/v1/mode/location/'+locationId, JSON.stringify(postdata), true, (error, result) => {
            callback(error, result);
        });
    }
}

module.exports = Api;
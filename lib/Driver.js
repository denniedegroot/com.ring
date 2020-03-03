'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    onPair (socket) {
        this.log('onPair');

        socket.on('showView', (viewId,callback)=>{
            callback();
            if(viewId=='start')
            {
                console.log('start view loading, check validation');
                if(Homey.app._api._authenticated)
                {
                    console.log('API is already authenticated, skip authentication');
                    socket.showView('list_devices');
                } else {
                    console.log('API is not yet authenticated, perform authentication');
                }
            }
        });

        //Trigger the MFa code message to the user and tell the interface to allow code entry
        socket.on('triggerMFA', (auth, callback) => {
            Homey.app._api._https_auth_cred(auth, (error, result) => {
                if (error) {
                    return callback(error,null);
                } else {
                    console.log('login successfull, now request mfa code');
                    return callback(null,result);
                }
            });
        });

        //Trigger the MFa code message to the user and tell the interface to allow code entry
        socket.on('validateMFA', (auth,  callback) => {
            Homey.app._api._https_auth_code(auth, auth.token, (error, result) => {
                if (error) {
                    return callback(error,null);
                } else {
                    return callback(null,result);
                }
            });
        });

        socket.on('list_devices', (data, callback) => {
            if (this._onPairListDevices) {
                this._onPairListDevices(data, callback);
            } else {
                callback(new Error('missing _onPairListDevices'));
            }
        });

    }

}

module.exports = Driver;

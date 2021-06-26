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
        this.lastLocationModes = [];
        this._api = new api();

        this._api.on('refresh_device', this._syncDevice.bind(this));
        this._api.on('refresh_devices', this._syncDevices.bind(this));
        this._api.on('refresh_locationMode', this._syncLocationMode.bind(this));

        this._api.init();

        this._setLocationMode = new Homey.FlowCardAction('change_location_mode');
        this.setLocationMode();

        this._triggerLocationModeChangedTo = new Homey.FlowCardTrigger('ring_location_mode_changed_generic');
        this.registerLocationModeChanged();

        this._conditionLocationMode = new Homey.FlowCardCondition('ring_location_mode_active');
        this.conditionLocationMode();
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

    lightOn(data, callback) {
        this._api.lightOn(data, callback);
    }

    lightOff(data, callback) {
        this._api.lightOff(data, callback);
    }

    sirenOn(data, callback) {
        this._api.sirenOn(data, callback);
    }

    sirenOff(data, callback) {
        this._api.sirenOff(data, callback);
    }

    ringChime(data, callback) {
        this._api.ringChime(data, callback);
    }

    grabImage(data, callback) {
        this._api.grabImage(data, callback);
    }

    enableMotion(data, callback) {
        this._api.enableMotion(data, callback);
    }

    disableMotion(data, callback) {
        this._api.disableMotion(data, callback);
    }

    logRealtime(event, details)
    {
        Homey.ManagerApi.realtime(event, details)
    }

    _syncLocationMode(newLocationMode)
    {
        if(this.lastLocationModes.length>0)
        {
            var matchedLastLocationMode = this.lastLocationModes.find(lastLocationMode =>{
                 return lastLocationMode.id==newLocationMode.id;
            });
            if(matchedLastLocationMode!=undefined)
            {
                //console.log('Check location mode for remembered location '+matchedLastLocationMode.name+' was in mode '+matchedLastLocationMode.mode+' and now is in mode '+newLocationMode.mode);
                if(matchedLastLocationMode.mode!=newLocationMode.mode)
                {
                    //console.log('location mode changed, raise the flow trigger!');
                    this.triggerLocationModeChanged({oldmode: matchedLastLocationMode.mode, mode: newLocationMode.mode},{location: newLocationMode});
                }
                matchedLastLocationMode.mode = newLocationMode.mode;
            }
            else {
                //console.log('recevied new location mode for location '+newLocationMode.name+', there is no old state known for this location');
                this.lastLocationModes.push(newLocationMode);
            }
        } else{
            //console.log('recevied new location mode for location '+newLocationMode.name+', there is no old state known for this location');
            this.lastLocationModes.push(newLocationMode);
        }
    }

    triggerLocationModeChanged(tokens, state) {
        this._triggerLocationModeChangedTo.trigger(tokens, state);
    }

    registerLocationModeChanged() {
        this._triggerLocationModeChangedTo
          .registerRunListener((args, state) => {
            return Promise.resolve( args.location.name === state.location.name );
          })
          .register()
          .getArgument('location')
          .registerAutocompleteListener((query, args) => {
            return new Promise(async (resolve) => {
              const locations = await this._api.userLocations();
              console.log(locations);
              resolve(locations);
            });
          });
      }

    setLocationMode() {
        this._setLocationMode
          .registerRunListener(async (args, state) => {
            console.log('attempt to switch location ('+args.location.name+') to new state: '+args.mode);
            return new Promise((resolve, reject) => {
              this._api.setLocationMode(args.location.id,args.mode).then(() => {
                  resolve(true);
              }, (_error) => {
                resolve(false);
              });
            });
          })
          .register()
          .getArgument('location')
          .registerAutocompleteListener((query, args) => {
            return new Promise(async (resolve) => {
              const locations = await this._api.userLocations();
              console.log(locations);
              resolve(locations);
            });
          });
      }
    
      conditionLocationMode() {
        this._conditionLocationMode
          .registerRunListener((args, state) => {

            return new Promise((resolve, reject) => {
                var matchedLocationMode = this.lastLocationModes.find(lastLocationMode =>{
                    return lastLocationMode.id==args.location.id;
                });
                if(matchedLocationMode!=undefined) {
                    console.log('stored location mode found for location '+matchedLocationMode.name);
                    resolve(matchedLocationMode.mode === args.mode);
                } else {
                    reject('unknown location');
                }
              });
          })
          .register()
          .getArgument('location')
          .registerAutocompleteListener((query, args) => {
            return new Promise(async (resolve) => {
              const locations = await this._api.userLocations();
              console.log(locations);
              resolve(locations);
            });
          });
      }


}

module.exports = App;

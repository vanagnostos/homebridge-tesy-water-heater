const httpBase            = require("homebridge-http-base"),
      PullTimer           = httpBase.PullTimer,
      baseUrl             = 'https://www.mytesy.com/v3/',
      loginUrl            = baseUrl + 'api.php?do=login',
      infoUrl             = baseUrl + 'api.php?do=get_dev',
      MODE_MANUAL         = 1,
      MODE_ECO            = 5,
      KEY_MODE            = 'mode',
      KEY_CURRENT_SHOWERS = 'cur_shower',
      KEY_TARGET_SHOWERS  = 'ref_shower',
      KEY_POWER           = 'power_sw',
      KEY_HEATER_STATE    = 'heater_state',
      KEY_STAT            = 'stat';

let Service,
    Characteristic;

module.exports = function (homebridge) {
  Service        = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('tesy-water-heater-homebridge', 'TesyWaterHeater', TesyWaterHeater);
  return TesyWaterHeater;
};

class TesyWaterHeater {

  constructor(log, config) {
    this.log = log;

    this.name         = config.name;
    this.manufacturer = config.manufacturer || 'Tesy';
    this.model        = config.model || 'Model';
    this.serialNumber = config.serialNumber || 'Serial Number';

    this.device_id    = config.device_id;
    this.username     = config.username || null;
    this.password     = config.password || null;
    this.pullInterval = config.pullInterval || 1000 * 30;
    this.maxTemp      = config.maxTemp || 4;
    this.minTemp      = config.minTemp || 0;

    this.ready      = false;
    this.accAlt     = null;
    this.accSession = null;
    this.phpSession = null;
    this.status     = null;

    this.loginAttempts      = 0;
    this.loginRetryInterval = 1000 * 60 * 5;
    this.maxLoginAttempts   = 100;

    if (!this.username || !this.password || !this.device_id) {
      this.log.error(`Username, password and device_id are required, please check configuration`);
      return;
    }

    this.pullTimer = new PullTimer(this.log, this.pullInterval, this.refreshTesyWaterHeaterStatus.bind(this), () => {
    });

    this.login().then(() => {
      this.pullTimer.start();
      let loginRetryInterval = setInterval(() => {
        if (this.ready) {
          return;
        }
        this.pullTimer.stop();
        this.log.info(`Retrying login`);
        this.login().then(() => {
          if (this.ready) {
            this.pullTimer.start();
            this.loginAttempts = 0;
            return;
          }
          ++this.loginAttempts;
          if (this.loginAttempts > this.maxLoginAttempts) {
            this.log.error(`Reached max login attempts, login retry disabled`);
            clearInterval(loginRetryInterval);
          }
        });
      }, this.loginRetryInterval);
    }).catch(error => {
      this.log.error(`Login failed: ${error.message}`);
    })
  }

  login() {
    return fetch(loginUrl, this.loginParams()).then(response => {
      if (!this.httpResponseIsOk(response)) {
        this.log.error(`Login failed: ${response.status} ${response.statusText}`);
        return;
      }

      this.phpSession = response.headers.get('set-cookie').split(';')[0].split('=')[1].trim();
      this.accAlt     = response.headers.get('acc_alt');
      this.accSession = response.headers.get('acc_session');

      if (!this.accAlt || !this.accSession || !this.phpSession) {
        this.log.error(`Login failed: couldn't parse headers`);
        return;
      }

      this.log.info(`Login OK`);
      this.ready = true;
    });
  }

  refreshTesyWaterHeaterStatus() {
    this.log.debug(`Executing refreshTesyWaterHeaterStatus`);
    this.getDevice((device) => {
      // FIXME if mode is auto and target < current, set target == current
      this.status = device.DeviceStatus;
      //this.log.debug(`Loaded status`, this.status);

      const newCurrentTemperature = parseFloat(this.status[KEY_CURRENT_SHOWERS]),
            oldCurrentTemperature = this.service.getCharacteristic(Characteristic.CurrentTemperature).value;
      if (newCurrentTemperature != oldCurrentTemperature) {
        this.service.getCharacteristic(Characteristic.CurrentTemperature).updateValue(newCurrentTemperature);
        this.log.info(`Changing CurrentTemperature from ${oldCurrentTemperature} to ${newCurrentTemperature}`);
      }

      const newHeatingThresholdTemperature = parseFloat(this.status[KEY_TARGET_SHOWERS]),
            oldHeatingThresholdTemperature = this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).value;
      if (newHeatingThresholdTemperature != oldHeatingThresholdTemperature) {
        this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(newHeatingThresholdTemperature);
        this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(newHeatingThresholdTemperature);
        this.log.info(`Changing HeatingThresholdTemperature from ${oldHeatingThresholdTemperature} to ${newHeatingThresholdTemperature}`);
      }

      const newHeaterActiveStatus = this.getTesyWaterHeaterActiveState(this.status[KEY_POWER]),
            oldHeaterActiveStatus = this.service.getCharacteristic(Characteristic.Active).value;
      if (newHeaterActiveStatus != oldHeaterActiveStatus) {
        this.service.getCharacteristic(Characteristic.Active).updateValue(newHeaterActiveStatus);
        this.log.info(`Changing ActiveStatus from ${oldHeaterActiveStatus} to ${newHeaterActiveStatus}`);
      }

      const newCurrentHeaterCoolerState = this.getTesyWaterHeaterCurrentHeaterCoolerState(this.status[KEY_HEATER_STATE]),
            oldCurrentHeaterCoolerState = this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState).value;
      if (newCurrentHeaterCoolerState != oldCurrentHeaterCoolerState) {
        this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(newCurrentHeaterCoolerState);
        this.log.info(`Changing CurrentHeaterCoolerState from ${oldCurrentHeaterCoolerState} to ${newCurrentHeaterCoolerState}`);
      }

      const newTargetHeaterCoolerState = this.getTesyWaterHeaterTargetHeaterCoolerState(parseInt(this.status[KEY_MODE])),
            oldTargetHeaterCoolerState = this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).value;
      if (newTargetHeaterCoolerState != oldTargetHeaterCoolerState) {
        this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(newTargetHeaterCoolerState);
        this.log.info(`Changing TargetHeaterCoolerState from ${oldTargetHeaterCoolerState} to ${newTargetHeaterCoolerState}`);
      }
    });
  }

  getActive(callback) {
    this.log.debug(`Executing getActive`);
    if (!this.status) {
      this.log.debug(`Status not loaded`);
      callback(null, this.service.getCharacteristic(Characteristic.Active).value);
      return;
    }
    const active = this.getTesyWaterHeaterActiveState(this.status[KEY_POWER]);
    this.log.debug(`Active is: ${active}`);
    callback(null, active);
  }

  getCurrentTemperature(callback) {
    this.log.debug(`Executing getCurrentTemperature`);
    if (!this.status) {
      this.log.debug(`Status not loaded`);
      callback(null, this.service.getCharacteristic(Characteristic.CurrentTemperature).value);
      return;
    }
    const currentTemperature = parseFloat(this.status[KEY_CURRENT_SHOWERS]);
    this.log.debug(`CurrentTemperature is: ${currentTemperature}`);
    callback(null, currentTemperature);
  }

  getTargetHeaterCoolerState(callback) {
    this.log.debug(`Executing getTargetHeaterCoolerState`);
    if (!this.status) {
      this.log.debug(`Status not loaded`);
      callback(null, this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState).value);
      return;
    }
    const targetHeaterCoolerState = this.getTesyWaterHeaterTargetHeaterCoolerState(parseInt(this.status[KEY_MODE]));
    this.log.debug(`TargetHeaterCoolerState is: ${targetHeaterCoolerState}`);
    callback(null, targetHeaterCoolerState);
  }

  setActive(value, callback) {
    const valueToSet = value === 0 ? 'off' : 'on',
          url        = baseUrl + 'api.php?cmd=apiv1&name=' + KEY_POWER + '&set=' + valueToSet + '&id=' + this.device_id;

    this.log.debug(`Executing setActive with value: ${valueToSet}`);

    this.updateDevice(url, callback);
  }

  setTargetHeaterCoolerState(value, callback) {
    if (value < Characteristic.TargetHeaterCoolerState.AUTO) {
      value = Characteristic.TargetHeaterCoolerState.AUTO;
    }
    if (value > Characteristic.TargetHeaterCoolerState.HEAT) {
      value = Characteristic.TargetHeaterCoolerState.HEAT;
    }

    this.log.debug(`Executing setTargetHeaterCoolerState with value: ${value}`);

    const mode = value == Characteristic.TargetHeaterCoolerState.AUTO ? MODE_ECO : MODE_MANUAL,
          url  = baseUrl + 'api.php?cmd=apiv1&name=mode&set=' + mode + '&id=' + this.device_id;

    this.updateDevice(url, callback);
  }

  setThresholdTemperature(value, callback) {
    if (value < this.minTemp) {
      value = this.minTemp;
    }
    if (value > this.maxTemp) {
      value = this.maxTemp;
    }

    this.log.debug(`Executing setHeatingThresholdTemperature with value: ${value}`);

    const url = baseUrl + 'api.php?cmd=apiv1&name=tmpT&set=' + value + '&id=' + this.device_id;

    this.updateDevice(url, callback);

    this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(value);
    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(value);
    this.status[KEY_TARGET_SHOWERS] = value;
  }

  setHeatingThresholdTemperature(value, callback) {
    this.setThresholdTemperature(value, callback);
  }

  setCoolingThresholdTemperature(value, callback) {
    this.setThresholdTemperature(value, callback);
  }

  getName(callback) {
    callback(null, this.name);
  }

  // noinspection JSUnusedGlobalSymbols
  identify(callback) {
    this.log.info(`Hi there`);
    callback();
  }

  // noinspection JSUnusedGlobalSymbols
  getServices() {
    this.informationService = new Service.AccessoryInformation();
    this.service            = new Service.HeaterCooler(this.name);

    ////////////

    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

    ////////////

    this.service
      .getCharacteristic(Characteristic.Name)
      .on('get', this.getName.bind(this));

    ////////////

    this.service.getCharacteristic(Characteristic.Active)
      .on('get', this.getActive.bind(this))
      .on('set', this.setActive.bind(this));

    ////////////

    this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
      .updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);

    ////////////

    this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [
          Characteristic.TargetHeaterCoolerState.AUTO,
          Characteristic.TargetHeaterCoolerState.HEAT
        ]
      });

    this.service
      .getCharacteristic(Characteristic.TargetHeaterCoolerState)
      .on('get', this.getTargetHeaterCoolerState.bind(this))
      .on('set', this.setTargetHeaterCoolerState.bind(this));

    ////////////

    // CharacteristicEventTypes.GET / SET - FIXME

    this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .on('set', this.setHeatingThresholdTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: 1
      }).updateValue(this.maxTemp);

    ////////////

    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .on('set', this.setCoolingThresholdTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.minTemp,
        maxValue: this.maxTemp,
        minStep: 1
      }).updateValue(this.maxTemp);

    ////////////

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .setProps({
        minStep: 1
      });

    ////////////

    return [this.informationService, this.service];
  }

  defaultHeaders() {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Accept-Language': 'bg-BG,en-US;q=0.7,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'TE': 'trailers',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/113.0',
      'Referer': 'https://www.mytesy.com/v3/'
    };
  }

  loginParams() {
    return {
      method: 'POST',
      headers: this.defaultHeaders(),
      body: new URLSearchParams({
        user: this.username,
        pass: this.password
      })
    };
  }

  apiParams() {
    return {
      method: 'GET',
      credentials: 'include',
      headers: Object.assign(
        {
          'X-ACC-ALT': this.accAlt,
          'X-ACC-SESSION': this.accSession,
          'Cookie': 'PHPSESSID=' + this.phpSession,
          'X-WEB-VER': '100'
        },
        this.defaultHeaders()
      )
    };
  }

  getDevice(callback) {
    if (!this.ready) {
      this.log.debug(`Not ready, aborted`);
      this.pullTimer.start();
      return;
    }

    this.pullTimer.stop();

    fetch(infoUrl, this.apiParams())
      .then(this.validateHttpResponse.bind(this))
      .then(this.responseJson)
      .then((response) => {
        if (!response.device || !Object.entries(response.device).length) {
          this.log.error(`Get devices request failed: invalid API response`);
          this.log.error(response);
          this.pullTimer.start();
          return;
        }

        Object.values(response.device).forEach(device => {
          if (device.id != this.device_id) {
            return;
          }
          callback(device);
        });

        this.pullTimer.start();
      })
      .catch(error => {
        this.apiError(error);
      });
  }

  updateDevice(url, callback) {
    if (!this.ready) {
      this.log.debug(`Not ready, aborted`);
      callback(null);
      this.pullTimer.start();
      return;
    }

    this.pullTimer.stop();

    fetch(url, this.apiParams())
      .then(this.validateHttpResponse.bind(this))
      .then(this.responseJson)
      .then((response) => {
        if (this.updateIsOk(response)) {
          callback(null);
        } else {
          callback();
        }
        this.pullTimer.start();
      }).catch((error) => {
        this.apiError(error);
        callback();
      }
    );
  }

  apiError(error) {
    this.log.error(`Error: ${error.message}`);
    this.pullTimer.start();
    this.ready = false;
  }

  getTesyWaterHeaterActiveState(state) {
    if (state.toLowerCase() === 'on')
      return Characteristic.Active.ACTIVE;
    else
      return Characteristic.Active.INACTIVE;
  }

  getTesyWaterHeaterCurrentHeaterCoolerState(state) {
    if (state.toUpperCase() === 'READY') { // FIXME
      return Characteristic.CurrentHeaterCoolerState.IDLE;
    } else {
      return Characteristic.CurrentHeaterCoolerState.HEATING;
    }
  }

  getTesyWaterHeaterTargetHeaterCoolerState(state) {
    if (state === MODE_MANUAL)
      return Characteristic.TargetHeaterCoolerState.HEAT;
    else
      return Characteristic.TargetHeaterCoolerState.AUTO;
  }

  httpResponseIsOk(response) {
    return response && response.status === 200;
  }

  updateIsOk(response) {
    return response && response[KEY_STAT] === 'ok';
  }

  validateHttpResponse(response) {
    if (!this.httpResponseIsOk(response)) {
      throw new Error('Request failed ' + response.status + ' ' + response.statusText);
    }
    return response;
  }

  responseJson(response) {
    return response.json();
  }
}

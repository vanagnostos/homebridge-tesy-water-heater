# homebridge-water-heater-tesy

### Homebridge plugin to control a Tesy Water Heater

This plugin works with Tesy BelliSlimo water heaters (perhaps other models which have "number of showers" instead of temperature setting would work too, but I don't own one so can't be sure). 

### Supported modes/functionalities: 

 - Turn the heater on/off.
 - Available number of showers (ignore the temperature unit, couldn't find a way to hide it).
 - Current state: heating/idle.
 - Manual mode which corresponds to Heat mode in Home app. In this mode you can set select number of showers (0 to 4).   
 - Eco Smart mode which corresponds to Auto mode in Home app. In this mode the heater selects target number oh showers automatically so changing it from the app does nothing.

## Installation

1. Install [homebridge](https://github.com/homebridge/homebridge#installation-details).
2. Install this plugin: `npm install -g homebridge-water-heater-tesy`.
3. Update your `config.json` file (See below).

## Configuration example

```json
"accessories": [
     {
       "accessory": "TesyWaterHeater",
       "name": "My Bellislimo",
       "username": "mytesy_cloud_username",
       "password": "mytesy_cloud_password",
       "device_id": "XXXXXXXXXXXXXXX"
     }
]
```

### Structure

| Key | Description                                                                                                                         |
| --- |-------------------------------------------------------------------------------------------------------------------------------------|
| `accessory` | Must be `TesyWaterHeater`                                                                                                           |
| `name` | Name to appear in the Home app                                                                                                      |
| `username` | Username for mytesy.com                                                                                                             |
| `password` | Password mytesy.com                                                                                                                 |
| `device_id` | Heater (Convector) Device Id                                                                                                        |
| `pullInterval` _(optional)_ | This property expects an interval in milliseconds in which the plugin pulls updates from Tesy Cloud (`30000` is default) 
| `maxTemp` _(optional)_ | Upper bound for the temperature selector in the Home app (`4` is default)                                                           |
| `minTemp` _(optional)_ | Lower bound for the temperature selector in the Home app (`0` is default)                                                           |
| `model` _(optional)_ | Appears under "Model" for your accessory in the Home app                                                                            |
| `serialNumber` _(optional)_ | Appears under "Serial Number" for your accessory in the Home app                                                                    |

### Device ID

To find your device id you need to log in to Tesy Cloud (https://www.mytesy.com/v3/) and inspect server responses in browser's console. 

Go to Network tab, select one of the requests and expand the response. Device ID looks like this: `n3435c4666f7946161c8ad3d19f5cee9ae24e041`.

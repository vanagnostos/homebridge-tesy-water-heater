# homebridge-tesy-water-heater

#### Homebridge plugin to control a Tesy Water Heater

## Installation

1. Install [homebridge](https://github.com/homebridge/homebridge#installation-details)
2. Install this plugin: `npm install -g homebridge-tesy-water-heater`
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
| `pullInterval` _(optional)_ | This property expects an interval in milliseconds in which the plugin pulls updates from your Ecoforest heater (`10000` is default) 
| `maxTemp` _(optional)_ | Upper bound for the temperature selector in the Home app (`4` is default)                                                           |
| `minTemp` _(optional)_ | Lower bound for the temperature selector in the Home app (`0` is default)                                                           |
| `model` _(optional)_ | Appears under "Model" for your accessory in the Home app                                                                            |
| `serialNumber` _(optional)_ | Appears under "Serial Number" for your accessory in the Home app                                                                    |


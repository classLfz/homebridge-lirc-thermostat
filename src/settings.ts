import { AccessoryConfig } from 'homebridge'

export const ACCESSORY_NAME = 'HomebridgeLircThermostat'

export const MANU_FACTURER = 'homebridge lirc thermostat'

export const MODEL = 'RespberryPI LIRC Thermostat'

export const DEFAULT_DEBOUNCE_TIME = 1000

export interface LircThermostatConfig extends AccessoryConfig {
	lirc: {
		commands: {
			lircd: string,
			irrecord: string,
			irsend: string
		},
		'lirc_driver': string,
		'lirc_conf': string,
		'lirc_pid': string,
		device: string,
		'tmp_dir': string,
		remote: string
	},
	debounceTime: number,
	stateCommands: {
		[key: string]: string,
	},
	heatTempsCommands: {
		template: string,
		[temp: string]: string,
	},
	coolTempsCommands: {
		template: string,
		[temp: string]: string,
	},
	autoTempsCommands: {
		template: string,
		[temp: string]: string,
	}
}

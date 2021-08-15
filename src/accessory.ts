import * as fs from 'fs'
import { AccessoryConfig, AccessoryPlugin, API, Logger, Service } from 'homebridge'
import { DEFAULT_DEBOUNCE_TIME, LircThermostatConfig, MANU_FACTURER, MODEL } from './settings'

const { version } = require('../package.json')
const nodeLIRC = require('node-lirc')

export class ThermostatAccessory implements AccessoryPlugin {
	public readonly Service: typeof Service = this.api.hap.Service
	public readonly service: any
	public readonly informationService: Service
	public currentState: number = 0
	public targetState: number = 0
	public currentTemperature: number = 10
	public targetTemperature: number = 10
	public temperatureDisplayUnits: number = 1

	constructor (
		public readonly log: Logger,
		public readonly config: AccessoryConfig,
		public readonly api: API
	) {
		this.log = log
		this.config = config
		this.api = api
		this.log.debug('initializing accessory with config: ', this.config)

		// initialize node lirc
		nodeLIRCInit(this.log, this.config.lirc)

		this.informationService = new this.api.hap.Service.AccessoryInformation()
			.setCharacteristic(this.api.hap.Characteristic.Manufacturer, MANU_FACTURER)
			.setCharacteristic(this.api.hap.Characteristic.Model, MODEL)
			.setCharacteristic(this.api.hap.Characteristic.SerialNumber, 'Version ' + version)

		this.service = new this.api.hap.Service.Thermostat(this.config.name)

		this.service.getCharacteristic(this.api.hap.Characteristic.CurrentHeatingCoolingState)
			.onGet(this.handleCurrentHeatingCoolingStateGet.bind(this))

		this.service.getCharacteristic(this.api.hap.Characteristic.TargetHeatingCoolingState)
			.onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
			.onSet(this.handleTargetHeatingCoolingStateSet.bind(this))

		this.service.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
			.onGet(this.handleCurrentTemperatureGet.bind(this))

		this.service.getCharacteristic(this.api.hap.Characteristic.TargetTemperature)
			.onGet(this.handleTargetTemperatureGet.bind(this))
			.onSet(this.handleTargetTemperatureSet.bind(this))

		this.service.getCharacteristic(this.api.hap.Characteristic.TemperatureDisplayUnits)
			.onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
			.onSet(this.handleTemperatureDisplayUnitsSet.bind(this))
	}

	getServices () {
		return [
			this.informationService,
			this.service
		]
	}

	/**
	 * state
	 */
	handleCurrentHeatingCoolingStateGet () {
		this.log.info('Getting current heating cooling state: ', this.currentState)
		return this.currentState
	}

	handleTargetHeatingCoolingStateGet () {
		this.log.info('Getting target heating cooling state: ', this.targetState)
		return this.targetState
	}

	handleTargetHeatingCoolingStateSet (value: number) {
		this.log.info('Setting target heating cooling state to: ', value)
		if (!this.config.stateCommands) {
			this.log.error('stateCommands config not found.')
			return
		}
		const config = this.config as LircThermostatConfig
		const state = ['OFF', 'HEAT', 'COOL', 'AUTO'][value]
		const stateCommand = config.stateCommands[state]
		if (!state || !stateCommand) {
			this.log.debug('target state command not found.')
			return
		}

		this.log.info('state command: ', stateCommand)

		debounceLircSend(stateCommand, config.debounceTime || DEFAULT_DEBOUNCE_TIME, () => {
			this.currentState = value
			this.targetState = value
		})
	}

	/**
	 * temperature
	 */
	handleCurrentTemperatureGet () {
		this.log.info('Getting current temperature: ', this.currentTemperature)
		return this.currentTemperature
	}

	handleTargetTemperatureGet () {
		this.log.info('Getting target temperature :', this.targetTemperature)
		return this.targetTemperature
	}

	handleTargetTemperatureSet (value: number) {
		this.log.info('Setting target temperature to: ', value)
		// device off
		if (this.currentState === 0) return
		// commands check
		const config = this.config as LircThermostatConfig
		if ((this.currentState === 1 && !config.heatTempsCommands) ||
			(this.currentState === 2 && !config.coolTempsCommands) ||
			(this.currentState === 3 && !config.autoTempsCommands)) {
			this.log.error('tempsCommands config not found.')
			return
		}
		let tempsCommands
		switch (this.currentState) {
			case 1:
				tempsCommands = config.heatTempsCommands
				break
			case 2:
				tempsCommands = config.coolTempsCommands
				break
			case 3:
				tempsCommands = config.autoTempsCommands
				break
		}
		const tempNum = parseInt(value.toString())
		// temp command template
		const tempCommand = tempsCommands.template
			? tempsCommands.template.replace(/\{tempNum\}/, tempNum)
			: tempsCommands[tempNum]
		if (!tempCommand) {
			this.log.debug('tempature set command not found.')
			return
		}

		this.log.info('temp command: ', tempCommand)

		debounceLircSend(tempCommand, config.debounceTime || DEFAULT_DEBOUNCE_TIME, () => {
			this.targetTemperature = value
			this.currentTemperature = value
		})
	}

	handleTemperatureDisplayUnitsGet () {
		this.log.info('Getting temperature display units :', this.temperatureDisplayUnits)
		return this.temperatureDisplayUnits
	}

	handleTemperatureDisplayUnitsSet (value: number) {
		this.log.info('Setting temperature display units to:', value)
		this.temperatureDisplayUnits = value
	}
}

const nodeLIRCInit = (log: Logger, config?: any) => {
	if (config) {
		fs.writeFileSync('./config.json', JSON.stringify(config))
	}
	nodeLIRC.init()
	nodeLIRC.on('stdout', (event) => {
		log.info(event.instructions)
	})

	nodeLIRC.on('stderr', (data) => {
		log.info('irrecord output stderr: ' + data.toString())
	})

	nodeLIRC.on('exit', (code) => {
		log.info('irrecord exited with code ' + (code ? code.toString() : '(unknown)'))
	})
}

let timer

const debounceLircSend = (command: string, debounceTime: number, cb?: () => void) => {
	if (timer) {
		clearTimeout(timer)
		timer = undefined
	}
	timer = setTimeout(() => {
		nodeLIRC.send(command)
		if (cb) cb()
	}, debounceTime)
}

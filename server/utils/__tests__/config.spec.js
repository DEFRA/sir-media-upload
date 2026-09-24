import { updateBaseUrl } from '../config.js'

describe('config', () => {
  it('returns SMART_INCIDENT_REPORTING_BASE_URL unchanged when it starts with https://', async () => {
    const result = updateBaseUrl('https://sir-dev1.azure.defra.cloud/')
    expect(result).toBe('https://sir-dev1.azure.defra.cloud/')
  })

  it('adds https:// to SMART_INCIDENT_REPORTING_BASE_URL when protocol is missing', () => {
    const result = updateBaseUrl('sir-dev1.azure.defra.cloud/')
    expect(result).toBe('https://sir-dev1.azure.defra.cloud/')
  })

  it('Should accept valid deploymentEnv values', () => {
    const validEnvs = ['development', 'test', 'training']
    validEnvs.forEach(env => {
      jest.isolateModules(() => {
        process.env.DEPLOYMENT_ENV = env
        const config = require('../config.js')
        expect(config.default.deploymentEnv).toBe(env)
      })
    })
  })

  it('Should set deploymentEnv to null for invalid deploymentEnv value', () => {
    jest.isolateModules(() => {
      process.env.DEPLOYMENT_ENV = 'invalid-env'
      const config = require('../config.js')
      expect(config.default.deploymentEnv).toBeNull()
    })
  })

  it('Should set deploymentEnv to null when not set', () => {
    jest.isolateModules(() => {
      delete process.env.DEPLOYMENT_ENV
      const config = require('../config.js')
      expect(config.default.deploymentEnv).toBeNull()
    })
  })
})

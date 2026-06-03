import { ensureHttpProtocol } from '../config.js'

describe('config', () => {
  it('returns SMART_INCIDENT_REPORTING_BASE_URL unchanged when it starts with https://', async () => {
    const result = ensureHttpProtocol('https://sir-dev1.azure.defra.cloud/')
    expect(result).toBe('https://sir-dev1.azure.defra.cloud/')
  })

  it('adds https:// to SMART_INCIDENT_REPORTING_BASE_URL when protocol is missing', () => {
    const result = ensureHttpProtocol('sir-dev1.azure.defra.cloud/')
    expect(result).toBe('https://sir-dev1.azure.defra.cloud/')
  })
})

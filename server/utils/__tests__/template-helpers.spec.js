import { createJourneyUrl, getJourneyServiceName } from '../template-helpers.js'
import config from '../config.js'
import constants from '../constants.js'

describe('createJourneyUrl', () => {
  afterEach(() => {
    config.deploymentEnv = null
  })

  it.each([
    ['smell', constants.urls.GOV_UK_SMELL],
    ['dust', constants.urls.GOV_UK_DUST],
    ['mud', constants.urls.GOV_UK_MUD],
    ['vermin', constants.urls.GOV_UK_PESTS],
    ['noise', constants.urls.GOV_UK_NOISE],
    ['blockage', constants.urls.GOV_UK_BLOCKAGE],
    ['water pollution', constants.urls.GOV_UK_WATER_POLLUTION],
    ['illegal fishing', constants.urls.GOV_UK_ILLEGAL_FISHING],
    ['litter', constants.urls.GOV_UK_LITTER]
  ])('should return the gov.uk start page url for %s when DEPLOYMENT_ENV is not set', (journey, journeyUrl) => {
    expect(createJourneyUrl(journey)).toBe(journeyUrl)
  })

  it.each(['unknown', undefined, null])('should return the gov.uk service home url for journey %s when DEPLOYMENT_ENV is not set', journey => {
    expect(createJourneyUrl(journey)).toBe(constants.urls.GOV_UK_SERVICE_HOME)
  })

  it.each(['development', 'test', 'training'])('should return the base url without a journey path when DEPLOYMENT_ENV is %s', deploymentEnv => {
    config.deploymentEnv = deploymentEnv
    expect(createJourneyUrl('smell')).toBe(config.smartIncidentReportingBaseUrl)
  })
})

describe('getJourneyServiceName', () => {
  it.each([
    ['water pollution', 'Report water pollution in England'],
    ['smell', 'Report a smell from a waste facility, industrial site or farm in England'],
    ['litter', 'Report litter from a waste facility, industrial site or farm in England'],
    ['illegal fishing', 'Report illegal fishing in England'],
    ['blockage', 'Report a blockage in a river in England'],
    ['noise', 'Report noise from a waste facility, industrial site or farm in England'],
    ['vermin', 'Report vermin or pest problem from a waste facility, industrial site or farm in England'],
    ['dust', 'Report dust from a waste facility, industrial site or farm in England'],
    ['mud', 'Report mud from a waste facility, industrial site or farm in England']
  ])('should return the service name for %s', (journey, name) => {
    expect(getJourneyServiceName(journey)).toBe(name)
  })

  it('should return undefined for an unknown journey', () => {
    expect(getJourneyServiceName('unknown')).toBeUndefined()
  })
})

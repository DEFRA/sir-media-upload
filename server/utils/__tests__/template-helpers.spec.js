import { createJourneyUrl, getJourneyServiceName } from '../template-helpers.js'
import config from '../config.js'

describe('createJourneyUrl', () => {
  it.each([
    ['smell', 'report-smell'],
    ['dust', 'report-dust'],
    ['mud', 'report-mud'],
    ['vermin', 'report-vermin'],
    ['noise', 'report-noise'],
    ['blockage', 'report-river-blockage'],
    ['water pollution', 'report-water-pollution'],
    ['illegal fishing', 'report-illegal-fishing-in-england'],
    ['litter', 'report-litter-at-regulated-site']
  ])('should build the start page url for %s', (journey, path) => {
    expect(createJourneyUrl(journey)).toBe(`${config.smartIncidentReportingBaseUrl}/${path}`)
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

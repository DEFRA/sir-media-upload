import config from './config.js'

// This is a location for storing helpers that are used by front end nunjucks templates

const findErrorMessageById = (errorSummary, id) => {
  return errorSummary?.errorList?.find(error => error.href === `#${id}`)
}

const journeyPaths = {
  smell: 'report-smell',
  dust: 'report-dust',
  mud: 'report-mud',
  vermin: 'report-vermin',
  noise: 'report-noise',
  blockage: 'report-river-blockage',
  'water pollution': 'report-water-pollution',
  'illegal fishing': 'report-illegal-fishing-in-england',
  litter: 'report-litter-at-regulated-site'
}

const journeyServiceNames = {
  smell: 'Report a smell from a waste facility, industrial site or farm in England',
  dust: 'Report dust from a waste facility, industrial site or farm in England',
  mud: 'Report mud from a waste facility, industrial site or farm in England',
  vermin: 'Report vermin or pest problem from a waste facility, industrial site or farm in England',
  noise: 'Report noise from a waste facility, industrial site or farm in England',
  blockage: 'Report a blockage in a river in England',
  'water pollution': 'Report water pollution in England',
  'illegal fishing': 'Report illegal fishing in England',
  litter: 'Report litter from a waste facility, industrial site or farm in England'
}

const createJourneyUrl = journey => {
  return `${config.smartIncidentReportingBaseUrl}/${journeyPaths[journey]}`
}

const getJourneyServiceName = journey => journeyServiceNames[journey]

export {
  findErrorMessageById,
  createJourneyUrl,
  getJourneyServiceName
}

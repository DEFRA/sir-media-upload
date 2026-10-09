import config from './config.js'
import constants from './constants.js'

// This is a location for storing helpers that are used by front end nunjucks templates

const findErrorMessageById = (errorSummary, id) => {
  return errorSummary?.errorList?.find(error => error.href === `#${id}`)
}

const journeyUrls = {
  'a smell': constants.urls.GOV_UK_SMELL,
  dust: constants.urls.GOV_UK_DUST,
  mud: constants.urls.GOV_UK_MUD,
  'a vermin or pest problem': constants.urls.GOV_UK_PESTS,
  noise: constants.urls.GOV_UK_NOISE,
  'blockage in a river': constants.urls.GOV_UK_BLOCKAGE,
  'water pollution': constants.urls.GOV_UK_WATER_POLLUTION,
  'illegal fishing': constants.urls.GOV_UK_ILLEGAL_FISHING,
  litter: constants.urls.GOV_UK_LITTER
}

const journeyServiceNames = {
  'a smell': 'Report a smell from a waste facility, industrial site or farm in England',
  dust: 'Report dust from a waste facility, industrial site or farm in England',
  mud: 'Report mud from a waste facility, industrial site or farm in England',
  'a vermin or pest problem': 'Report vermin or pest problem from a waste facility, industrial site or farm in England',
  noise: 'Report noise from a waste facility, industrial site or farm in England',
  'blockage in a river': 'Report a blockage in a river in England',
  'water pollution': 'Report water pollution in England',
  'illegal fishing': 'Report illegal fishing in England',
  litter: 'Report litter from a waste facility, industrial site or farm in England'
}

const createJourneyUrl = journey => {
  if (config.deploymentEnv) {
    return config.smartIncidentReportingBaseUrl
  }

  return journeyUrls[journey] || constants.urls.GOV_UK_SERVICE_HOME
}

const getJourneyServiceName = journey => journeyServiceNames[journey]

export {
  findErrorMessageById,
  createJourneyUrl,
  getJourneyServiceName
}

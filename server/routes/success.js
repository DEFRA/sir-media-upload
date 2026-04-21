import constants from '../utils/constants.js'
import config from '../utils/config.js'

const handlers = {
  get: (_request, h) => {
    const feedback = `${config.smartIncidentReportingBaseUrl}/feedback`
    return h.view(constants.views.SUCCESS, { feedback })
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.SUCCESS,
    handler: handlers.get,
    options: {
      auth: false
    }
  }
]

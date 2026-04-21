import constants from '../utils/constants.js'
import config from '../utils/config.js'

const handlers = {
  get: (_request, h) => {
    const feedback = `${config.smartIncidentReportingBaseUrl}/feedback`
    return h.view(constants.views.LINK_USED, { feedback })
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.LINK_USED,
    handler: handlers.get,
    options: {
      auth: false
    }
  }
]

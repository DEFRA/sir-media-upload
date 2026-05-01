import constants from '../utils/constants.js'

const handlers = {
  get: async (request, h) => {
    const journey = request.yar?.get?.('journey') || ''
    const feedback = process.env.SMART_INCIDENT_REPORTING_BASE_URL + '/feedback'
    return h.view(constants.views.LINK_USED, { feedback, journey })
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

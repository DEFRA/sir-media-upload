import constants from '../utils/constants.js'

const handlers = {
  get: (_request, h) => {
    const feedback = process.env.SMART_INCIDENT_REPORTING_BASE_URL + '/feedback'
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

import constants from '../utils/constants.js'

const handlers = {
  get: (_request, h) => {
    console.log('--------------------------')
    console.log('Came from:', _request.info.referrer)
    console.log('--------------------------')

    const feedback = process.env.SMART_INCIDENT_REPORTING_BASE_URL + '/feedback'
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

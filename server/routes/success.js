import constants from '../utils/constants.js'

const hasSirId = (request) => {
  const sirid = request.yar.get('sirid')
  if (!sirid) {
    return false
  }
  return true
}

const handlers = {
  get: async (request, h) => {
    if (!hasSirId(request)) {
      return h.redirect(constants.routes.LINK_USED)
    }

    const sirid = request.yar.get('sirid')
    await request.server.app.mediaUploadCache.drop(sirid)
    request.yar.reset()

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

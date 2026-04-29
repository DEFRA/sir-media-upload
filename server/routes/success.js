import constants from '../utils/constants.js'
import { hasValidSirId, removeSirIdFromSession } from '../utils/upload-session-helpers.js'

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    // FIXME: we need to delete local thumbnails too when submitted
    const sirid = removeSirIdFromSession(request)
    await request.server.app.mediaUploadCache.drop(sirid)

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

import constants from '../utils/constants.js'
import { returnFormattedDate } from '../utils/date-helpers.js'
import { addSirIdToSession, addSirIdToQueryString, hasValidSirId } from '../utils/upload-session-helpers.js'

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    const sirid = addSirIdToSession(request)
    const cachedData = await request.server.app.mediaUploadCache.get(sirid)

    const journey = cachedData?.journey
    const dateTime = cachedData?.dateTime

    return h.view(constants.views.UPLOAD_PHOTO, {
      journey,
      dateTime: returnFormattedDate(dateTime)
    })
  },
  post: async (request, h) => {
    console.log('--------------------------')
    console.log('POST /upload-photo')
    console.log('Request query:', request.query)
    console.log('--------------------------')
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    return h.redirect(addSirIdToQueryString(request, constants.routes.ADD_A_PHOTO))
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.UPLOAD_PHOTO,
    handler: handlers.get,
    options: {
      auth: false
    }
  },
  {
    method: 'POST',
    path: constants.routes.UPLOAD_PHOTO,
    handler: handlers.post,
    options: {
      auth: false
    }
  }
]

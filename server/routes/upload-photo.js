import constants from '../utils/constants.js'
import { returnFormattedDate } from '../utils/date-helpers.js'
import { addSirIdToQueryString, hasValidSirId } from '../utils/upload-session-helpers.js'

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    // const sirid = addSirIdToSession(request)
    // const cachedData = await request.server.app.mediaUploadCache.get(sirid)

    // const journey = cachedData?.journey
    // const dateTime = cachedData?.dateTime

    const cachedData = {
      journey: 'test journey',
      dateTime: new Date().toISOString()
    }

    request.yar.set('journey', cachedData.journey)

    return h.view(constants.views.UPLOAD_PHOTO, {
      journey: cachedData.journey,
      dateTime: returnFormattedDate(cachedData.dateTime)
    })
  },
  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    const redirectUrl = addSirIdToQueryString(request, constants.routes.ADD_A_PHOTO)
    return h.redirect(redirectUrl)
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

import constants from '../utils/constants.js'
import { returnFormattedDate } from '../utils/date-helper.js'

const handlers = {
  get: async (request, h) => {
    const data = await globalThis.mediaUploadCache?.get(request.query.sessionId)
    return h.view(constants.views.UPLOAD_PHOTO, {
      journey: data?.journey,
      dateTime: returnFormattedDate(data?.dateTime)
    })
  },
  post: async (_request, h) => h.redirect(constants.routes.ADD_A_PHOTO)
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

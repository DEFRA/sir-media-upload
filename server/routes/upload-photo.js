import constants from '../utils/constants.js'
import { returnFormattedDate } from '../utils/date-helpers.js'

const handlers = {
  get: async (request, h) => {
    const journey = request.yar.get('journey')
    const dateTime = request.yar.get('dateTime')

    return h.view(constants.views.UPLOAD_PHOTO, {
      journey,
      dateTime: returnFormattedDate(dateTime)
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

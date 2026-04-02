import constants from '../utils/constants.js'

const handlers = {
  get: async (request, h) => {
    const journey = request.query.journey
    const dateTime = request.query.dateTime
    return h.view(constants.views.UPLOAD_PHOTO, { journey, dateTime })
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

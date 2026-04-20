import constants from '../utils/constants.js'
import imageChecker from '../services/image-checker.js'

const handlers = {
  get: (request, h) => {
    const thumbnails = request.yar.get('thumbnails') || []
    if (thumbnails.length === 0) {
      return h.redirect(constants.routes.YOUR_PHOTOS)
    }
    return h.view(constants.views.SEND_PHOTOS, {
      photos: thumbnails.length
    })
  },
  post: async (request, h) => {
    const thumbnails = request.yar.get('thumbnails') || []
    if (thumbnails.length === 0) {
      return h.redirect(constants.routes.YOUR_PHOTOS)
    }
    await imageChecker.validate(thumbnails)
    return h.redirect(constants.routes.SUCCESS)
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.SEND_PHOTOS,
    handler: handlers.get,
    options: {
      auth: false
    }
  },
  {
    method: 'POST',
    path: constants.routes.SEND_PHOTOS,
    handler: handlers.post,
    options: {
      auth: false
    }
  }
]

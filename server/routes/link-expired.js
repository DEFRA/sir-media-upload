import constants from '../utils/constants.js'

const handlers = {
  get: async (request, h) => {
    const sirid = request.query.sirid

    return h.view(constants.views.LINK_EXPIRED, {
      sirid
    })
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.LINK_EXPIRED,
    handler: handlers.get,
    options: {
      auth: false
    }
  }
]

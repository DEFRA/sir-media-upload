import constants from '../../utils/constants.js'

const handlers = {
  get: async (request, h) => {
    const sirid = request.query.sirid
    const requestJourney = request.yar.get('journey')
    const cachedData = sirid ? await request.server.app.mediaUploadCache.get(sirid) : null
    const journey = cachedData?.journey || requestJourney || ''

    return h.view(constants.views.LINK_USED, {
      sirid,
      cachedData,
      journey
    })
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

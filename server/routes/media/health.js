import constants from '../../utils/constants.js'

export default [
  {
    method: 'GET',
    path: constants.routes.HEALTH,
    handler: (_request, h) => h.response('OK').code(200)
  }
]

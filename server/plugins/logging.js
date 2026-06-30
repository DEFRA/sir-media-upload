import config from '../utils/config.js'
import HapiPino from 'hapi-pino'

export default {
  plugin: HapiPino,
  options: {
    logPayload: true,
    level: config.logLevel,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers'],
      remove: true
    },
    ignorePaths: [
      `${config.appPathPrefix}/build/stylesheets/application.css`,
      `${config.appPathPrefix}/build/thumbnails/`
    ]
  }
}

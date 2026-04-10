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
      '/public/build/stylesheets/application.css',
      '/public/build/thumbnails/'
    ]
  }
}

import vision from '@hapi/vision'
import path from 'path'
import nunjucks from 'nunjucks'
import config from '../utils/config.js'
import constants from '../utils/constants.js'
import fs from 'fs'
import dirname from '../../dirname.cjs'
import { findErrorMessageById, createJourneyUrl, getJourneyServiceName } from '../utils/template-helpers.js'
const { version } = JSON.parse(fs.readFileSync('./package.json'))
const serviceName = 'Report an environmental problem'

export default {
  plugin: vision,
  options: {
    engines: {
      html: {
        compile: (src, options) => {
          const template = nunjucks.compile(src, options.environment)
          return context => template.render(context)
        },
        prepare: (options, next) => {
          const env = options.compileOptions.environment = nunjucks.configure(options.path, {
            autoescape: true,
            watch: false
          })
          // Add global functions for view templates
          env.addGlobal('govukRebrand', true)
          env.addGlobal('findErrorMessageById', findErrorMessageById)
          return next()
        }
      }
    },
    path: [
      path.join(dirname, 'public', 'build', 'views'),
      path.join(dirname, 'server', 'views'),
      path.join(dirname, 'node_modules', 'govuk-frontend')
    ],
    relativeTo: dirname,
    isCached: !config.isDev,
    context: request => {
      const journey = request.yar.id ? request.yar.get('journey') : null

      return {
        appVersion: version,
        env: config.env,
        deploymentEnv: config.deploymentEnv,
        assetPath: `${config.appPathPrefix}/public`,
        appPathPrefix: config.appPathPrefix,
        govUkHome: constants.urls.GOV_UK_HOME,
        serviceUrl: createJourneyUrl(journey),
        navServiceName: getJourneyServiceName(journey) || serviceName,
        serviceName,
        pageTitleServiceName: 'report an environmental problem',
        smartIncidentReportingBaseUrl: config.smartIncidentReportingBaseUrl,
        feedbackUrl: `${config.smartIncidentReportingBaseUrl}/feedback`
      }
    }
  }
}

import config from '../../utils/config.js'

export default [{
  method: 'GET',
  path: `${config.appPathPrefix}/robots.txt`,
  handler: {
    file: 'server/public/static/robots.txt'
  },
  options: {
    auth: false
  }
}, {
  method: 'GET',
  path: `${config.appPathPrefix}/public/all.js`,
  handler: {
    file: 'node_modules/govuk-frontend/dist/govuk/all.js'
  },
  options: {
    auth: false
  }
},
{
  method: 'GET',
  path: `${config.appPathPrefix}/public/{path*}`,
  handler: {
    directory: {
      path: [
        'server/public/static',
        'server/public/build',
        'server/public/js',
        'node_modules/govuk-frontend/dist/govuk',
        'node_modules/govuk-frontend/dist/govuk/assets/rebrand',
        'node_modules/govuk-frontend/dist/govuk/assets',
        'node_modules/ispinner.css'
      ]
    }
  },
  options: {
    auth: false
  }
}
]

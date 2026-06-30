import { parse } from 'node-html-parser'
import plugin from '../error-pages.js'
import { getServer } from '../../../.jest/setup.js'

describe('error-pages', () => {
  it('is a plugin', () => {
    expect(plugin.name).toEqual('error-pages')
    expect(typeof plugin.register).toEqual('function')
  })

  it('renders the 404 page for unknown routes', async () => {
    const response = await getServer().inject({
      method: 'GET',
      url: '/media/this-route-does-not-exist'
    })

    expect(response.statusCode).toEqual(404)

    const html = parse(response.payload)
    expect(html.querySelector('h1').textContent).toContain('Page not found')
  })

  it('renders the 500 page for internal errors', async () => {
    getServer().route({
      method: 'GET',
      path: '/_error-test',
      options: {
        auth: false
      },
      handler: () => {
        throw new Error('test error')
      }
    })

    const response = await getServer().inject({
      method: 'GET',
      url: '/_error-test'
    })

    expect(response.statusCode).toEqual(500)

    const html = parse(response.payload)
    expect(html.querySelector('h1').textContent).toContain('Sorry, there is a problem with the service')
  })
})

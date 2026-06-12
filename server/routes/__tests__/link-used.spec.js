import { submitGetRequest } from '../../__test-helpers__/server.js'
import { getServer } from '../../../.jest/setup.js'
import constants from '../../utils/constants.js'
import linkUsedRoute from '../link-used.js'

const url = constants.routes.LINK_USED
const header = 'This link has been used'

describe(url, () => {
  beforeEach(() => {
    getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
  })

  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      await submitGetRequest({ url }, header)
    })

    it(`Should display 'What happens next' heading for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.payload).toContain('What happens next')
    })

    it(`Should display photo submission confirmation text for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.payload).toContain('We have received your photos')
    })

    it('should display journey from cached data when provided', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue({ journey: 'water pollution' })

      const response = await submitGetRequest({
        url: `${url}?sirid=test-sirid`
      }, header)

      expect(response.payload).toContain('You have already uploaded photos to support your <strong>water pollution</strong> report.')
    })

    it('should not display journey text even when journey data is present', async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK, {
        journey: 'water pollution'
      })
      expect(response.payload).not.toContain('support your report of water pollution')
    })

    it('should not show journey text when no journey is provided', async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.payload).not.toContain('support your report of ')
    })

    it(`Should pass feedback link to view for ${url}`, async () => {
      const baseUrl = 'https://sir-base-url.gov.uk'
      process.env.SMART_INCIDENT_REPORTING_BASE_URL = baseUrl

      const view = jest.fn()
      const request = {
        query: {},
        yar: {
          get: jest.fn().mockReturnValue('')
        },
        server: {
          app: {
            mediaUploadCache: {
              get: jest.fn().mockResolvedValue(null)
            }
          }
        }
      }

      await linkUsedRoute[0].handler(request, { view })

      expect(view).toHaveBeenCalledWith(constants.views.LINK_USED, {
        sirid: undefined,
        cachedData: null,
        journey: ''
      })
    })

    it('should display journey from session when cache has no journey', async () => {
      const response = await submitGetRequest({ url: `${url}?sirid=test-sirid` }, header, constants.statusCodes.OK, {
        journey: 'water pollution'
      })

      expect(response.payload).toContain('You have already uploaded photos to support your <strong>water pollution</strong> report.')
    })
  })
})

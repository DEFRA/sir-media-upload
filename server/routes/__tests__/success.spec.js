import { submitGetRequest } from '../../__test-helpers__/server.js'
import { getServer } from '../../../.jest/setup.js'
import constants from '../../utils/constants.js'
import successRoute from '../success.js'
import fs from 'node:fs'

const baseUrl = constants.routes.SUCCESS
const url = `${baseUrl}?sirid=test-session-id`

describe(baseUrl, () => {
  beforeEach(() => {
    getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue({ journey: 'test' })
  })

  describe('GET', () => {
    it('should redirect to link-used when sirid is missing', async () => {
      const response = await submitGetRequest({ url: baseUrl }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-used with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_USED}?sirid=test-session-id`)
    })

    it(`Should return success response and correct view for ${baseUrl}`, async () => {
      await submitGetRequest({ url }, 'Thank you')
    })

    it(`Should display 'What happens next' heading for ${baseUrl}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('What happens next')
    })

    it(`Should display photo submission confirmation text for ${baseUrl}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('We have received your photos')
    })

    it(`Should display feedback link for ${baseUrl}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('<a href="https://sir-base-url.gov.uk/feedback">Give feedback</a>')
    })

    it('should log and continue when local thumbnail deletion throws', async () => {
      const baseUrl = 'https://sir.example.gov.uk'
      process.env.SMART_INCIDENT_REPORTING_BASE_URL = baseUrl

      const view = jest.fn()
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        throw new Error('disk error')
      })

      const mockRequest = {
        query: { sirid: 'test-session-id' },
        yar: {
          get: jest.fn((key) => {
            if (key === 'existing-uploads') {
              return {
                'test-session-id': {
                  thumbnails: [{ finalFilename: 'test.jpg', thumbLoc: '/public/thumbnails/test.jpg' }]
                }
              }
            }
            return undefined
          }),
          set: jest.fn()
        },
        server: {
          app: {
            mediaUploadCache: {
              get: jest.fn().mockResolvedValue({ journey: 'test' }),
              drop: jest.fn()
            }
          }
        }
      }

      await successRoute[0].handler(mockRequest, { view })

      expect(consoleSpy).toHaveBeenCalledWith('Local thumbnail deletion failed', expect.objectContaining({
        sirid: 'test-session-id'
      }))

      existsSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })
})

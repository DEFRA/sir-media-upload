import { submitGetRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import config from '../../utils/config.js'
import successRoute from '../success.js'

const url = constants.routes.SUCCESS

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      await submitGetRequest({ url }, 'Thank you')
    })

    it(`Should display 'What happens next' heading for ${url}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('What happens next')
    })

    it(`Should display photo submission confirmation text for ${url}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('We have received your photos')
    })

    it(`Should display feedback link for ${url}`, async () => {
      const response = await submitGetRequest({ url }, 'Thank you')
      expect(response.payload).toContain('<a href="feedback">Give feedback</a>')
    })

    it(`Should pass feedback link to view for ${url}`, () => {
      const baseUrl = 'https://sir.example.gov.uk'
      config.smartIncidentReportingBaseUrl = baseUrl

      const view = jest.fn()
      successRoute[0].handler({}, { view })

      expect(view).toHaveBeenCalledWith(constants.views.SUCCESS, {
        feedback: `${baseUrl}/feedback`
      })
    })
  })
})

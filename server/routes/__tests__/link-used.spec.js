import { submitGetRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import config from '../../utils/config.js'
import linkUsedRoute from '../link-used.js'

const url = constants.routes.LINK_USED
const header = 'This link has been used'

describe(url, () => {
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

    it(`Should pass feedback link to view for ${url}`, () => {
      const baseUrl = 'https://sir.example.gov.uk'
      config.smartIncidentReportingBaseUrl = baseUrl

      const view = jest.fn()
      linkUsedRoute[0].handler({}, { view })

      expect(view).toHaveBeenCalledWith(constants.views.LINK_USED, {
        feedback: `${baseUrl}/feedback`
      })
    })
  })
})

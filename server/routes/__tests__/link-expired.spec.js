import { submitGetRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'

const url = constants.routes.LINK_EXPIRED
const header = 'This link has expired'

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      await submitGetRequest({ url }, header)
    })

    it(`Should display 'What happens next' heading for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.payload).toContain('What happens next')
    })

    it(`Should display photo submission information for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.payload).toContain('The Environment Agency will use your photos to help investigate the problem.')
    })

    it('should keep sirid query parameter in the page link', async () => {
      const response = await submitGetRequest({
        url: `${url}?sirid=test-sirid`
      }, header)

      expect(response.request.query.sirid).toBe('test-sirid')
    })
  })
})

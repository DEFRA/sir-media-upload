import { submitGetRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'

const url = constants.routes.HEALTH

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response ${url}`, async () => {
      const response = await submitGetRequest({ url })
      expect(response.payload).toContain('OK')
    })
  })
})

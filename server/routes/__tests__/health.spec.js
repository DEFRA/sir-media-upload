import { submitGetRequest } from '../../__test-helpers__/server.js'

const url = '/health'

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response ${url}`, async () => {
      const response = await submitGetRequest({ url })
      expect(response.payload).toContain('OK')
    })
  })
})

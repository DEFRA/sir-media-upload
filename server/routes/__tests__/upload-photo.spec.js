import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'

const url = constants.routes.UPLOAD_PHOTO
const header = 'Upload photos'

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Upload photos')
    })

    it('Should pass journey and dateTime query parameters to the view', async () => {
      const journey = 'test-journey'
      const dateTime = '2026-04-01'
      const urlWithQuery = `${url}?journey=${journey}&dateTime=${dateTime}`
      const response = await submitGetRequest({ url: urlWithQuery }, header, constants.statusCodes.OK)
      expect(response.statusCode).toBe(constants.statusCodes.OK)
    })
  })
  describe('POST', () => {
    it(`Should return redirect response for ${url}`, async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.statusCode).toBe(constants.statusCodes.REDIRECT)
    })

    it(`Should redirect to ${constants.routes.ADD_A_PHOTO} for ${url}`, async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.ADD_A_PHOTO)
    })
  })
})

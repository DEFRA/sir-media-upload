import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import { returnFormattedDate } from '../../utils/date-helper.js'

const url = constants.routes.UPLOAD_PHOTO
const header = 'Upload photos'

describe(url, () => {
  afterEach(() => {
    delete globalThis.mediaUploadCache
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Upload photos')
    })

    it('should call media upload cache using the session id', async () => {
      const dateTime = new Date(2026, 3, 9, 12, 30)
      globalThis.mediaUploadCache = {
        get: jest.fn().mockResolvedValue({
          journey: 'smell',
          dateTime
        })
      }

      const response = await submitGetRequest({
        url: `${url}?sessionId=test-session-id`
      }, header, constants.statusCodes.OK)

      expect(globalThis.mediaUploadCache.get).toHaveBeenCalledWith('test-session-id')
      expect(response.statusCode).toBe(constants.statusCodes.OK)
    })

    it('should render journey from media upload cache', async () => {
      const dateTime = new Date(2026, 3, 9, 12, 30)
      globalThis.mediaUploadCache = {
        get: jest.fn().mockResolvedValue({
          journey: 'smell',
          dateTime
        })
      }

      const response = await submitGetRequest({
        url: `${url}?sessionId=test-session-id`
      }, header, constants.statusCodes.OK)

      expect(response.payload).toContain('smell')
    })

    it('should render dateTime from media upload cache', async () => {
      const dateTime = new Date(2026, 3, 9, 12, 30)
      globalThis.mediaUploadCache = {
        get: jest.fn().mockResolvedValue({
          journey: 'smell',
          dateTime
        })
      }

      const response = await submitGetRequest({
        url: `${url}?sessionId=test-session-id`
      }, header, constants.statusCodes.OK)

      expect(response.payload).toContain(returnFormattedDate(dateTime))
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

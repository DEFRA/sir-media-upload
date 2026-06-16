import { getServer } from '../../../.jest/setup.js'
import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import { returnFormattedDate } from '../../utils/date-helpers.js'

const url = `${constants.routes.UPLOAD_PHOTO}?sirid=test-session-id`
const header = 'Upload photos'
const journeyCases = [
  'water pollution',
  'smell',
  'blockage',
  'illegal fishing'
]

describe(url, () => {
  beforeEach(() => {
    getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue({ journey: 'test' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Upload photos')
    })

    it('should redirect to link-used when sirid is missing', async () => {
      const response = await submitGetRequest({ url: constants.routes.UPLOAD_PHOTO }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-used with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_USED}?sirid=test-session-id`)
    })

    it('should return OK when journey and dateTime are in cache', async () => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      jest.spyOn(getServer().app.mediaUploadCache, 'get').mockResolvedValue({ journey: 'smell', dateTime })
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)

      expect(response.statusCode).toBe(constants.statusCodes.OK)
    })

    it.each(journeyCases)('should render journey type from cache: %s', async (journey) => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      jest.spyOn(getServer().app.mediaUploadCache, 'get').mockResolvedValue({ journey, dateTime })
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)

      expect(response.payload).toContain(journey)
    })

    it('should render dateTime from cache', async () => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      jest.spyOn(getServer().app.mediaUploadCache, 'get').mockResolvedValue({ journey: 'smell', dateTime })
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)

      expect(response.payload).toContain(returnFormattedDate(dateTime))
    })

    it('should initialize sirid in session', async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      const existingUploads = response.request.yar.get('existing-uploads')
      expect(existingUploads['test-session-id']).toBeDefined()
    })

    it('should call cache.get with the sirid from query', async () => {
      const cacheGetSpy = getServer().app.mediaUploadCache.get
      await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(cacheGetSpy).toHaveBeenCalledWith('test-session-id')
    })
  })
  describe('POST', () => {
    it(`Should return redirect response for ${constants.routes.UPLOAD_PHOTO}`, async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.statusCode).toBe(constants.statusCodes.REDIRECT)
    })

    it('should redirect to link-used when sirid is missing', async () => {
      const response = await submitPostRequest({ url: constants.routes.UPLOAD_PHOTO }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-used with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_USED}?sirid=test-session-id`)
    })

    it(`Should redirect to ${constants.routes.ADD_A_PHOTO} for ${constants.routes.UPLOAD_PHOTO}`, async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.ADD_A_PHOTO}?sirid=test-session-id`)
    })
  })
})

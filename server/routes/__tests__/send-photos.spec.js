import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import imageChecker from '../../services/image-checker.js'

const url = constants.routes.SEND_PHOTOS
const header = 'Send photos'

const generateThumbnails = (count) =>
  Array.from({ length: count }, (_, i) => ({
    finalFilename: `upload-id/photo${i + 1}.jpg`,
    thumbLoc: `/public/thumbnails/upload-id-photo${i + 1}-thumbnail.jpg`
  }))

describe(url, () => {
  beforeEach(() => {
    jest.spyOn(imageChecker, 'validate').mockResolvedValue({ success: true, skipped: true })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK, { thumbnails: generateThumbnails(1) })
      expect(response.payload).toContain('Send photos')
    })

    it('should render a send photos submit button', async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK, { thumbnails: generateThumbnails(1) })
      expect(response.payload).toContain('Send photos')
    })

    it.each([1, 2, 3, 4, 5])('should display %i photos from the session', async (count) => {
      const thumbnails = generateThumbnails(count)
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK, { thumbnails })
      expect(response.payload).toContain(`You have added ${count} out of a maximum of 5.`)
    })

    it('should redirect to your-photos when no thumbnails exist', async () => {
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.YOUR_PHOTOS)
    })

    it('should redirect to your-photos when thumbnails array is empty', async () => {
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT, { thumbnails: [] })
      expect(response.headers.location).toBe(constants.routes.YOUR_PHOTOS)
    })
  })

  describe('POST', () => {
    it.each([1, 2, 3, 4, 5])('should call image checker with %i thumbnails from the session', async (count) => {
      const thumbnails = generateThumbnails(count)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { thumbnails })
      expect(imageChecker.validate).toHaveBeenCalledWith(thumbnails)
    })

    it('should redirect to your-photos when no thumbnails exist in session', async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.YOUR_PHOTOS)
    })

    it('should redirect to your-photos when thumbnails array is empty', async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { thumbnails: [] })
      expect(response.headers.location).toBe(constants.routes.YOUR_PHOTOS)
    })
  })
})

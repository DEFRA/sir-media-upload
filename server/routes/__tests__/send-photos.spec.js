import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import imageChecker from '../../services/image-checker.js'
import { getUploadContainerClient } from '../../services/blob-storage.js'
import { sendMessage } from '../../services/service-bus.js'

jest.mock('../../services/blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

jest.mock('../../services/service-bus.js', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined)
}))

const url = constants.routes.SEND_PHOTOS
const header = 'Send photos'

const generateThumbnails = (count) =>
  Array.from({ length: count }, (_, i) => ({
    finalFilename: `upload-id/photo${i + 1}.jpg`,
    thumbLoc: `/public/thumbnails/upload-id-photo${i + 1}-thumbnail.jpg`,
    fileSizeBytes: 1024 * 1024 * (i + 1)
  }))

describe(url, () => {
  beforeEach(() => {
    getUploadContainerClient.mockResolvedValue({
      url: 'https://example.blob.core.windows.net/sir-media-uploads'
    })
    jest.spyOn(imageChecker, 'validate').mockResolvedValue({ success: true, skipped: true })
    sendMessage.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Send photos')
    })

    it('should render a send photos submit button', async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Send photos')
    })

    it.each([0, 1, 2, 3, 4, 5])('should display %i photos from the session', async (count) => {
      const thumbnails = generateThumbnails(count)
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK, { thumbnails })
      expect(response.payload).toContain(`You have added ${count} out of a maximum of 5.`)
    })
  })

  describe('POST', () => {
    it.each([0, 1, 2, 3, 4, 5])('should call image checker with %i thumbnails from the session', async (count) => {
      const thumbnails = generateThumbnails(count)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { thumbnails })
      expect(imageChecker.validate).toHaveBeenCalledWith(thumbnails)
    })

    it('should redirect to success when no thumbnails exist in session', async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.SUCCESS)
    })

    it('should use sirid from session as sessionId in payload', async () => {
      const thumbnails = generateThumbnails(1)
      const sirid = 'test-sir-session-123'

      imageChecker.validate.mockResolvedValue({
        success: true,
        skipped: false,
        response: [{ severityScores: 'Hate:0, SelfHarm:0, Sexual:0, Violence:0' }]
      })

      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { thumbnails, sirid })

      expect(sendMessage).toHaveBeenCalledTimes(1)
      const [, payload] = sendMessage.mock.calls[0]
      expect(payload.mediaUpload.sessionId).toBe(sirid)
    })

    it('should send a payload containing required fields for each image', async () => {
      const thumbnails = generateThumbnails(2)
      const sirid = 'test-session-id-456'

      imageChecker.validate.mockResolvedValue({
        success: true,
        skipped: false,
        response: [
          {
            severityScores: 'Hate:0, SelfHarm:0, Sexual:1, Violence:2'
          },
          {
            severityScores: 'Hate:4, SelfHarm:0, Sexual:0, Violence:0'
          }
        ]
      })

      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { thumbnails, sirid })

      expect(sendMessage).toHaveBeenCalledTimes(1)
      const [, payload] = sendMessage.mock.calls[0]
      expect(payload.mediaUpload).toEqual(expect.objectContaining({
        sessionId: sirid,
        timestamp: expect.any(String),
        images: expect.any(Array)
      }))

      expect(payload.mediaUpload.images).toHaveLength(2)

      expect(payload.mediaUpload.images[0]).toEqual(expect.objectContaining({
        imageLink: expect.stringContaining(`/sir-media-uploads/${sirid}/photo1.jpg`),
        imageName: 'photo1.jpg',
        severityScores: 'Hate:0, SelfHarm:0, Sexual:1, Violence:2',
        metadata: expect.objectContaining({
          size: '1.00',
          fileType: 'jpg'
        })
      }))

      expect(payload.mediaUpload.images[1]).toEqual(expect.objectContaining({
        imageLink: expect.stringContaining(`/sir-media-uploads/${sirid}/photo2.jpg`),
        imageName: 'photo2.jpg',
        severityScores: 'Hate:4, SelfHarm:0, Sexual:0, Violence:0',
        metadata: expect.objectContaining({
          size: '2.00',
          fileType: 'jpg'
        })
      }))
    })
  })
})

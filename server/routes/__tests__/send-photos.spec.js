import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import { getServer } from '../../../.jest/setup.js'
import constants from '../../utils/constants.js'
import imageChecker from '../../services/image-checker.js'
import { getUploadContainerClient, moveBlobToFolder } from '../../services/blob-storage.js'
import { sendMessage } from '../../services/service-bus.js'

jest.mock('../../services/blob-storage.js', () => ({
  getUploadContainerClient: jest.fn(),
  moveBlobToFolder: jest.fn()
}))

jest.mock('../../services/service-bus.js', () => ({
  sendMessage: jest.fn()
}))

const baseUrl = constants.routes.SEND_PHOTOS
const url = `${baseUrl}?sirid=test-session-id`

const generateThumbnails = (count) =>
  Array.from({ length: count }, (_, index) => ({
    finalFilename: `quarantine/test-session-id/photo${index + 1}.jpg`,
    thumbnailBlobPath: `quarantine/test-session-id/photo${index + 1}-thumbnail.jpg`,
    fileSizeBytes: (index + 1) * 1024 * 1024
  }))

const getPayload = () => sendMessage.mock.calls[0][1]

describe(baseUrl, () => {
  beforeEach(() => {
    jest.spyOn(imageChecker, 'validate').mockResolvedValue({ success: true, skipped: true })
    getUploadContainerClient.mockResolvedValue({ url: 'https://storage-account/sir-media-uploads' })
    moveBlobToFolder.mockImplementation(async (_client, sourcePath, destFolder) => {
      const parts = sourcePath.split('/')
      parts[0] = destFolder
      return parts.join('/')
    })
    sendMessage.mockResolvedValue(undefined)
    getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue({ journey: 'test' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it('renders the page content', async () => {
      const response = await submitGetRequest({ url }, 'Send photos', constants.statusCodes.OK)
      expect(response.payload).toContain('Send photos')
    })

    it('redirects to link used when sirid is missing', async () => {
      const response = await submitGetRequest({ url: baseUrl }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-used with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_USED}?sirid=test-session-id`)
    })

    it('should render a send photos submit button', async () => {
      const response = await submitGetRequest({ url }, 'Send photos', constants.statusCodes.OK)
      expect(response.payload).toContain('Send photos')
    })

    it.each([0, 1, 2, 3, 4, 5])('should display %i photos from the session', async (count) => {
      const thumbnails = generateThumbnails(count)
      const response = await submitGetRequest({ url }, 'Send photos', constants.statusCodes.OK, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(response.payload).toContain(`You have added ${count} out of a maximum of 5.`)
    })
  })

  describe('POST', () => {
    it('redirects to link used when sirid is missing', async () => {
      const response = await submitPostRequest({ url: baseUrl }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('passes session thumbnails to image checker', async () => {
      const thumbnails = generateThumbnails(2)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(imageChecker.validate).toHaveBeenCalledWith(thumbnails)
    })

    it('moves each image and thumbnail', async () => {
      const thumbnails = generateThumbnails(2)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenCalledTimes(4)
    })

    it('routes skipped ai validation images to cleared', async () => {
      const thumbnails = generateThumbnails(1)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenNthCalledWith(1, expect.anything(), thumbnails[0].finalFilename, 'cleared')
    })

    it.each([
      ['Hate', 4, 'quarantine/harmful-content'],
      ['Sexual', 4, 'quarantine/harmful-content'],
      ['Violence', 4, 'cleared'],
      ['SelfHarm', 4, 'quarantine/harmful-content'],
      ['Hate', 6, 'quarantine/harmful-content'],
      ['Sexual', 6, 'quarantine/harmful-content'],
      ['Violence', 6, 'cleared'],
      ['SelfHarm', 6, 'quarantine/harmful-content']
    ])('routes %s severity %i to %s', async (category, severity, expectedFolder) => {
      const thumbnails = generateThumbnails(1)
      imageChecker.validate.mockResolvedValue({
        success: true,
        skipped: false,
        response: [{ categoriesAnalysis: [{ category, severity }] }]
      })
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenNthCalledWith(1, expect.anything(), thumbnails[0].finalFilename, expectedFolder)
    })

    it('routes image to harmful content when ai response entry is missing', async () => {
      const thumbnails = generateThumbnails(1)
      imageChecker.validate.mockResolvedValue({ success: true, skipped: false, response: [] })
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenNthCalledWith(1, expect.anything(), thumbnails[0].finalFilename, 'quarantine/harmful-content')
    })

    it('routes thumbnail to harmful content when ai marks image as blocked', async () => {
      const thumbnails = generateThumbnails(1)
      imageChecker.validate.mockResolvedValue({
        success: true,
        skipped: false,
        response: [{ categoriesAnalysis: [{ category: 'Sexual', severity: 6 }] }]
      })
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenNthCalledWith(2, expect.anything(), thumbnails[0].thumbnailBlobPath, 'quarantine/harmful-content')
    })

    it('redirects to success with sirid', async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.SUCCESS}?sirid=test-session-id`)
    })

    it('sets payload sessionId from sirid', async () => {
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(getPayload().mediaUpload.sessionId).toBe('test-session-id')
    })

    it('includes image link in payload', async () => {
      const thumbnails = generateThumbnails(1)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].imageLink).toBe('https://storage-account/sir-media-uploads/cleared/test-session-id/photo1.jpg')
    })

    it('includes thumbnail link in payload', async () => {
      const thumbnails = generateThumbnails(1)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].thumbnailLink).toBe('https://storage-account/sir-media-uploads/cleared/test-session-id/photo1-thumbnail.jpg')
    })

    it('uses none severity score when ai response is absent', async () => {
      const thumbnails = generateThumbnails(1)
      imageChecker.validate.mockResolvedValue({ success: true, skipped: false, response: [] })
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].severityScores).toBe('none')
    })

    it('includes fileType in payload metadata', async () => {
      const thumbnails = generateThumbnails(1)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].metadata.fileType).toBe('jpg')
    })

    it('includes size in payload metadata', async () => {
      const thumbnails = generateThumbnails(1)
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].metadata.size).toBe('1.00')
    })

    it('sets metadata size to null when file size is missing', async () => {
      const thumbnails = [{ finalFilename: 'quarantine/test-session-id/photo1.jpg', thumbnailBlobPath: 'quarantine/test-session-id/photo1-thumbnail.jpg' }]
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].metadata.size).toBe(null)
    })

    it('uses existing thumbnailBlobPath when present', async () => {
      const thumbnails = [{
        finalFilename: 'quarantine/test-session-id/photo1.jpg',
        thumbnailBlobPath: 'quarantine/test-session-id/custom-thumb.jpg',
        fileSizeBytes: 1024
      }]
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(moveBlobToFolder).toHaveBeenNthCalledWith(2, expect.anything(), 'quarantine/test-session-id/custom-thumb.jpg', 'cleared')
    })

    it('derives thumbnail path with -thumbnail suffix', async () => {
      const thumbnails = [{
        finalFilename: 'cleared/test-session-id/photo.jpg',
        fileSizeBytes: 1024
      }]
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].thumbnailLink).toContain('photo-thumbnail.jpg')
    })

    it('sets empty string for fileType when image name has no extension', async () => {
      const thumbnails = [{
        finalFilename: 'cleared/test-session-id/photonoext',
        thumbnailBlobPath: 'cleared/test-session-id/photonoext-thumbnail',
        fileSizeBytes: 1024
      }]
      await submitPostRequest({ url }, constants.statusCodes.REDIRECT, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(getPayload().mediaUpload.images[0].metadata.fileType).toBe('')
    })
  })
})

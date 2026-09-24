import sharp from 'sharp'
import { convertImageSize, prepareImageSize } from '../convert-image-size.js'
import { getUploadContainerClient } from '../blob-storage.js'
import { updateThumbnailBySirId } from '../../utils/upload-session-helpers.js'

jest.mock('../blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

jest.mock('../../utils/upload-session-helpers.js', () => ({
  updateThumbnailBySirId: jest.fn()
}))

const MAX_IMAGE_RESIZE_DEPTH = 5
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024

const createPng = ({ width, height }) => {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().toBuffer()
}

describe('convert-image-size service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns original buffer when already within size and dimensions', async () => {
    const imageBuffer = await createPng({ width: 10, height: 10 })

    const result = await convertImageSize(imageBuffer, '.png')

    expect(result.buffer).toEqual(imageBuffer)
    expect(result.extension).toBe('.png')
  })

  it('throws FILE_TOO_LARGE when max resize depth is reached', async () => {
    const oversizedBuffer = Buffer.alloc(UPLOAD_MAX_BYTES + 1)

    await expect(convertImageSize(
      oversizedBuffer,
      '.png',
      MAX_IMAGE_RESIZE_DEPTH,
      { width: 2000, height: 2000 },
      false
    )).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })

  it('returns when upload container client is unavailable', async () => {
    getUploadContainerClient.mockResolvedValue(null)

    await prepareImageSize({ logger: { error: jest.fn() } }, 'sir-1', [{ finalFilename: 'a.jpg' }])

    expect(updateThumbnailBySirId).not.toHaveBeenCalled()
  })

  it('skips updates when image does not need resize', async () => {
    const imageBuffer = await createPng({ width: 100, height: 100 })
    const downloadToBuffer = jest.fn().mockResolvedValue(imageBuffer)

    getUploadContainerClient.mockResolvedValue({
      getBlobClient: jest.fn().mockReturnValue({ downloadToBuffer })
    })

    await prepareImageSize({ logger: { error: jest.fn() } }, 'sir-1', [{ finalFilename: 'a.jpg' }])

    expect(updateThumbnailBySirId).not.toHaveBeenCalled()
  })

  it('stores aiCheckerImage and success flags when resize succeeds', async () => {
    const overDimensionImage = await createPng({ width: 9000, height: 200 })
    const downloadToBuffer = jest.fn().mockResolvedValue(overDimensionImage)

    getUploadContainerClient.mockResolvedValue({
      getBlobClient: jest.fn().mockReturnValue({ downloadToBuffer })
    })

    await prepareImageSize({ logger: { error: jest.fn() } }, 'sir-1', [{ finalFilename: 'a.jpg' }])

    expect(updateThumbnailBySirId).toHaveBeenCalledWith(
      expect.any(Object),
      'a.jpg',
      expect.objectContaining({
        aiCheckerImage: expect.any(String),
        aiResizeChecked: true,
        aiResizeFailed: false,
        aiResizeFailureReason: null
      }),
      'sir-1'
    )
  })

  it('stores failure flags and logs when preparation fails', async () => {
    const request = { logger: { error: jest.fn() } }
    const downloadToBuffer = jest.fn().mockRejectedValue(new Error('download failed'))

    getUploadContainerClient.mockResolvedValue({
      getBlobClient: jest.fn().mockReturnValue({ downloadToBuffer })
    })

    await prepareImageSize(request, 'sir-1', [{ finalFilename: 'a.jpg' }])

    expect(updateThumbnailBySirId).toHaveBeenCalledWith(
      request,
      'a.jpg',
      {
        aiResizeChecked: true,
        aiResizeFailed: true,
        aiResizeFailureReason: 'download failed'
      },
      'sir-1'
    )
    expect(request.logger.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Background AI image preparation failed for image',
      sirid: 'sir-1',
      finalFilename: 'a.jpg',
      error: 'download failed'
    }))
  })
})

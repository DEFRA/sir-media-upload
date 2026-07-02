import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import { getServer } from '../../../.jest/setup.js'
import constants from '../../utils/constants.js'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import FormData from 'form-data'
import sharp from 'sharp'
import heicConvert from 'heic-convert'
import * as addPhoto from '../media/add-a-photo.js'
import { getUploadContainerClient } from '../../services/blob-storage.js'
import config from '../../utils/config.js'

jest.mock('../../services/blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

jest.mock('heic-convert', () => jest.fn())

const mockValidPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+5e0AAAAASUVORK5CYII=',
  'base64'
)
const PAYLOAD_MAX_BYTES = 25 * 1024 * 1024
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024
const MAX_IMAGE_RESIZE_DEPTH = 5
const MAX_IMAGE_DIMENSION = 7200

const createForm = (filename = '', content = 'data', contentType = 'image/png') => {
  const form = new FormData()
  const fileBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content)
  form.append('fileUpload1', fileBuffer, { filename, contentType })
  return form
}

const createNoiseImageBuffer = async ({ width, height, format = 'png' }) => {
  const pixelCount = width * height * 3
  const raw = crypto.randomBytes(pixelCount)

  const pipeline = sharp(raw, {
    raw: { width, height, channels: 3 }
  })

  if (format === 'jpeg') {
    return pipeline.jpeg({ quality: 90 }).toBuffer()
  }

  return pipeline.png().toBuffer()
}

const baseUrl = constants.routes.ADD_A_PHOTO
const url = `${baseUrl}?sirid=test-session-id`
const header = 'Add a photo'

describe(baseUrl, () => {
  beforeEach(() => {
    getUploadContainerClient.mockResolvedValue({
      getBlockBlobClient: () => ({
        uploadData: () => Promise.resolve(),
        downloadToBuffer: () => Promise.resolve(mockValidPng),
        getTags: () => Promise.resolve({ tags: { 'Malware Scanning scan result': 'No threats found' } }),
        delete: () => Promise.resolve(),
        deleteIfExists: () => Promise.resolve({ succeeded: true })
      })
    })
    getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue({ journey: 'test' })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return correct view', async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.result).toContain(header)
    })

    it('should redirect to link-used when sirid is missing', async () => {
      const response = await submitGetRequest({ url: baseUrl }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-expired with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_EXPIRED}?sirid=test-session-id`)
    })

    it('should render back link to your photos instead of browser history', async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.result).toContain(`href="${constants.routes.YOUR_PHOTOS}?sirid=test-session-id"`)
    })

    it('should set upload-id if not present', async () => {
      const response = await submitGetRequest({ url }, header)
      expect(response.request.yar.get('upload-id')).toBeDefined()
    })

    it('should show max selected files content when 5 files already exist', async () => {
      const thumbnails = Array.from({ length: 5 }, (_, index) => ({
        finalFilename: `upload-id/${index}.png`,
        thumbLoc: `/public/thumbnails/upload-id-${index}.png`,
        fileSizeBytes: 1024
      }))

      const response = await submitGetRequest(
        { url },
        header,
        constants.statusCodes.OK,
        { 'existing-uploads': { 'test-session-id': { thumbnails } } }
      )

      expect(response.result).toContain('You have added the maximum number of photos allowed')
      expect(response.result).toContain(`href="${constants.routes.YOUR_PHOTOS}?sirid=test-session-id"`)
      expect(response.result).not.toContain('Upload a photo')
    })

    // it('should set upload-id if not present', async () => {
    //   const response = await submitGetRequest({ url }, header)
    //   expect(response.request.yar.get('upload-id')).toBeDefined()
    // })

    // it('should keep existing upload-id if already present', async () => {
    //   const existingUploadId = 'existing-upload-id'
    //   const response = await submitGetRequest({ url }, header, 200, { 'upload-id': existingUploadId })
    //   expect(response.request.yar.get('upload-id')).toBe(existingUploadId)
    // })
  })

  describe('POST', () => {
    it('should redirect to link-used when sirid is missing', async () => {
      const form = createForm('valid.png', mockValidPng, 'image/png')
      const response = await submitPostRequest({
        url: baseUrl,
        payload: form.getBuffer(),
        headers: form.getHeaders()
      }, constants.statusCodes.REDIRECT)

      expect(response.headers.location).toBe(constants.routes.LINK_USED)
    })

    it('should redirect to link-expired with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const form = createForm('valid.png', mockValidPng, 'image/png')
      const response = await submitPostRequest({
        url,
        payload: form.getBuffer(),
        headers: form.getHeaders()
      }, constants.statusCodes.REDIRECT)

      expect(response.headers.location).toBe(`${constants.routes.LINK_EXPIRED}?sirid=test-session-id`)
    })

    describe('file type', () => {
      const makeUploadFile = (filename, contentType = 'image/jpeg') => ({
        hapi: {
          filename,
          headers: {
            'content-type': contentType
          }
        }
      })

      const createImageBuffer = (channels = 3, output = 'webp') => {
        const image = sharp({
          create: {
            width: 1,
            height: 1,
            channels,
            background: channels === 4
              ? { r: 0, g: 0, b: 0, alpha: 0.5 }
              : { r: 0, g: 0, b: 0 }
          }
        })

        if (output === 'jpeg') {
          return image.jpeg().toBuffer()
        }

        if (output === 'png') {
          return image.png().toBuffer()
        }

        return image.webp().toBuffer()
      }

      it.each([
        ['jpeg', '.jpg'],
        ['png', '.png']
      ])('returns original extension for %s success', async (format, expectedExtension) => {
        const inputBuffer = await createImageBuffer(3, format)
        const result = await addPhoto.convertImageType(inputBuffer, makeUploadFile(`file.${format}`))
        expect(result.extension).toBe(expectedExtension)
      })

      it.each([
        ['jpeg'],
        ['png']
      ])('returns original buffer for %s success', async (format) => {
        const inputBuffer = await createImageBuffer(3, format)
        const result = await addPhoto.convertImageType(inputBuffer, makeUploadFile(`file.${format}`))
        expect(result.buffer).toEqual(inputBuffer)
      })

      it('has alpha converted to png', async () => {
        const webpWithAlpha = await createImageBuffer(4, 'webp')
        const result = await addPhoto.convertImageType(webpWithAlpha, makeUploadFile('alpha.webp', 'image/webp'))
        expect(result.extension).toBe('.png')
      })

      it('no alpha converted to jpg', async () => {
        const webpNoAlpha = await createImageBuffer(3, 'webp')
        const result = await addPhoto.convertImageType(webpNoAlpha, makeUploadFile('plain.webp', 'image/webp'))
        expect(result.extension).toBe('.jpg')
      })

      it.each([
        ['photo.heic', 'image/heic'],
        ['photo.heif', 'image/heif']
      ])('sharp error and %s upload converts to jpg extension via heic-convert', async (filename, contentType) => {
        heicConvert.mockResolvedValueOnce(Buffer.from('converted-jpg'))
        const result = await addPhoto.convertImageType(
          Buffer.from('not-a-real-image'),
          makeUploadFile(filename, contentType)
        )
        expect(result.extension).toBe('.jpg')
      })

      it.each([
        ['photo.heic', 'image/heic'],
        ['photo.heif', 'image/heif']
      ])('sharp error and %s upload returns converted buffer via heic-convert', async (filename, contentType) => {
        const heicOutput = Buffer.from('converted-jpg')
        heicConvert.mockResolvedValueOnce(heicOutput)
        const result = await addPhoto.convertImageType(
          Buffer.from('not-a-real-image'),
          makeUploadFile(filename, contentType)
        )
        expect(result.buffer).toEqual(heicOutput)
      })

      it.each([
        ['photo.heic', 'image/heic'],
        ['photo.heif', 'image/heif']
      ])('sharp error and %s upload calls heic-convert once', async (filename, contentType) => {
        heicConvert.mockResolvedValueOnce(Buffer.from('converted-jpg'))
        await addPhoto.convertImageType(
          Buffer.from('not-a-real-image'),
          makeUploadFile(filename, contentType)
        )
        expect(heicConvert).toHaveBeenCalledTimes(1)
      })

      it('sharp error and heicError throws INVALID_IMAGE', async () => {
        heicConvert.mockRejectedValueOnce(new Error('heic convert failed'))
        await expect(
          addPhoto.convertImageType(
            Buffer.from('not-a-real-image'),
            makeUploadFile('photo.heic', 'image/heic')
          )
        ).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
      })

      it('sharp error and not heic upload throws error', async () => {
        await expect(
          addPhoto.convertImageType(
            Buffer.from('not-a-real-image'),
            makeUploadFile('photo.txt', 'text/plain')
          )
        ).rejects.toThrow('Invalid or unsupported image format')
      })

      it('throws INVALID_IMAGE code', async () => {
        await expect(
          addPhoto.convertImageType(
            Buffer.from('not-a-real-image'),
            makeUploadFile('photo.txt', 'text/plain')
          )
        ).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
      })

      it('sharp error and missing file metadata still throws INVALID_IMAGE', async () => {
        await expect(
          addPhoto.convertImageType(Buffer.from('not-a-real-image'))
        ).rejects.toMatchObject({ code: 'INVALID_IMAGE' })
      })

      it('sharp error and heic upload converts Uint8Array output to Buffer', async () => {
        heicConvert.mockResolvedValueOnce(new Uint8Array([1, 2, 3]))
        const result = await addPhoto.convertImageType(
          Buffer.from('not-a-real-image'),
          makeUploadFile('photo.heic', 'image/heic')
        )
        expect(Buffer.isBuffer(result.buffer)).toBe(true)
      })

      it('should return invalid image error for unsupported upload through route', async () => {
        const form = createForm('note.txt', 'not-an-image', 'text/plain')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('Select a file in a different image format, for example JPEG or PNG')
      })
    })

    describe('empty file', () => {
      it('should return correct error message if no file provided', async () => {
        const form = new FormData()
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('Select a file')
      })

      it('should return correct error message if file missing original filename', async () => {
        const form = createForm('')
        form.append('fileUpload1', Buffer.from('data'), { filename: '' })
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('Select a file')
      })

      it('should return correct error message if file has filename but empty content', async () => {
        const form = createForm('empty.png', Buffer.alloc(0), 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('Select a file')
      })
    })

    it('should show max selected files content when 5 files already exist', async () => {
      const form = createForm('valid.png', mockValidPng, 'image/png')
      const thumbnails = Array.from({ length: 5 }, (_, index) => ({
        finalFilename: `upload-id/${index}.png`,
        thumbLoc: `${config.appPathPrefix}/public/thumbnails/upload-id-${index}.png`,
        fileSizeBytes: 1024
      }))
      const response = await submitPostRequest({
        url,
        payload: form.getBuffer(),
        headers: form.getHeaders()
      }, 200, { 'existing-uploads': { 'test-session-id': { thumbnails } } })
      expect(response.result).toContain('You have added the maximum number of photos allowed')
    })

    describe('file size', () => {
      it('creates an oversized image for reduction scenario', async () => {
        const oversizedResizableImage = await createNoiseImageBuffer({
          width: 2400,
          height: 2000,
          format: 'png'
        })
        expect(oversizedResizableImage.length).toBeGreaterThan(UPLOAD_MAX_BYTES)
      })

      it('reduces oversized image to jpg format', async () => {
        const oversizedResizableImage = await createNoiseImageBuffer({
          width: 2400,
          height: 2000,
          format: 'png'
        })
        const reducedImageResult = await addPhoto.convertImageSize(oversizedResizableImage, '.png')
        expect(reducedImageResult.extension).toBe('.jpg')
      })

      it('reduces oversized image to within upload limit', async () => {
        const oversizedResizableImage = await createNoiseImageBuffer({
          width: 2400,
          height: 2000,
          format: 'png'
        })
        const reducedImageResult = await addPhoto.convertImageSize(oversizedResizableImage, '.png')
        expect(reducedImageResult.buffer.length).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)
      })

      it('should throw FILE_TOO_LARGE at max processing depth when still oversized', async () => {
        const oversizedBuffer = Buffer.alloc(UPLOAD_MAX_BYTES + 1)
        await expect(addPhoto.convertImageSize(
          oversizedBuffer,
          '.png',
          MAX_IMAGE_RESIZE_DEPTH,
          { width: 2000, height: 2000 },
          false
        )).rejects.toMatchObject({
          code: 'FILE_TOO_LARGE'
        })
      })

      it('processes very tall narrow image within max dimension limit', async () => {
        const narrowOversizedImage = await createNoiseImageBuffer({
          width: 320,
          height: 30000,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(narrowOversizedImage, '.png')
        const metadata = await sharp(resizedResult.buffer).metadata()

        expect(metadata.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION)
      })

      it('processes very tall narrow image within upload limit', async () => {
        const narrowOversizedImage = await createNoiseImageBuffer({
          width: 320,
          height: 30000,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(narrowOversizedImage, '.png')
        expect(resizedResult.buffer.length).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)
      })

      it('scales down image dimensions when width exceeds max dimension', async () => {
        const overDimensionImage = await createNoiseImageBuffer({
          width: 9000,
          height: 200,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(overDimensionImage, '.png')
        const metadata = await sharp(resizedResult.buffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION)
      })

      it('scales down width when exceedsMaxDimension is under upload limit', async () => {
        const overDimensionImage = await sharp({
          create: {
            width: 9000,
            height: 200,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
          }
        }).png().toBuffer()

        expect(overDimensionImage.length).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)

        const resizedResult = await addPhoto.convertImageSize(
          overDimensionImage,
          '.png',
          0,
          { width: 9000, height: 200 },
          true
        )
        const metadata = await sharp(resizedResult.buffer).metadata()

        expect(metadata.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION)
      })

      it('scales down image dimensions when height exceeds max dimension', async () => {
        const overDimensionImage = await createNoiseImageBuffer({
          width: 200,
          height: 9000,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(overDimensionImage, '.png')
        const metadata = await sharp(resizedResult.buffer).metadata()

        expect(metadata.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION)
      })

      it('uses provided metadata without re-reading metadata on initial call', async () => {
        const oversizedResizableImage = await createNoiseImageBuffer({
          width: 2400,
          height: 2000,
          format: 'png'
        })

        const metadataSpy = jest.spyOn(sharp.prototype, 'metadata')

        await addPhoto.convertImageSize(
          oversizedResizableImage,
          '.png',
          0,
          { width: 2400, height: 2000 },
          false
        )

        expect(metadataSpy).not.toHaveBeenCalled()
      })

      it('exhausts quality levels then resizes and recurses for wide oversized image as jpg', async () => {
        const wideOversizedImage = await createNoiseImageBuffer({
          width: 4200,
          height: 4200,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(wideOversizedImage, '.png')
        expect(resizedResult.extension).toBe('.jpg')
      })

      it('exhausts quality levels then resizes and recurses for wide oversized image within upload limit', async () => {
        const wideOversizedImage = await createNoiseImageBuffer({
          width: 4200,
          height: 4200,
          format: 'png'
        })

        const resizedResult = await addPhoto.convertImageSize(wideOversizedImage, '.png')
        expect(resizedResult.buffer.length).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)
      })

      it('throws FILE_TOO_LARGE when fallback image metadata has no width and fallback output is still too large', async () => {
        jest.spyOn(sharp.prototype, 'metadata').mockResolvedValue({})
        jest.spyOn(sharp.prototype, 'toBuffer')
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
        await expect(
          addPhoto.convertImageSize(Buffer.alloc(UPLOAD_MAX_BYTES + 1000), '.png')
        ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
      })

      it('returns jpg when image width is at minimum threshold and fallback output is within upload limit', async () => {
        jest.spyOn(sharp.prototype, 'metadata').mockResolvedValue({ width: 320 })
        jest.spyOn(sharp.prototype, 'toBuffer')
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES - 10))
        const resizedResult = await addPhoto.convertImageSize(Buffer.alloc(UPLOAD_MAX_BYTES + 1000), '.png')
        expect(resizedResult.extension).toBe('.jpg')
      })

      it('should return file too large message when upload processing exceeds 4MB', async () => {
        const oversizedUploadImage = await createNoiseImageBuffer({
          width: 1700,
          height: 1500,
          format: 'png'
        })

        jest.spyOn(sharp.prototype, 'metadata')
          .mockResolvedValueOnce({ format: 'png' })
          .mockResolvedValueOnce({ width: 320 })
        jest.spyOn(sharp.prototype, 'toBuffer')
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
          .mockResolvedValueOnce(Buffer.alloc(UPLOAD_MAX_BYTES + 10))
        const form = createForm('valid.png', oversizedUploadImage, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('The selected file must be smaller than 4MB')
      })

      it('should return payload max-size message when payload exceeds PAYLOAD_MAX_BYTES', async () => {
        const oversizedPayload = Buffer.alloc(PAYLOAD_MAX_BYTES + 1024, 1)
        const form = createForm('oversized.png', oversizedPayload, 'image/png')

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(response.result).toContain('The selected file must be smaller than')
      })
    })

    describe('payload failAction', () => {
      const postRoute = addPhoto.default.find(route => route.method === 'POST' && route.path === baseUrl)
      const failAction = postRoute.options.payload.failAction

      it('should render size error view and return takeover for 413 payload errors', async () => {
        const takeover = jest.fn(() => 'takeover-result')
        const h = {
          view: jest.fn(() => ({ takeover }))
        }

        await failAction(
          { path: url, query: { sirid: 'test-session-id' } },
          h,
          { output: { statusCode: 413 } }
        )

        expect(h.view).toHaveBeenCalledWith(
          constants.views.ADD_A_PHOTO,
          expect.objectContaining({
            maxSelectedFiles: false,
            errorMessage: expect.any(String),
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=test-session-id`
          })
        )
      })

      it('should call takeover on 413 payload error response', async () => {
        const takeover = jest.fn(() => 'takeover-result')
        const h = {
          view: jest.fn(() => ({ takeover }))
        }

        const result = await failAction(
          { path: url, query: { sirid: 'test-session-id' } },
          h,
          { output: { statusCode: 413 } }
        )

        expect(result).toBe('takeover-result')
      })

      it('should throw original error for non-413 payload errors', () => {
        const h = {
          view: jest.fn(() => ({ takeover: jest.fn() }))
        }

        const payloadError = new Error('bad payload')
        payloadError.output = { statusCode: 400 }

        expect(() => failAction({ path: url }, h, payloadError)).toThrow('bad payload')
      })
    })

    describe('upload failure', () => {
      it('should return default error if upload fails', async () => {
        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
          throw new Error('fail')
        })
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)
        expect(response.result).toContain('could not be uploaded')
      })
    })

    describe('successful upload', () => {
      beforeEach(() => {
        jest.spyOn(addPhoto, 'streamToBuffer').mockResolvedValue(mockValidPng)
      })

      it('should create thumbnail directory if missing', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {})

        const form = createForm('valid.png', mockValidPng, 'image/png')
        await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)

        expect(mkdirSpy).toHaveBeenCalled()
      })

      it('should redirect on success', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        expect(response.headers.location).toBe(`${constants.routes.YOUR_PHOTOS}?sirid=test-session-id`)
      })

      it('should store thumbnails in session', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(Array.isArray(thumbnails)).toBe(true)
      })

      it('should add at least one thumbnail to session on successful upload', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(thumbnails.length).toBeGreaterThan(0)
      })

      it('should store thumbLoc in session thumbnail entry', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(thumbnails[0]).toHaveProperty('thumbLoc')
      })

      it('should store finalFilename in session thumbnail entry', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(thumbnails[0]).toHaveProperty('finalFilename')
      })

      it('should store fileSizeBytes in session thumbnail entry', async () => {
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(thumbnails[0]).toHaveProperty('fileSizeBytes')
      })

      it('should store upload fallback name in finalFilename when basename is empty', async () => {
        jest.spyOn(path, 'parse').mockReturnValue({
          root: '',
          dir: '',
          base: 'valid.png',
          ext: '.png',
          name: ''
        })
        const form = createForm('valid.png', mockValidPng, 'image/png')
        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)
        const existingUploads = response.request.yar.get('existing-uploads')
        const thumbnails = existingUploads['test-session-id']?.thumbnails || []
        expect(thumbnails[0].finalFilename).toContain('/upload')
      })

      describe('duplicate filename', () => {
        it('should append -2 to finalFilename when same filename already exists in session', async () => {
          const existingThumbnails = [
            {
              finalFilename: 'quarantine/test-session-id/valid.png',
              thumbLoc: '/public/thumbnails/valid-thumbnail.png',
              thumbnailBlobPath: 'quarantine/test-session-id/valid-thumbnail.png'
            }
          ]
          const form = createForm('valid.png', mockValidPng, 'image/png')
          const response = await submitPostRequest({
            url,
            payload: form.getBuffer(),
            headers: form.getHeaders()
          }, 302, { 'existing-uploads': { 'test-session-id': { thumbnails: existingThumbnails } } })
          const existingUploads = response.request.yar.get('existing-uploads')
          const thumbnails = existingUploads['test-session-id']?.thumbnails || []
          const newEntry = thumbnails[thumbnails.length - 1]
          expect(newEntry.finalFilename).toContain('valid-2.png')
        })

        it('should append -3 to finalFilename when -2 already exists in session', async () => {
          const existingThumbnails = [
            {
              finalFilename: 'quarantine/test-session-id/valid.png',
              thumbLoc: '/public/thumbnails/valid-thumbnail.png',
              thumbnailBlobPath: 'quarantine/test-session-id/valid-thumbnail.png'
            },
            {
              finalFilename: 'quarantine/test-session-id/valid-2.png',
              thumbLoc: '/public/thumbnails/valid-2-thumbnail.png',
              thumbnailBlobPath: 'quarantine/test-session-id/valid-2-thumbnail.png'
            }
          ]
          const form = createForm('valid.png', mockValidPng, 'image/png')
          const response = await submitPostRequest({
            url,
            payload: form.getBuffer(),
            headers: form.getHeaders()
          }, 302, { 'existing-uploads': { 'test-session-id': { thumbnails: existingThumbnails } } })
          const existingUploads = response.request.yar.get('existing-uploads')
          const thumbnails = existingUploads['test-session-id']?.thumbnails || []
          const newEntry = thumbnails[thumbnails.length - 1]
          expect(newEntry.finalFilename).toContain('valid-3.png')
        })

        it('should derive thumbnailBlobPath from the unique name', async () => {
          const existingThumbnails = [
            {
              finalFilename: 'quarantine/test-session-id/valid.png',
              thumbLoc: '/public/thumbnails/valid-thumbnail.png',
              thumbnailBlobPath: 'quarantine/test-session-id/valid-thumbnail.png'
            }
          ]
          const form = createForm('valid.png', mockValidPng, 'image/png')
          const response = await submitPostRequest({
            url,
            payload: form.getBuffer(),
            headers: form.getHeaders()
          }, 302, { 'existing-uploads': { 'test-session-id': { thumbnails: existingThumbnails } } })
          const existingUploads = response.request.yar.get('existing-uploads')
          const thumbnails = existingUploads['test-session-id']?.thumbnails || []
          const newEntry = thumbnails[thumbnails.length - 1]
          expect(newEntry.thumbnailBlobPath).toContain('valid-2-thumbnail.png')
        })

        it('should not modify finalFilename when no duplicate exists', async () => {
          const form = createForm('unique.png', mockValidPng, 'image/png')
          const response = await submitPostRequest({
            url,
            payload: form.getBuffer(),
            headers: form.getHeaders()
          }, 302)
          const existingUploads = response.request.yar.get('existing-uploads')
          const thumbnails = existingUploads['test-session-id']?.thumbnails || []
          expect(thumbnails[0].finalFilename).toContain('/unique.png')
        })
      })
    })

    describe('malware detection', () => {
      beforeEach(() => {
        jest.spyOn(addPhoto, 'streamToBuffer').mockResolvedValue(mockValidPng)
      })

      it('should handle malware detection errors gracefully', async () => {
        const form = createForm('malicious-file.png', mockValidPng)

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => ({
            uploadData: jest.fn(),
            getTags: jest.fn(() => Promise.resolve({ tags: { 'Malware Scanning scan result': 'Malicious' } })),
            deleteIfExists: jest.fn(() => Promise.resolve({ succeeded: true }))
          }))
        })

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(response.result).toContain('The selected file contains a virus')
      })

      it('should delete scan blob when malware is detected', async () => {
        const form = createForm('malicious-file.png', mockValidPng)
        const deleteIfExistsSpy = jest.fn(() => Promise.resolve({ succeeded: true }))

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => ({
            uploadData: jest.fn(),
            getTags: jest.fn(() => Promise.resolve({ tags: { 'Malware Scanning scan result': 'Malicious' } })),
            deleteIfExists: deleteIfExistsSpy
          }))
        })

        await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(deleteIfExistsSpy).toHaveBeenCalled()
      })

      it('should handle threat screening errors gracefully', async () => {
        const form = createForm('threat-file.png', mockValidPng)

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => ({
            uploadData: jest.fn(),
            getTags: jest.fn(() => Promise.resolve({ tags: { 'Malware Scanning scan result': 'Unknown result' } })),
            deleteIfExists: jest.fn(() => Promise.resolve({ succeeded: true }))
          }))
        })

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(response.result).toContain('could not be uploaded')
      })

      it('should delete scan blob when threat screening error occurs', async () => {
        const form = createForm('threat-file.png', mockValidPng)
        const deleteIfExistsSpy = jest.fn(() => Promise.resolve({ succeeded: true }))

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => ({
            uploadData: jest.fn(),
            getTags: jest.fn(() => Promise.resolve({ tags: { 'Malware Scanning scan result': 'Unknown result' } })),
            deleteIfExists: deleteIfExistsSpy
          }))
        })

        await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(deleteIfExistsSpy).toHaveBeenCalled()
      })

      it('should retry malware scan tag polling when initially unavailable', async () => {
        const form = createForm('malicious-file.png', mockValidPng)
        const mockBlobClient = {
          uploadData: jest.fn(),
          getTags: jest.fn()
            .mockRejectedValueOnce(new Error('tag not ready'))
            .mockResolvedValueOnce({ tags: { 'Malware Scanning scan result': 'No threats found' } }),
          deleteIfExists: jest.fn(() => Promise.resolve({ succeeded: true }))
        }

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => mockBlobClient)
        })

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)

        expect(response.headers.location).toContain(constants.routes.YOUR_PHOTOS)
      })

      it('should delete scan blob after successful malware scan', async () => {
        const form = createForm('malicious-file.png', mockValidPng)
        const deleteIfExistsSpy = jest.fn(() => Promise.resolve({ succeeded: true }))
        const mockBlobClient = {
          uploadData: jest.fn(),
          getTags: jest.fn()
            .mockResolvedValueOnce({ tags: { 'Malware Scanning scan result': 'No threats found' } }),
          deleteIfExists: deleteIfExistsSpy
        }

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => mockBlobClient)
        })

        await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)

        expect(deleteIfExistsSpy).toHaveBeenCalled()
      })

      it('should retry polling when tag is not yet present', async () => {
        const form = createForm('malicious-file.png', mockValidPng)
        const mockBlobClient = {
          uploadData: jest.fn(),
          getTags: jest.fn()
            .mockResolvedValueOnce({ tags: {} })
            .mockResolvedValueOnce({ tags: { 'Malware Scanning scan result': 'No threats found' } }),
          deleteIfExists: jest.fn(() => Promise.resolve({ succeeded: true }))
        }

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => mockBlobClient)
        })

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 302)

        expect(response.headers.location).toContain(constants.routes.YOUR_PHOTOS)
      })

      it('should throw error after max polling attempts exhausted', async () => {
        const form = createForm('malicious-file.png', mockValidPng)
        const getTags = jest.fn().mockRejectedValue(new Error('service error'))
        const mockBlobClient = {
          uploadData: jest.fn(),
          getTags,
          deleteIfExists: jest.fn(() => Promise.resolve({ succeeded: true }))
        }

        getUploadContainerClient.mockResolvedValue({
          getBlockBlobClient: jest.fn(() => mockBlobClient)
        })

        const response = await submitPostRequest({
          url,
          payload: form.getBuffer(),
          headers: form.getHeaders()
        }, 200)

        expect(response.result).toContain('could not be uploaded')
      }, 30000)
    })
  })
})

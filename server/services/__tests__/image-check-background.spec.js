import { queueImageCheckInBackground, waitForValidation, removeImageCheckStatusByFilename } from '../image-check-background.js'
import imageChecker from '../image-checker.js'
import { prepareImageForBackgroundCheck } from '../convert-image-size.js'

jest.mock('../image-checker.js', () => ({
  __esModule: true,
  default: {
    validate: jest.fn(),
    shouldBlockImage: jest.fn()
  }
}))

jest.mock('../convert-image-size.js', () => ({
  prepareImageForBackgroundCheck: jest.fn()
}))

const buildServer = (cacheData = {}) => {
  const store = { ...cacheData }
  return {
    app: {
      mediaUploadCache: {
        get: jest.fn(async (key) => store[key] || null),
        set: jest.fn(async (key, value) => { store[key] = value })
      }
    }
  }
}

const sirid = 'test-sirid'
const image = { finalFilename: 'quarantine/test-sirid/photo.jpg' }

describe('image-check-background', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    imageChecker.shouldBlockImage.mockReturnValue(false)
  })

  describe('queueImageCheckInBackground', () => {
    it('does nothing when server is missing', async () => {
      await queueImageCheckInBackground(null, sirid, [image])
      expect(prepareImageForBackgroundCheck).not.toHaveBeenCalled()
    })

    it('does nothing when sirid is missing', async () => {
      const server = buildServer()
      await queueImageCheckInBackground(server, null, [image])
      expect(prepareImageForBackgroundCheck).not.toHaveBeenCalled()
    })

    it('does nothing when images is empty', async () => {
      const server = buildServer()
      await queueImageCheckInBackground(server, sirid, [])
      expect(prepareImageForBackgroundCheck).not.toHaveBeenCalled()
    })

    it('does nothing when image has no finalFilename', async () => {
      const server = buildServer()
      await queueImageCheckInBackground(server, sirid, [{}])
      expect(prepareImageForBackgroundCheck).not.toHaveBeenCalled()
    })

    it('runs background check and stores complete status', async () => {
      const server = buildServer()
      const validationResult = { severityScores: 'Hate:0', shouldBlock: false }

      prepareImageForBackgroundCheck.mockResolvedValue(image)
      imageChecker.validate.mockResolvedValue({ response: [validationResult] })

      await queueImageCheckInBackground(server, sirid, [image])

      // allow microtasks to settle
      await new Promise(resolve => setImmediate(resolve))

      const cached = await server.app.mediaUploadCache.get(sirid)
      expect(cached.imageCheckByFilename[image.finalFilename].status).toBe('complete')
      expect(cached.imageCheckByFilename[image.finalFilename].validationResult).toEqual(validationResult)
    })

    it('stores AIFail result when validation throws', async () => {
      const server = buildServer()
      const logger = { error: jest.fn() }

      prepareImageForBackgroundCheck.mockResolvedValue(image)
      imageChecker.validate.mockRejectedValue(new Error('API down'))

      await queueImageCheckInBackground(server, sirid, [image], logger)
      await new Promise(resolve => setImmediate(resolve))

      const cached = await server.app.mediaUploadCache.get(sirid)
      expect(cached.imageCheckByFilename[image.finalFilename].status).toBe('complete')
      expect(cached.imageCheckByFilename[image.finalFilename].validationResult.severityScores).toBe('AIFail:8')
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Background image check failed',
        error: 'API down'
      }))
    })

    it('uses AIFail when validate returns no response entry', async () => {
      const server = buildServer()

      prepareImageForBackgroundCheck.mockResolvedValue(image)
      imageChecker.validate.mockResolvedValue({ response: [] })

      await queueImageCheckInBackground(server, sirid, [image])
      await new Promise(resolve => setImmediate(resolve))

      const cached = await server.app.mediaUploadCache.get(sirid)
      expect(cached.imageCheckByFilename[image.finalFilename].validationResult.severityScores).toBe('AIFail:8')
    })

    it('skips duplicate job for same sirid and filename', async () => {
      const server = buildServer()
      const uniqueImage = { finalFilename: `quarantine/unique-dedup-${Date.now()}.jpg` }
      const resolvers = []
      prepareImageForBackgroundCheck.mockImplementation(() => new Promise(resolve => { resolvers.push(resolve) }))

      await queueImageCheckInBackground(server, sirid, [uniqueImage])
      await new Promise(resolve => setImmediate(resolve)) // let runImageCheck reach prepareImageForBackgroundCheck
      const callsAfterFirst = prepareImageForBackgroundCheck.mock.calls.length

      await queueImageCheckInBackground(server, sirid, [uniqueImage])
      const callsAfterSecond = prepareImageForBackgroundCheck.mock.calls.length

      expect(callsAfterFirst).toBe(1)
      expect(callsAfterSecond).toBe(1) // second call did not queue a new job

      resolvers[0]?.({ finalFilename: uniqueImage.finalFilename }) // unblock so job cleans up
    })
  })

  describe('getSendPhotosValidation via waitForValidation', () => {
    it('returns ready with validation result when all images are complete', async () => {
      const validationResult = { severityScores: 'Violence:0', shouldBlock: false }
      const server = buildServer({
        [sirid]: {
          imageCheckByFilename: {
            [image.finalFilename]: { status: 'complete', validationResult }
          }
        }
      })

      const result = await waitForValidation(server, sirid, [image], { intervalMs: 0, maxAttempts: 1 })

      expect(result.ready).toBe(true)
      expect(result.validationResult.response[0]).toEqual(validationResult)
    })

    it('returns not ready when image is still pending', async () => {
      const server = buildServer({
        [sirid]: {
          imageCheckByFilename: {
            [image.finalFilename]: { status: 'pending', validationResult: null }
          }
        }
      })

      const result = await waitForValidation(server, sirid, [image], { intervalMs: 0, maxAttempts: 1 })

      expect(result.ready).toBe(false)
    })

    it('returns not ready when no cache entry exists for image', async () => {
      const server = buildServer({ [sirid]: { imageCheckByFilename: {} } })

      const result = await waitForValidation(server, sirid, [image], { intervalMs: 0, maxAttempts: 1 })

      expect(result.ready).toBe(false)
    })

    it('returns ready once image transitions from pending to complete', async () => {
      const validationResult = { severityScores: 'Hate:0', shouldBlock: false }
      const store = {
        [sirid]: {
          imageCheckByFilename: {
            [image.finalFilename]: { status: 'pending', validationResult: null }
          }
        }
      }
      const callCounts = { get: 0 }

      const server = {
        app: {
          mediaUploadCache: {
            get: jest.fn(async (key) => {
              callCounts.get++
              if (callCounts.get >= 2) {
                store[key].imageCheckByFilename[image.finalFilename] = { status: 'complete', validationResult }
              }
              return store[key] || null
            }),
            set: jest.fn(async (key, value) => { store[key] = value })
          }
        }
      }

      const result = await waitForValidation(server, sirid, [image], { intervalMs: 0, maxAttempts: 5 })

      expect(result.ready).toBe(true)
    })

    it('returns AIFail fallback when complete but validationResult is null', async () => {
      const server = buildServer({
        [sirid]: {
          imageCheckByFilename: {
            [image.finalFilename]: { status: 'complete', validationResult: null }
          }
        }
      })

      const result = await waitForValidation(server, sirid, [image], { intervalMs: 0, maxAttempts: 1 })

      expect(result.ready).toBe(true)
      expect(result.validationResult.response[0].severityScores).toBe('AIFail:8')
    })

    it('returns ready with empty response when images array is empty', async () => {
      const server = buildServer()

      const result = await waitForValidation(server, sirid, [], { intervalMs: 0, maxAttempts: 1 })

      expect(result.ready).toBe(true)
      expect(result.validationResult.response).toEqual([])
    })

    it('returns not ready when server has no cache', async () => {
      const result = await waitForValidation({}, sirid, [image], { intervalMs: 0, maxAttempts: 1 })
      expect(result.ready).toBe(false)
    })
  })

  describe('removeImageCheckStatusByFilename', () => {
    it('removes the entry for the given filename', async () => {
      const server = buildServer({
        [sirid]: {
          imageCheckByFilename: {
            [image.finalFilename]: { status: 'complete', validationResult: {} }
          }
        }
      })

      await removeImageCheckStatusByFilename(server, sirid, image.finalFilename)

      const cached = await server.app.mediaUploadCache.get(sirid)
      expect(cached.imageCheckByFilename[image.finalFilename]).toBeUndefined()
    })

    it('does nothing when finalFilename is missing', async () => {
      const server = buildServer({ [sirid]: { imageCheckByFilename: {} } })
      await removeImageCheckStatusByFilename(server, sirid, null)
      expect(server.app.mediaUploadCache.set).not.toHaveBeenCalled()
    })

    it('does nothing when entry does not exist in cache', async () => {
      const server = buildServer({ [sirid]: { imageCheckByFilename: {} } })
      await removeImageCheckStatusByFilename(server, sirid, 'nonexistent.jpg')
      expect(server.app.mediaUploadCache.set).not.toHaveBeenCalled()
    })
  })
})

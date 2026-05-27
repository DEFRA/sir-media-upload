import {
  addSirIdToSession,
  removeSirIdFromSession,
  addSirIdToQueryString,
  hasValidSirId,
  getSessionDetailsBySirId,
  getThumbnailsBySirId,
  addThumbnailBySirId,
  removeThumbnailBySirIdAtIndex,
  clearSessionDetailsBySirId,
  getSirIdFromRequest,
  getExistingUploads,
  setExistingUploads
} from '../upload-session-helpers.js'

describe('upload-session-helpers', () => {
  let mockRequest

  beforeEach(() => {
    mockRequest = {
      query: { sirid: 'test-session-id' },
      yar: {
        data: {},
        get: jest.fn(function (key) {
          return this.data[key]
        }),
        set: jest.fn(function (key, value) {
          this.data[key] = value
        })
      },
      server: {
        app: {
          mediaUploadCache: {
            get: jest.fn().mockResolvedValue({ journey: 'test' })
          },
          mediaUploadLockCache: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            drop: jest.fn().mockResolvedValue(undefined)
          }
        }
      }
    }
  })

  describe('getSirIdFromRequest', () => {
    it('should return sirid from query', () => {
      const result = getSirIdFromRequest(mockRequest)
      expect(result).toBe('test-session-id')
    })

    it('should return null when no sirid in query', () => {
      mockRequest.query.sirid = undefined
      const result = getSirIdFromRequest(mockRequest)
      expect(result).toBeNull()
    })
  })

  describe('getExistingUploads', () => {
    it('should return existing-uploads from session', () => {
      const uploads = { 'sir-1': { thumbnails: [] } }
      mockRequest.yar.set('existing-uploads', uploads)
      const result = getExistingUploads(mockRequest)
      expect(result).toEqual(uploads)
    })

    it('should return empty object when no existing-uploads', () => {
      const result = getExistingUploads(mockRequest)
      expect(result).toEqual({})
    })
  })

  describe('setExistingUploads', () => {
    it('should set existing-uploads in session', () => {
      const uploads = { 'sir-1': { thumbnails: [] } }
      setExistingUploads(mockRequest, uploads)
      expect(mockRequest.yar.set).toHaveBeenCalledWith('existing-uploads', uploads)
    })
  })

  describe('addSirIdToSession', () => {
    it('should initialize sirid entry with empty thumbnails array', () => {
      const sirid = addSirIdToSession(mockRequest)
      expect(sirid).toBe('test-session-id')
      const uploads = getExistingUploads(mockRequest)
      expect(uploads['test-session-id']).toEqual({ thumbnails: [] })
    })

    it('should not reinitialize existing sirid entry', () => {
      const thumbnails = [{ finalFilename: 'test.jpg' }]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      addSirIdToSession(mockRequest)
      const uploads = getExistingUploads(mockRequest)
      expect(uploads['test-session-id'].thumbnails).toEqual(thumbnails)
    })

    it('should return sirid from query', () => {
      const sirid = addSirIdToSession(mockRequest)
      expect(sirid).toBe('test-session-id')
    })
  })

  describe('getSessionDetailsBySirId', () => {
    it('should return session details for sirid', () => {
      const thumbnails = [{ finalFilename: 'test.jpg' }]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const details = getSessionDetailsBySirId(mockRequest)
      expect(details).toEqual({ thumbnails })
    })

    it('should return default shape when sirid missing', () => {
      const details = getSessionDetailsBySirId(mockRequest)
      expect(details).toEqual({ thumbnails: [] })
    })

    it('should return default shape when no sirid param', () => {
      const details = getSessionDetailsBySirId(mockRequest, null)
      expect(details).toEqual({ thumbnails: [] })
    })
  })

  describe('getThumbnailsBySirId', () => {
    it('should return thumbnails array for sirid', () => {
      const thumbnails = [
        { finalFilename: 'test1.jpg' },
        { finalFilename: 'test2.jpg' }
      ]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const result = getThumbnailsBySirId(mockRequest)
      expect(result).toEqual(thumbnails)
    })

    it('should return empty array when sirid missing', () => {
      const result = getThumbnailsBySirId(mockRequest)
      expect(result).toEqual([])
    })

    it('should return empty array when no sirid param', () => {
      const result = getThumbnailsBySirId(mockRequest, null)
      expect(result).toEqual([])
    })
  })

  describe('addThumbnailBySirId', () => {
    it('should append thumbnail to sirid thumbnails array', () => {
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails: [] }
      })
      const thumbnail = { finalFilename: 'new.jpg', thumbLoc: '/thumb.jpg', fileSizeBytes: 1024 }
      const result = addThumbnailBySirId(mockRequest, thumbnail)
      expect(result).toContainEqual(thumbnail)
    })

    it('should create sirid entry if missing', () => {
      const thumbnail = { finalFilename: 'new.jpg', thumbLoc: '/thumb.jpg', fileSizeBytes: 1024 }
      addThumbnailBySirId(mockRequest, thumbnail)
      const uploads = getExistingUploads(mockRequest)
      expect(uploads['test-session-id'].thumbnails).toContainEqual(thumbnail)
    })

    it('should return updated thumbnails array', () => {
      const thumbnail = { finalFilename: 'new.jpg', thumbLoc: '/thumb.jpg', fileSizeBytes: 1024 }
      const result = addThumbnailBySirId(mockRequest, thumbnail)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toEqual(thumbnail)
    })

    it('should return empty array when no sirid param', () => {
      const thumbnail = { finalFilename: 'new.jpg' }
      const result = addThumbnailBySirId(mockRequest, thumbnail, null)
      expect(result).toEqual([])
    })
  })

  describe('removeThumbnailBySirIdAtIndex', () => {
    it('should remove thumbnail at valid index', () => {
      const thumbnails = [
        { finalFilename: 'photo1.jpg' },
        { finalFilename: 'photo2.jpg' }
      ]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const { removed, thumbnails: updated } = removeThumbnailBySirIdAtIndex(mockRequest, 0)
      expect(removed).toEqual({ finalFilename: 'photo1.jpg' })
      expect(updated.length).toBe(1)
      expect(updated[0]).toEqual({ finalFilename: 'photo2.jpg' })
    })

    it('should not remove thumbnail at invalid index', () => {
      const thumbnails = [{ finalFilename: 'photo1.jpg' }]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const { removed, thumbnails: updated } = removeThumbnailBySirIdAtIndex(mockRequest, 999)
      expect(removed).toBeNull()
      expect(updated.length).toBe(1)
    })

    it('should not remove thumbnail at negative index', () => {
      const thumbnails = [{ finalFilename: 'photo1.jpg' }]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const { removed } = removeThumbnailBySirIdAtIndex(mockRequest, -1)
      expect(removed).toBeNull()
    })

    it('should not remove thumbnail for non-numeric index', () => {
      const thumbnails = [{ finalFilename: 'photo1.jpg' }]
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails }
      })
      const { removed } = removeThumbnailBySirIdAtIndex(mockRequest, 'invalid')
      expect(removed).toBeNull()
    })

    it('should return empty array when sirid missing', () => {
      const { removed, thumbnails } = removeThumbnailBySirIdAtIndex(mockRequest, 0)
      expect(removed).toBeNull()
      expect(thumbnails).toEqual([])
    })

    it('should return empty array when no sirid param', () => {
      const { removed, thumbnails } = removeThumbnailBySirIdAtIndex(mockRequest, 0, null)
      expect(removed).toBeNull()
      expect(thumbnails).toEqual([])
    })
  })

  describe('clearSessionDetailsBySirId', () => {
    it('should delete sirid entry from existing-uploads', () => {
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails: [] },
        'other-session-id': { thumbnails: [] }
      })
      clearSessionDetailsBySirId(mockRequest)
      const uploads = getExistingUploads(mockRequest)
      expect(uploads['test-session-id']).toBeUndefined()
      expect(uploads['other-session-id']).toBeDefined()
    })

    it('should return sirid', () => {
      const result = clearSessionDetailsBySirId(mockRequest)
      expect(result).toBe('test-session-id')
    })

    it('should return null when no sirid param', () => {
      const result = clearSessionDetailsBySirId(mockRequest, null)
      expect(result).toBeNull()
    })
  })

  describe('removeSirIdFromSession', () => {
    it('should delete sirid from session', () => {
      mockRequest.yar.set('existing-uploads', {
        'test-session-id': { thumbnails: [] }
      })
      removeSirIdFromSession(mockRequest)
      const uploads = getExistingUploads(mockRequest)
      expect(uploads['test-session-id']).toBeUndefined()
    })

    it('should return sirid', () => {
      const result = removeSirIdFromSession(mockRequest)
      expect(result).toBe('test-session-id')
    })
  })

  describe('addSirIdToQueryString', () => {
    it('should append sirid to query string', () => {
      const result = addSirIdToQueryString(mockRequest, '/test-route')
      expect(result).toBe('/test-route?sirid=test-session-id')
    })

    it('should return url without sirid when missing', () => {
      mockRequest.query.sirid = undefined
      const result = addSirIdToQueryString(mockRequest, '/test-route')
      expect(result).toBe('/test-route')
    })
  })

  describe('hasValidSirId', () => {
    it('should return true when sirid is valid', async () => {
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(true)
    })

    it('should return false when no sirid in query', async () => {
      mockRequest.query.sirid = undefined
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(false)
    })

    it('should return false when sirid not in cache', async () => {
      mockRequest.server.app.mediaUploadCache.get.mockResolvedValue(null)
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(false)
    })

    it('should call cache.get with sirid', async () => {
      await hasValidSirId(mockRequest)
      expect(mockRequest.server.app.mediaUploadCache.get).toHaveBeenCalledWith('test-session-id')
    })

    it('should acquire a lock for the current session when no lock exists', async () => {
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(true)
      expect(mockRequest.server.app.mediaUploadLockCache.set).toHaveBeenCalledWith(
        'test-session-id',
        expect.objectContaining({ userId: expect.any(String) })
      )
    })

    it('should return false when lock belongs to a different session', async () => {
      mockRequest.server.app.mediaUploadLockCache.get.mockResolvedValue({ userId: 'different-session' })
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(false)
      expect(mockRequest.server.app.mediaUploadLockCache.set).not.toHaveBeenCalled()
    })

    it('should allow access when lock belongs to the same session', async () => {
      mockRequest.yar.set('journey-lock-session-id', 'same-session')
      mockRequest.server.app.mediaUploadLockCache.get.mockResolvedValue({ userId: 'same-session' })
      const result = await hasValidSirId(mockRequest)
      expect(result).toBe(true)
      expect(mockRequest.server.app.mediaUploadLockCache.set).toHaveBeenCalledWith(
        'test-session-id',
        expect.objectContaining({ userId: 'same-session' })
      )
    })
  })

  describe('multi-sirid isolation', () => {
    it('should not alter other sirid when removing from one', () => {
      const sirA = 'sir-a'
      const sirB = 'sir-b'
      mockRequest.query.sirid = sirA

      const uploads = {}
      uploads[sirA] = { thumbnails: [{ finalFilename: 'a.jpg' }] }
      uploads[sirB] = { thumbnails: [{ finalFilename: 'b.jpg' }] }
      mockRequest.yar.set('existing-uploads', uploads)

      removeThumbnailBySirIdAtIndex(mockRequest, 0)

      const result = getExistingUploads(mockRequest)
      expect(result[sirA].thumbnails).toHaveLength(0)
      expect(result[sirB].thumbnails).toHaveLength(1)
      expect(result[sirB].thumbnails[0].finalFilename).toBe('b.jpg')
    })

    it('should not alter other sirid when adding to one', () => {
      const sirA = 'sir-a'
      const sirB = 'sir-b'
      mockRequest.query.sirid = sirA

      const uploads = {}
      uploads[sirA] = { thumbnails: [] }
      uploads[sirB] = { thumbnails: [{ finalFilename: 'b.jpg' }] }
      mockRequest.yar.set('existing-uploads', uploads)

      addThumbnailBySirId(mockRequest, { finalFilename: 'a.jpg' })

      const result = getExistingUploads(mockRequest)
      expect(result[sirA].thumbnails).toHaveLength(1)
      expect(result[sirB].thumbnails).toHaveLength(1)
      expect(result[sirB].thumbnails[0].finalFilename).toBe('b.jpg')
    })
  })
})

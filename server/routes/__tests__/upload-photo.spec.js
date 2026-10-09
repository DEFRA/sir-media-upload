import { getServer } from '../../../.jest/setup.js'
import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import { returnFormattedDate } from '../../utils/date-helpers.js'

const url = `${constants.routes.UPLOAD_PHOTO}?sirid=test-session-id`
const header = 'Upload photos'
const journeyCases = [
  'water pollution',
  'smell',
  'dust',
  'mud',
  'vermin',
  'noise',
  'blockage',
  'illegal fishing',
  'litter'
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

    it('should redirect to link-expired with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_EXPIRED}?sirid=test-session-id`)
    })

    it('should redirect to link-used when sirid is submitted and no longer in cache', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitGetRequest({ url }, null, constants.statusCodes.REDIRECT, {
        'submitted-sirid': 'test-session-id'
      })
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

    it.each([
      ['smell', constants.urls.GOV_UK_SMELL],
      ['dust', constants.urls.GOV_UK_DUST],
      ['mud', constants.urls.GOV_UK_MUD],
      ['vermin', constants.urls.GOV_UK_PESTS],
      ['noise', constants.urls.GOV_UK_NOISE],
      ['blockage', constants.urls.GOV_UK_BLOCKAGE],
      ['water pollution', constants.urls.GOV_UK_WATER_POLLUTION],
      ['illegal fishing', constants.urls.GOV_UK_ILLEGAL_FISHING],
      ['litter', constants.urls.GOV_UK_LITTER]
    ])('should link the service name to the start page for journey: %s', async (journey, journeyUrl) => {
      jest.spyOn(getServer().app.mediaUploadCache, 'get').mockResolvedValue({ journey, dateTime: new Date() })
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)

      expect(response.payload).toContain(`href="${journeyUrl}"`)
    })

    it.each([
      ['water pollution', 'Report water pollution in England'],
      ['smell', 'Report a smell from a waste facility, industrial site or farm in England'],
      ['litter', 'Report litter from a waste facility, industrial site or farm in England'],
      ['illegal fishing', 'Report illegal fishing in England'],
      ['blockage', 'Report a blockage in a river in England'],
      ['noise', 'Report noise from a waste facility, industrial site or farm in England'],
      ['vermin', 'Report vermin or pest problem from a waste facility, industrial site or farm in England'],
      ['dust', 'Report dust from a waste facility, industrial site or farm in England'],
      ['mud', 'Report mud from a waste facility, industrial site or farm in England']
    ])('should render the service name in the navigation for journey: %s', async (journey, serviceName) => {
      jest.spyOn(getServer().app.mediaUploadCache, 'get').mockResolvedValue({ journey, dateTime: new Date() })
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)

      expect(response.payload).toContain(serviceName)
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

    it('should render the 500 page when the cache is unavailable', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockRejectedValue(new Error('cache down'))
      const response = await submitGetRequest(
        { url },
        'Sorry, there is a problem with the service',
        constants.statusCodes.PROBLEM_WITH_SERVICE
      )
      expect(response.payload).toContain('Try again later.')
      expect(response.payload).toContain('Your photo has not been uploaded. When the service is available, you will need to upload it again.')
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

    it('should redirect to link-expired with sirid when sirid is present but invalid', async () => {
      getServer().app.mediaUploadCache.get = jest.fn().mockResolvedValue(null)
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.LINK_EXPIRED}?sirid=test-session-id`)
    })

    it(`Should redirect to ${constants.routes.ADD_A_PHOTO} for ${constants.routes.UPLOAD_PHOTO}`, async () => {
      const response = await submitPostRequest({ url }, constants.statusCodes.REDIRECT)
      expect(response.headers.location).toBe(`${constants.routes.ADD_A_PHOTO}?sirid=test-session-id`)
    })
  })
})

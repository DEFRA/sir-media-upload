import { submitGetRequest, submitPostRequest } from '../../__test-helpers__/server.js'
import constants from '../../utils/constants.js'
import { returnFormattedDate } from '../../utils/date-helper.js'

const url = constants.routes.UPLOAD_PHOTO
const header = 'Upload photos'
const journeyCases = [
  'water pollution',
  'smell',
  'blockage',
  'illegal fishing'
]

describe(url, () => {
  describe('GET', () => {
    it(`Should return success response and correct view for ${url}`, async () => {
      const response = await submitGetRequest({ url }, header, constants.statusCodes.OK)
      expect(response.payload).toContain('Upload photos')
    })

    it('should return OK when journey and dateTime are in session', async () => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      const response = await submitGetRequest(
        { url },
        header,
        constants.statusCodes.OK,
        { journey: 'smell', dateTime }
      )

      expect(response.statusCode).toBe(constants.statusCodes.OK)
    })

    it.each(journeyCases)('should render journey type from session: %s', async (journey) => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      const response = await submitGetRequest(
        { url },
        header,
        constants.statusCodes.OK,
        { journey, dateTime }
      )

      expect(response.payload).toContain(journey)
    })

    it('should render dateTime from session', async () => {
      const dateTime = new Date(2026, 3, 1, 12, 30)
      const response = await submitGetRequest(
        { url },
        header,
        constants.statusCodes.OK,
        { journey: 'smell', dateTime }
      )

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

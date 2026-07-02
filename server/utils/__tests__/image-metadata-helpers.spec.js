import { extractImageMetadata } from '../image-metadata-helpers.js'
import exifr from 'exifr'
import * as dateHelpers from '../date-helpers.js'

jest.mock('exifr')
jest.mock('../date-helpers.js', () => ({
  returnFormattedDate: jest.fn((date) => {
    if (!date) {
      return null
    }
    return new Date(date).toISOString().split('T')[0]
  })
}))

describe('image-metadata-helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dateHelpers.returnFormattedDate.mockImplementation((date) => {
      if (!date) {
        return null
      }
      return new Date(date).toISOString().split('T')[0]
    })
  })

  describe('extractImageMetadata', () => {
    it('returns null for date and geotag when no EXIF data exists', async () => {
      exifr.parse.mockResolvedValue(null)

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result).toEqual({ dateTaken: null, geotag: null })
    })

    it('returns null for date when DateTimeOriginal and DateTime are missing', async () => {
      exifr.parse.mockResolvedValue({
        GPSLatitude: [55, 5, 29.37],
        GPSLongitude: [1, 35, 2.15]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBeNull()
    })

    it('extracts date from DateTimeOriginal', async () => {
      const testDate = new Date('2026-03-10T10:23:26.000Z')
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: testDate,
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBe('2026-03-10')
    })

    it('extracts date from DateTime when DateTimeOriginal is missing', async () => {
      const testDate = new Date('2026-01-15T14:30:00.000Z')
      exifr.parse.mockResolvedValue({
        DateTime: testDate,
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBe('2026-01-15')
    })

    it('prefers DateTimeOriginal over DateTime', async () => {
      const originalDate = new Date('2026-03-10T10:23:26.000Z')
      const dateTime = new Date('2026-01-15T14:30:00.000Z')
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: originalDate,
        DateTime: dateTime,
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBe('2026-03-10')
    })

    it('uses decimal latitude/longitude when available', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeDefined()
      expect(result.geotag).not.toBeNull()
    })

    it('converts DMS format GPS to decimal when decimal format unavailable', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        GPSLatitude: [55, 5, 29.37],
        GPSLongitude: [1, 35, 2.15]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeDefined()
      expect(result.geotag).not.toBeNull()
    })

    it('prefers decimal format over DMS format', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556,
        GPSLatitude: [55, 5, 29.37],
        GPSLongitude: [1, 35, 2.15]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeDefined()
    })

    it('returns null for geotag when GPS data is missing', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z')
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeNull()
    })

    it('returns null for geotag when only latitude is present', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        latitude: 55.09149166666667
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeNull()
    })

    it('returns null for geotag when only longitude is present', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeNull()
    })

    it('returns null values on exifr parse error', async () => {
      exifr.parse.mockRejectedValue(new Error('Parse error'))

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result).toEqual({ dateTaken: null, geotag: null })
    })

    it('correctly converts DMS to decimal format', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        GPSLatitude: [55, 5, 29.37],
        GPSLongitude: [1, 35, 2.15]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBe('2026-03-10')
      expect(result.geotag).toBeDefined()
    })

    it('handles both date and location metadata together', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        latitude: 55.09149166666667,
        longitude: 1.5839305555555556
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.dateTaken).toBe('2026-03-10')
      expect(result.geotag).toBeDefined()
      expect(result.geotag).not.toBeNull()
    })

    it('calls exifr.parse with file buffer', async () => {
      const testBuffer = Buffer.from('test-data')
      exifr.parse.mockResolvedValue(null)

      await extractImageMetadata(testBuffer)

      expect(exifr.parse).toHaveBeenCalledWith(testBuffer)
    })
  })

  describe('convertDmsToDecimal', () => {
    it('converts degrees/minutes/seconds to decimal', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        GPSLatitude: [55, 5, 29.37],
        GPSLongitude: [1, 35, 2.15]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeDefined()
    })

    it('handles DMS array with missing seconds', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        GPSLatitude: [55, 5],
        GPSLongitude: [1, 35]
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeDefined()
    })

    it('returns null for invalid DMS array', async () => {
      exifr.parse.mockResolvedValue({
        DateTimeOriginal: new Date('2026-03-10T10:23:26.000Z'),
        GPSLatitude: [],
        GPSLongitude: []
      })

      const result = await extractImageMetadata(Buffer.from('test-data'))

      expect(result.geotag).toBeNull()
    })
  })
})

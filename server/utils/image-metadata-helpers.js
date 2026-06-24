import exifr from 'exifr'
import { LatLon } from 'geodesy/osgridref.js'
import { returnFormattedDate } from './date-helpers.js'

const toNgrFromLatLon = (latitude, longitude) => {
  const latLon = new LatLon(latitude, longitude) // WGS84
  const osGrid = latLon.toOsGrid()
  return osGrid.toString()
}

const convertDmsToDecimal = (dmsArray) => {
  if (!Array.isArray(dmsArray) || dmsArray.length < 2) return undefined
  const degrees = dmsArray[0]
  const minutes = dmsArray[1]
  const seconds = dmsArray[2] || 0
  return degrees + minutes / 60 + seconds / 3600
}

const extractImageMetadata = async (fileBuffer) => {
  try {
    const exif = await exifr.parse(fileBuffer)

    if (!exif) {
      return { dateTaken: null, geotag: null }
    }

    const rawDate = exif.DateTimeOriginal || exif.DateTime || null
    const dateTaken = rawDate ? returnFormattedDate(rawDate) : null

    const latitude = exif.latitude || (exif.GPSLatitude ? convertDmsToDecimal(exif.GPSLatitude) : undefined)
    const longitude = exif.longitude || (exif.GPSLongitude ? convertDmsToDecimal(exif.GPSLongitude) : undefined)

    const hasGps = latitude !== undefined && longitude !== undefined
    const geotag = hasGps ? toNgrFromLatLon(latitude, longitude) : null

    return { dateTaken, geotag }
  } catch (error) {
    console.log('[Metadata] Error parsing EXIF:', error.message)
    return { dateTaken: null, geotag: null }
  }
}

export { extractImageMetadata }

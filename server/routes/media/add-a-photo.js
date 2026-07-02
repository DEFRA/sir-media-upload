import constants from '../../utils/constants.js'
import sharp from 'sharp'
import heicConvert from 'heic-convert'
import fs from 'node:fs'
import path from 'node:path'
import dirname from '../../../dirname.cjs'
import { getUploadContainerClient } from '../../services/blob-storage.js'
import { fileMalwareCheck } from '../../services/file-malware-checker.js'
import { addSirIdToQueryString, hasValidSirId, getThumbnailsBySirId, addThumbnailBySirId } from '../../utils/upload-session-helpers.js'

const MAX_IMAGE_RESIZE_DEPTH = 5
const MAX_SELECTED_FILES = 5
const MIN_RESIZE_WIDTH = 320
const MAX_IMAGE_DIMENSION = 7200
const QUALITY_LEVELS = [80, 70, 60, 50, 40, 30]
const RESIZE_WIDTH_RATIO = 0.8
const PAYLOAD_MAX_BYTES = 25 * 1024 * 1024 // 25MB
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024 // 4MB

export function streamToBuffer (stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

const TAG_NAME = 'Malware Scanning scan result'

export async function pollForScanTag (containerClient, filePath, attempts = 0) {
  const blobClient = containerClient.getBlockBlobClient(filePath)
  try {
    const { tags } = await blobClient.getTags()
    if (tags[TAG_NAME] || attempts >= 9) return tags
  } catch (err) {
    if (attempts >= 9) throw err
  }
  await new Promise(resolve => setTimeout(resolve, 2000))
  return pollForScanTag(containerClient, filePath, attempts + 1)
}

export async function convertImageType (fileBuffer, file) {
  // AI content checker allows: JPEG, PNG, GIF, BMP, TIFF, or WEBP
  try {
    const metadata = await sharp(fileBuffer).metadata()

    if (metadata.format === 'jpeg') {
      return { buffer: fileBuffer, extension: '.jpg' }
    }

    if (metadata.format === 'png') {
      return { buffer: fileBuffer, extension: '.png' }
    }

    if (metadata.hasAlpha) {
      const alphaConvertedBuffer = await sharp(fileBuffer).png().toBuffer()
      return { buffer: alphaConvertedBuffer, extension: '.png' }
    }

    const convertedBuffer = await sharp(fileBuffer).jpeg({ quality: 85 }).toBuffer()
    return { buffer: convertedBuffer, extension: '.jpg' }
  } catch (sharpError) {
    const filename = file?.hapi?.filename || ''
    const fileExtension = path.extname(filename).toLowerCase()
    const contentType = (file?.hapi?.headers?.['content-type'] || '').toLowerCase()
    const isHeicUpload = ['.heic', '.heif'].includes(fileExtension) || contentType.includes('heic') || contentType.includes('heif')

    if (isHeicUpload) {
      try {
        const convertedHeic = await heicConvert({
          buffer: fileBuffer,
          format: 'JPEG',
          quality: 0.85
        })

        const convertedBuffer = Buffer.isBuffer(convertedHeic)
          ? convertedHeic
          : Buffer.from(convertedHeic)

        return { buffer: convertedBuffer, extension: '.jpg' }
      } catch (heicError) {
        const invalidImageError = new Error('Invalid or unsupported image format', { cause: heicError })
        invalidImageError.code = 'INVALID_IMAGE'
        throw invalidImageError
      }
    }

    const err = new Error('Invalid or unsupported image format', { cause: sharpError })
    err.code = 'INVALID_IMAGE'
    throw err
  }
}

export async function convertImageSize (fileBuffer, extension, depth = 0, metadata = null, exceedsMaxDimension = null) {
  const imageMetadata = metadata || await sharp(fileBuffer).metadata()
  const imageExceedsMaxDimension = exceedsMaxDimension ?? (
    (imageMetadata.width && imageMetadata.width > MAX_IMAGE_DIMENSION) ||
    (imageMetadata.height && imageMetadata.height > MAX_IMAGE_DIMENSION)
  )

  if (fileBuffer.length <= UPLOAD_MAX_BYTES && !imageExceedsMaxDimension) {
    return { buffer: fileBuffer, extension }
  }

  if (depth >= MAX_IMAGE_RESIZE_DEPTH) {
    const err = new Error('Image file is too large after processing')
    err.code = 'FILE_TOO_LARGE'
    throw err
  }

  if (imageExceedsMaxDimension) {
    const scaledBuffer = await sharp(fileBuffer)
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer()

    return convertImageSize(scaledBuffer, extension, depth + 1)
  }

  const tryJpegQuality = async (index) => {
    if (index >= QUALITY_LEVELS.length) {
      return null
    }

    const convertedBuffer = await sharp(fileBuffer)
      .jpeg({ quality: QUALITY_LEVELS[index] })
      .toBuffer()

    if (convertedBuffer.length <= UPLOAD_MAX_BYTES) {
      return { buffer: convertedBuffer, extension: '.jpg' }
    }

    return tryJpegQuality(index + 1)
  }

  const qualityResult = await tryJpegQuality(0)
  if (qualityResult) {
    return qualityResult
  }

  if (!imageMetadata.width || imageMetadata.width <= MIN_RESIZE_WIDTH) {
    const fallbackBuffer = await sharp(fileBuffer).jpeg({ quality: 30 }).toBuffer()

    if (fallbackBuffer.length > UPLOAD_MAX_BYTES) {
      const err = new Error('Image file is too large after processing')
      err.code = 'FILE_TOO_LARGE'
      throw err
    }

    return { buffer: fallbackBuffer, extension: '.jpg' }
  }

  const resizedBuffer = await sharp(fileBuffer)
    .resize({
      width: Math.max(MIN_RESIZE_WIDTH, Math.floor(imageMetadata.width * RESIZE_WIDTH_RATIO)),
      withoutEnlargement: true
    })
    .jpeg({ quality: 30 })
    .toBuffer()

  return convertImageSize(resizedBuffer, '.jpg', depth + 1)
}

async function handleFileUpload (request, uploadId) {
  // 1. Check file exists
  const file = request.payload.fileUpload1

  if (!file) {
    const err = new Error('No file provided')
    err.code = 'NO_FILE'
    throw err
  }

  if (!file.hapi?.filename) {
    const err = new Error('Missing original filename')
    err.code = 'NO_FILE'
    throw err
  }

  const fileBuffer = await streamToBuffer(file)

  if (!fileBuffer.length) {
    const err = new Error('No file data provided')
    err.code = 'NO_FILE'
    throw err
  }

  const containerClient = await getUploadContainerClient()
  const originalName = path.parse(file.hapi.filename).name || 'upload'
  const originalExt = path.extname(file.hapi.filename).toLowerCase()
  // 2. Malware check: upload to quarantine first, Azure scans via tags, then process if clean
  const scanFilePath = `quarantine/${uploadId}/.scan-${Date.now()}${originalExt}`
  const scanBlobClient = containerClient.getBlockBlobClient(scanFilePath)
  await scanBlobClient.uploadData(fileBuffer)

  try {
    fileMalwareCheck(await pollForScanTag(containerClient, scanFilePath))
  } catch (malwareError) {
    await scanBlobClient.deleteIfExists()
    if (malwareError.code === 'MALWARE_DETECTED') {
      const err = new Error('The selected file contains a virus')
      err.code = 'MALWARE_DETECTED'
      throw err
    }
    throw malwareError
  }
  // Delete the temp scan file after passing scan
  await scanBlobClient.deleteIfExists()

  // 3. Convert image type
  const { buffer: convertedBuffer, extension } = await convertImageType(fileBuffer, file)

  // 4. Check 4MB size or max dimensions and store in session if needed
  const metadata = await sharp(convertedBuffer).metadata()
  const exceedsMaxDimension = (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
    (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
  const aiCheckerImage = (convertedBuffer.length > UPLOAD_MAX_BYTES || exceedsMaxDimension)
    ? (await convertImageSize(convertedBuffer, extension, 0, metadata, exceedsMaxDimension)).buffer.toString('base64')
    : null

  // 5. Create thumbnail from converted image
  const thumbnail = await sharp(convertedBuffer)
    .resize({ width: 200 })
    .toBuffer()

  const existingNames = getThumbnailsBySirId(request).map(t => t.finalFilename)
  const findUniqueName = (blobPath, count = 2) => {
    if (!existingNames.includes(blobPath)) {
      return blobPath
    }
    return findUniqueName(`quarantine/${uploadId}/${originalName}-${count}${extension}`, count + 1)
  }

  const finalFilename = findUniqueName(`quarantine/${uploadId}/${originalName}${extension}`)
  const thumbnailBlobPath = `${finalFilename.slice(0, finalFilename.length - extension.length)}-thumbnail${extension}`

  // 6. Upload converted image and thumbnail to same container/folder
  await containerClient
    .getBlockBlobClient(finalFilename)
    .uploadData(convertedBuffer)

  await containerClient
    .getBlockBlobClient(thumbnailBlobPath)
    .uploadData(thumbnail)

  // Save local thumbnail file
  const uniqueBaseName = finalFilename.split('/').pop().replace(extension, '')
  const thumbnailName = `${uniqueBaseName}-thumbnail${extension}`
  const thumbDir = path.join(dirname, `server/public/build/thumbnails/${uploadId}`)
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true })
  }
  fs.writeFileSync(path.join(thumbDir, thumbnailName), thumbnail)

  return {
    finalFilename,
    fileSizeBytes: convertedBuffer.length,
    aiCheckerImage,
    thumbnailBlobPath,
    localFilename: `${uploadId}/${thumbnailName}`,
    localThumbnailDir: thumbDir
  }
}

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const { sirid } = request.query
    const thumbnails = getThumbnailsBySirId(request)

    return h.view(constants.views.ADD_A_PHOTO, {
      maxSelectedFiles: thumbnails.length >= MAX_SELECTED_FILES,
      backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
    })
  },

  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const uploadId = request.query.sirid
    const { sirid } = request.query
    const thumbnails = getThumbnailsBySirId(request)

    if (thumbnails.length >= MAX_SELECTED_FILES) {
      return h.view(constants.views.ADD_A_PHOTO, {
        maxSelectedFiles: true,
        backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`,
        sirid
      })
    }

    try {
      const { finalFilename, fileSizeBytes, aiCheckerImage, thumbnailBlobPath, localFilename, localThumbnailDir } = await handleFileUpload(request, uploadId)
      const thumbLoc = `/public/thumbnails/${localFilename}`
      addThumbnailBySirId(request, { finalFilename, thumbLoc, thumbnailBlobPath, fileSizeBytes, aiCheckerImage, localThumbnailDir })

      const redirectUrl = addSirIdToQueryString(request, constants.routes.YOUR_PHOTOS)

      return h.redirect(redirectUrl)
    } catch (err) {
      switch (err.code) {
        case 'NO_FILE':
          return h.view(constants.views.ADD_A_PHOTO, {
            maxSelectedFiles: false,
            errorMessage: 'Select a file',
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
          })

        case 'INVALID_IMAGE':
          return h.view(constants.views.ADD_A_PHOTO, {
            maxSelectedFiles: false,
            errorMessage: 'Select a file in a different image format, for example JPEG or PNG',
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
          })

        case 'FILE_TOO_LARGE':
          return h.view(constants.views.ADD_A_PHOTO, {
            maxSelectedFiles: false,
            errorMessage: 'The selected file must be smaller than 4MB',
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
          })

        case 'MALWARE_DETECTED':
          return h.view(constants.views.ADD_A_PHOTO, {
            maxSelectedFiles: false,
            errorMessage: 'The selected file contains a virus',
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
          })

        default:
          return h.view(constants.views.ADD_A_PHOTO, {
            maxSelectedFiles: false,
            errorMessage: 'The selected file could not be uploaded – try again',
            backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
          })
      }
    }
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.ADD_A_PHOTO,
    handler: handlers.get,
    options: { auth: false }
  },
  {
    method: 'POST',
    path: constants.routes.ADD_A_PHOTO,
    handler: handlers.post,
    options: {
      auth: false,
      payload: {
        output: 'stream',
        parse: true,
        multipart: true,
        allow: 'multipart/form-data',
        maxBytes: PAYLOAD_MAX_BYTES,
        failAction: (request, h, err) => {
          if (err?.output?.statusCode === 413) {
            const { sirid } = request.query
            return maximumFileSizeExceeded(h, sirid).takeover()
          }
          throw err
        }
      }
    }
  }
]

const maximumFileSizeExceeded = (h, sirid) => {
  return h.view(constants.views.ADD_A_PHOTO, {
    maxSelectedFiles: false,
    errorMessage: 'The selected file must be smaller than 25MB',
    backLinkHref: `${constants.routes.YOUR_PHOTOS}?sirid=${sirid}`
  })
}

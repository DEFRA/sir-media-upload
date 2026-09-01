import path from 'path'
import sharp from 'sharp'
import { getUploadContainerClient } from './blob-storage.js'
import { updateThumbnailBySirId } from '../utils/upload-session-helpers.js'

const MAX_IMAGE_DIMENSION = 7200
const MAX_IMAGE_RESIZE_DEPTH = 5
const MIN_RESIZE_WIDTH = 320
const QUALITY_LEVELS = [80, 70, 60, 50, 40, 30]
const RESIZE_WIDTH_RATIO = 0.8
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024

const isLessThanMaxBase64Size = (fileBuffer) => fileBuffer.toString('base64').length <= UPLOAD_MAX_BYTES

export async function convertImageSize (fileBuffer, extension, depth = 0, metadata = null, exceedsMaxDimension = null) {
  const imageMetadata = metadata || await sharp(fileBuffer).metadata()
  const imageExceedsMaxDimension = exceedsMaxDimension ?? (
    (imageMetadata.width && imageMetadata.width > MAX_IMAGE_DIMENSION) ||
    (imageMetadata.height && imageMetadata.height > MAX_IMAGE_DIMENSION)
  )

  if (isLessThanMaxBase64Size(fileBuffer) && !imageExceedsMaxDimension) {
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

    return convertImageSize(scaledBuffer, extension, depth + 1, null, null)
  }

  const tryJpegQuality = async (index) => {
    if (index >= QUALITY_LEVELS.length) {
      return null
    }

    const convertedBuffer = await sharp(fileBuffer)
      .jpeg({ quality: QUALITY_LEVELS[index] })
      .toBuffer()

    if (isLessThanMaxBase64Size(convertedBuffer)) {
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

    if (!isLessThanMaxBase64Size(fallbackBuffer)) {
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

  return convertImageSize(resizedBuffer, '.jpg', depth + 1, null, null)
}

export async function prepareImageForBackgroundCheck (image, uploadContainerClient = null) {
  if (!image?.finalFilename) {
    return {
      ...image,
      aiResizeChecked: true,
      aiResizeFailed: true,
      aiResizeFailureReason: 'AI_RESIZE_FAILED'
    }
  }

  const containerClient = uploadContainerClient || await getUploadContainerClient()

  if (!containerClient) {
    return {
      ...image,
      aiResizeChecked: true,
      aiResizeFailed: true,
      aiResizeFailureReason: 'AI_RESIZE_FAILED'
    }
  }

  try {
    const convertedBuffer = await containerClient.getBlobClient(image.finalFilename).downloadToBuffer()
    const metadata = await sharp(convertedBuffer).metadata()
    const exceedsMaxDimension = (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
      (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
    const needsResize = (!isLessThanMaxBase64Size(convertedBuffer) || exceedsMaxDimension)

    if (!needsResize) {
      return {
        ...image,
        aiResizeChecked: true,
        aiResizeFailed: false,
        aiResizeFailureReason: null
      }
    }

    const extension = path.extname(image.finalFilename) || '.jpg'
    const resizedImage = await convertImageSize(
      convertedBuffer,
      extension,
      0,
      metadata,
      exceedsMaxDimension
    )

    return {
      ...image,
      aiCheckerImage: resizedImage.buffer.toString('base64'),
      aiResizeChecked: true,
      aiResizeFailed: false,
      aiResizeFailureReason: null
    }
  } catch (error) {
    return {
      ...image,
      aiResizeChecked: true,
      aiResizeFailed: true,
      aiResizeFailureReason: error?.code || error?.message || 'AI_RESIZE_FAILED'
    }
  }
}

export async function prepareImageSize (request, sirid, images = []) {
  const uploadContainerClient = await getUploadContainerClient()

  if (!uploadContainerClient) {
    return
  }

  await Promise.all(
    images.map(async (image) => {
      const preparedImage = await prepareImageForBackgroundCheck(image, uploadContainerClient)

      if (!preparedImage.aiResizeChecked) {
        return
      }

      if (preparedImage.aiResizeFailed) {
        updateThumbnailBySirId(request, image.finalFilename, {
          aiResizeChecked: true,
          aiResizeFailed: true,
          aiResizeFailureReason: preparedImage.aiResizeFailureReason || 'AI_RESIZE_FAILED'
        }, sirid)

        request.logger.error({
          message: 'Background AI image preparation failed for image',
          sirid,
          finalFilename: image?.finalFilename,
          error: preparedImage.aiResizeFailureReason || 'AI_RESIZE_FAILED'
        })
        return
      }

      if (!preparedImage.aiCheckerImage) {
        return
      }

      try {
        updateThumbnailBySirId(request, image.finalFilename, {
          aiCheckerImage: preparedImage.aiCheckerImage,
          aiResizeChecked: true,
          aiResizeFailed: false,
          aiResizeFailureReason: null
        }, sirid)
      } catch (error) {
        updateThumbnailBySirId(request, image.finalFilename, {
          aiResizeChecked: true,
          aiResizeFailed: true,
          aiResizeFailureReason: error?.code || 'AI_RESIZE_FAILED'
        }, sirid)

        request.logger.error({
          message: 'Background AI image preparation failed for image',
          sirid,
          finalFilename: image?.finalFilename,
          error: error?.message || error
        })
      }
    })
  )
}

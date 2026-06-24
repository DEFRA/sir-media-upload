import constants from '../utils/constants.js'
import path from 'path'
import imageChecker from '../services/image-checker.js'
import { getUploadContainerClient, moveBlobToFolder } from '../services/blob-storage.js'
import { sendMessage } from '../services/service-bus.js'
import { addSirIdToQueryString, hasValidSirId, getThumbnailsBySirId } from '../utils/upload-session-helpers.js'

const harmfulContent = 'quarantine/harmful-content'

const getFolderByAIResult = (validationResult, imageIndex) => {
  if (validationResult.skipped || !validationResult.response) return 'cleared'

  const imageResult = validationResult.response[imageIndex]
  if (!imageResult) return harmfulContent
  return imageChecker.shouldBlockImage(imageResult) ? harmfulContent : 'cleared'
}

const getThumbnailBlobPath = (imagePath, existingThumbnailPath) => {
  if (existingThumbnailPath) {
    return existingThumbnailPath
  }

  const ext = path.extname(imagePath)
  const withoutExt = imagePath.slice(0, imagePath.length - ext.length)

  return `${withoutExt}-thumbnail${ext}`
}

const buildPayload = (sirId, images, validationResult, uploadContainerUrl) => {
  const validationResponse = validationResult?.response || []

  return {
    mediaUpload: {
      sessionId: sirId,
      timestamp: new Date().toISOString(),
      images: images.map((image, index) => {
        const imageSafety = validationResponse[index] || {}
        const imageName = image.finalFilename.split('/').pop()
        const thumbnailBlobPath = getThumbnailBlobPath(image.finalFilename, image.thumbnailBlobPath)

        return {
          imageLink: `${uploadContainerUrl}/${image.finalFilename}`,
          thumbnailLink: `${uploadContainerUrl}/${thumbnailBlobPath}`,
          imageName,
          severityScores: imageSafety.severityScores || 'none',
          metadata: {
            size: image.fileSizeBytes ? (image.fileSizeBytes / (1024 * 1024)).toFixed(2) : null,
            fileType: imageName.includes('.') ? imageName.split('.').pop().toLowerCase() : '',
            dateTaken: image.dateTaken ?? null,
            geotag: image.geotag ?? null
          }
        }
      })
    }
  }
}

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const { sirid } = request.query
    const images = getThumbnailsBySirId(request)
    return h.view(constants.views.SEND_PHOTOS, {
      photos: images.length,
      sirid
    })
  },
  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const { sirid } = request.query
    const images = getThumbnailsBySirId(request)
    const uploadContainerClient = await getUploadContainerClient()
    const validationResult = await imageChecker.validate(images)

    const movedImages = await Promise.all(
      images.map(async (image, index) => {
        const folder = getFolderByAIResult(validationResult, index)
        const thumbBlobPath = getThumbnailBlobPath(image.finalFilename, image.thumbnailBlobPath)

        const [newFinalFilename, newThumbnailBlobPath] = await Promise.all([
          moveBlobToFolder(uploadContainerClient, image.finalFilename, folder),
          moveBlobToFolder(uploadContainerClient, thumbBlobPath, folder)
        ])

        return {
          ...image,
          finalFilename: newFinalFilename,
          thumbnailBlobPath: newThumbnailBlobPath
        }
      })
    )

    const payload = buildPayload(sirid, movedImages, validationResult, uploadContainerClient.url)
    console.log('Payload to send to service bus', JSON.stringify(payload, null, 2))
    await sendMessage(request.logger, payload)
    const redirectUrl = `${constants.routes.SUCCESS}?sirid=${sirid}`
    return h.redirect(redirectUrl)
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.SEND_PHOTOS,
    handler: handlers.get,
    options: {
      auth: false
    }
  },
  {
    method: 'POST',
    path: constants.routes.SEND_PHOTOS,
    handler: handlers.post,
    options: {
      auth: false
    }
  }
]

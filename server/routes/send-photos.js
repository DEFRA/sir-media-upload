import constants from '../utils/constants.js'
import imageChecker from '../services/image-checker.js'
import { getUploadContainerClient } from '../services/blob-storage.js'
import { sendMessage } from '../services/service-bus.js'

const buildMetadata = (thumbnail) => {
  const imageName = thumbnail.finalFilename.split('/').pop()
  const extension = imageName.includes('.') ? imageName.split('.').pop().toLowerCase() : ''

  return {
    sizeBytes: thumbnail.fileSizeBytes ?? null,
    fileType: extension,
    location: thumbnail.finalFilename
  }
}

const buildPayload = (request, thumbnails, validationResult, uploadContainerUrl) => {
  const validationResponse = validationResult?.response || []
  const sessionId = request.yar.id

  return {
    mediaUpload: {
      sessionId,
      timestamp: new Date().toISOString(),
      images: thumbnails.map((thumbnail, index) => {
        const imageSafety = validationResponse[index] || {}
        const imageName = thumbnail.finalFilename.split('/').pop()

        return {
          imageLink: `${uploadContainerUrl}/${sessionId}/${imageName}`,
          imageName,
          severityScores: imageSafety.severityScores || 'none',
          metadata: buildMetadata(thumbnail)
        }
      })
    }
  }
}

const handlers = {
  get: (request, h) => {
    const thumbnails = request.yar.get('thumbnails') || []
    return h.view(constants.views.SEND_PHOTOS, {
      photos: thumbnails.length
    })
  },
  post: async (request, h) => {
    const thumbnails = request.yar.get('thumbnails') || []
    const uploadContainerClient = await getUploadContainerClient()
    const validationResult = await imageChecker.validate(thumbnails)
    const payload = buildPayload(request, thumbnails, validationResult, uploadContainerClient.url)
    await sendMessage(request.logger, payload)
    return h.redirect(constants.routes.SUCCESS)
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

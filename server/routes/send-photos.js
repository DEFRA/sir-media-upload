import constants from '../utils/constants.js'
import imageChecker from '../services/image-checker.js'
import { getUploadContainerClient } from '../services/blob-storage.js'
import { sendMessage } from '../services/service-bus.js'

const buildPayload = (request, images, validationResult, uploadContainerUrl) => {
  const validationResponse = validationResult?.response || []
  const sirId = request.yar.get('sirid')

  return {
    mediaUpload: {
      sessionId: sirId,
      timestamp: new Date().toISOString(),
      images: images.map((image, index) => {
        const imageSafety = validationResponse[index] || {}
        const imageName = image.finalFilename.split('/').pop()

        return {
          imageLink: `${uploadContainerUrl}/${sirId}/${imageName}`,
          imageName,
          severityScores: imageSafety.severityScores || 'none',
          metadata: {
            size: image.fileSizeBytes ? (image.fileSizeBytes / (1024 * 1024)).toFixed(2) : null,
            fileType: imageName.includes('.') ? imageName.split('.').pop().toLowerCase() : ''
          }
        }
      })
    }
  }
}

const handlers = {
  get: (request, h) => {
    const images = request.yar.get('thumbnails') || []
    return h.view(constants.views.SEND_PHOTOS, {
      photos: images.length
    })
  },
  post: async (request, h) => {
    const images = request.yar.get('thumbnails') || []
    if (images.length === 0) {
      return h.redirect(constants.routes.YOUR_PHOTOS)
    }
    const uploadContainerClient = await getUploadContainerClient()
    const validationResult = await imageChecker.validate(images)
    const payload = buildPayload(request, images, validationResult, uploadContainerClient.url)
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

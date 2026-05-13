import constants from '../utils/constants.js'
import imageChecker from '../services/image-checker.js'
import { getUploadContainerClient } from '../services/blob-storage.js'
// import { sendMessage } from '../services/service-bus.js'
import { hasValidSirId, getThumbnailsBySirId } from '../utils/upload-session-helpers.js'

const buildPayload = (sirId, images, validationResult, uploadContainerUrl) => {
  const validationResponse = validationResult?.response || []

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
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
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
      return h.redirect(constants.routes.LINK_USED)
    }

    const { sirid } = request.query
    const images = getThumbnailsBySirId(request)
    const uploadContainerClient = await getUploadContainerClient()
    const validationResult = await imageChecker.validate(images)
    const payload = buildPayload(sirid, images, validationResult, uploadContainerClient.url)
    console.log('Payload to send to service bus', JSON.stringify(payload, null, 2))
    await sendMessage(request.logger, payload)
    const redirectUrl = constants.routes.SUCCESS + (sirid ? `?sirid=${sirid}` : '')
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

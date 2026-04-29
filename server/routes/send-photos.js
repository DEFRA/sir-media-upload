import constants from '../utils/constants.js'
import imageChecker from '../services/image-checker.js'
import { getUploadContainerClient } from '../services/blob-storage.js'
import { sendMessage } from '../services/service-bus.js'
import { hasValidSirId } from '../utils/upload-session-helpers.js'

const buildPayload = (request, images, validationResult, uploadContainerUrl) => {
  const validationResponse = validationResult?.response || []
  // FIXME
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
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    // FIXME
    const images = request.yar.get('thumbnails') || []
    return h.view(constants.views.SEND_PHOTOS, {
      photos: images.length
    })
  },
  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    // FIXME: will need to get these from the session details that correlate to the sirid
    // need to create the function in upload-session-helpers.js to handle this
    const images = request.yar.get('thumbnails') || []
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

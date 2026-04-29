import constants from '../utils/constants.js'
import fs from 'node:fs'
import path from 'node:path'
import dirname from '../../dirname.cjs'
import { getUploadContainerClient } from '../services/blob-storage.js'
import { addSirIdToQueryString, hasValidSirId } from '../utils/upload-session-helpers.js'

const MAX_PHOTOS = 5

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    // FIXME: get thumbnails from session details that correlate to the sirid from upload-session-helpers.js
    const { sirid } = request.query
    const thumbnails = request.yar.get('thumbnails') || []
    const remainingPhotos = MAX_PHOTOS - thumbnails.length
    return h.view(constants.views.YOUR_PHOTOS, {
      thumbnails: thumbnails.map((files, index) => ({
        ...files,
        filename: files.finalFilename.split('/').pop(),
        index
      })),
      remainingPhotos,
      sirid
    })
  },

  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      return h.redirect(constants.routes.LINK_USED)
    }

    const imageIndex = Number.parseInt(request.payload.imageIndex, 10)
    // FIXME
    const thumbnails = request.yar.get('thumbnails') || []

    if (!Number.isNaN(imageIndex) && imageIndex >= 0 && imageIndex < thumbnails.length) {
      const imageToRemove = thumbnails[imageIndex]

      try {
        // Delete from Azure Blob Storage
        const containerClient = await getUploadContainerClient()

        // Delete the original image
        const blobClient = containerClient.getBlockBlobClient(imageToRemove.finalFilename)
        await blobClient.deleteIfExists()

        // Delete the thumbnail from blob storage
        const [folder, file] = imageToRemove.finalFilename.split('/')
        const [name, ext] = file.split('.')
        const thumbName = `${name}-thumbnail.${ext}`
        const thumbBlobClient = containerClient.getBlockBlobClient(`${folder}/${thumbName}`)
        await thumbBlobClient.deleteIfExists()

        // Delete local thumbnail file
        const localThumbPath = path.join(dirname, 'server/public/build', imageToRemove.thumbLoc)
        if (fs.existsSync(localThumbPath)) {
          fs.unlinkSync(localThumbPath)
        }

        // Remove from session array
        thumbnails.splice(imageIndex, 1)
        // FIXME: these need to go into the session details
        // that correlate to the sir id
        // need to create the function in upload-session-helpers.js to handle this
        request.yar.set('thumbnails', thumbnails)
      } catch (err) {
        console.error('Error removing image:', err)
      }
    }

    return h.redirect(addSirIdToQueryString(request, constants.routes.YOUR_PHOTOS))
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.YOUR_PHOTOS,
    handler: handlers.get,
    options: {
      auth: false
    }
  },
  {
    method: 'POST',
    path: constants.routes.YOUR_PHOTOS,
    handler: handlers.post,
    options: {
      auth: false
    }
  }
]

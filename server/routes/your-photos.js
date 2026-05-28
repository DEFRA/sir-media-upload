import constants from '../utils/constants.js'
import fs from 'node:fs'
import path from 'node:path'
import dirname from '../../dirname.cjs'
import { getUploadContainerClient } from '../services/blob-storage.js'
import { addSirIdToQueryString, hasValidSirId, getThumbnailsBySirId, removeThumbnailBySirIdAtIndex } from '../utils/upload-session-helpers.js'

const MAX_PHOTOS = 5

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const { sirid } = request.query
    const thumbnails = getThumbnailsBySirId(request)
    const remainingPhotos = MAX_PHOTOS - thumbnails.length
    return h.view(constants.views.YOUR_PHOTOS, {
      thumbnails: thumbnails.map((files, index) => ({
        ...files,
        filename: files.finalFilename.split('/').pop(),
        index
      })),
      remainingPhotos,
      sirid,
      backLinkHref: `${constants.routes.ADD_A_PHOTO}?sirid=${sirid}`
    })
  },

  post: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const imageIndex = Number.parseInt(request.payload.imageIndex, 10)
    const { removed } = removeThumbnailBySirIdAtIndex(request, imageIndex)

    if (removed) {
      try {
        // Delete from Azure Blob Storage
        const containerClient = await getUploadContainerClient()

        // Delete the original image
        const blobClient = containerClient.getBlockBlobClient(removed.finalFilename)
        await blobClient.deleteIfExists()

        // Delete the thumbnail from blob storage
        const [folder, file] = removed.finalFilename.split('/')
        const [name, ext] = file.split('.')
        const thumbName = `${name}-thumbnail.${ext}`
        const thumbBlobClient = containerClient.getBlockBlobClient(`${folder}/${thumbName}`)
        await thumbBlobClient.deleteIfExists()

        // Delete local thumbnail file
        const localThumbPath = path.join(dirname, 'server/public/build', removed.thumbLoc.replace(/^\//, ''))
        if (fs.existsSync(localThumbPath)) {
          fs.unlinkSync(localThumbPath)
        }
      } catch (err) {
        console.error('Error removing image:', err)
      }
    }

    const redirectUrl = addSirIdToQueryString(request, constants.routes.YOUR_PHOTOS)
    return h.redirect(redirectUrl)
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

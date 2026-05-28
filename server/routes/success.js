import constants from '../utils/constants.js'
import fs from 'node:fs'
import path from 'node:path'
import dirname from '../../dirname.cjs'
import { addSirIdToQueryString, hasValidSirId, removeSirIdFromSession, getThumbnailsBySirId } from '../utils/upload-session-helpers.js'

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = addSirIdToQueryString(request, constants.routes.LINK_USED)
      return h.redirect(redirectUrl)
    }

    const sirid = request.query.sirid
    const thumbnails = getThumbnailsBySirId(request)
    thumbnails.forEach((thumbnail) => {
      try {
        const localThumbPath = path.join(dirname, 'server/public/build', thumbnail.thumbLoc.replace(/^\//, ''))
        if (fs.existsSync(localThumbPath)) {
          fs.unlinkSync(localThumbPath)
        }
      } catch (err) {
        console.error('Local thumbnail deletion failed', {
          sirid,
          finalFilename: thumbnail?.finalFilename,
          err
        })
      }
    })
    removeSirIdFromSession(request)
    await request.server.app.mediaUploadCache.drop(sirid)

    return h.view(constants.views.SUCCESS)
  }
}

export default [
  {
    method: 'GET',
    path: constants.routes.SUCCESS,
    handler: handlers.get,
    options: {
      auth: false
    }
  }
]

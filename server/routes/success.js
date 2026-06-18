import constants from '../utils/constants.js'
import fs from 'node:fs'
import path from 'node:path'
import dirname from '../../dirname.cjs'
import { hasValidSirId, removeSirIdFromSession, getThumbnailsBySirId, markSirIdAsSubmitted, getInvalidSirIdRedirectUrl } from '../utils/upload-session-helpers.js'

const handlers = {
  get: async (request, h) => {
    if (!(await hasValidSirId(request))) {
      const redirectUrl = getInvalidSirIdRedirectUrl(request, constants.routes)
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
    markSirIdAsSubmitted(request, sirid)
    removeSirIdFromSession(request)
    await request.server.app.mediaUploadCache.drop(sirid)

    return h.view(constants.views.SUCCESS, { hideBackLink: true })
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

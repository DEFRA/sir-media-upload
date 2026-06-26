import constants from '../../utils/constants.js'
import fs from 'node:fs'
// import path from 'node:path'
// import dirname from '../../../dirname.cjs'
import { addSirIdToQueryString, hasValidSirId, removeSirIdFromSession, getThumbnailsBySirId } from '../../utils/upload-session-helpers.js'

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
        const localThumbnailDir = thumbnail.localThumbnailDir
        if (fs.existsSync(localThumbnailDir)) {
          console.log('\n-----------------------')
          console.log(`Deleting local thumbnail directory: ${localThumbnailDir}`)
          console.log('-----------------------\n')
          fs.rmSync(localThumbnailDir, { recursive: true })
        }
        console.log('\n-----------------------')
        console.log(`NOT deleting local thumbnail directory: ${localThumbnailDir}`)
        console.log('it doesnt exist')
        console.log('-----------------------\n')
      } catch (err) {
        console.error('Local thumbnail deletion failed', {
          dir: thumbnail.localThumbnailDir,
          sirid,
          err
        })
      }
    })
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

function getSirIdFromRequest (request) {
  const sirid = request.query.sirid || null
  return sirid
}

function getExistingUploads (request) {
  const existingUploads = request.yar.get('existing-uploads') || {}
  return existingUploads
}

function setExistingUploads (request, existingUploads) {
  request.yar.set('existing-uploads', existingUploads)
}

function getSessionDetailsBySirId (request, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return { thumbnails: [] }
  }

  const existingUploads = getExistingUploads(request)
  const details = existingUploads[sirid] || { thumbnails: [] }

  return details
}

function getThumbnailsBySirId (request, sirid = getSirIdFromRequest(request)) {
  const sessionDetails = getSessionDetailsBySirId(request, sirid)
  const thumbnails = sessionDetails.thumbnails || []

  return thumbnails
}

function addThumbnailBySirId (request, thumbnail, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return []
  }

  const existingUploads = getExistingUploads(request)

  if (!existingUploads[sirid]) {
    existingUploads[sirid] = { thumbnails: [] }
  }

  existingUploads[sirid].thumbnails.push(thumbnail)
  setExistingUploads(request, existingUploads)

  return existingUploads[sirid].thumbnails
}

function removeThumbnailBySirIdAtIndex (request, imageIndex, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return { removed: null, thumbnails: [] }
  }

  const existingUploads = getExistingUploads(request)
  const sessionDetails = existingUploads[sirid]

  if (!sessionDetails || !sessionDetails.thumbnails) {
    return { removed: null, thumbnails: [] }
  }

  const thumbnails = sessionDetails.thumbnails
  const idx = Number.parseInt(imageIndex, 10)

  if (Number.isNaN(idx) || idx < 0 || idx >= thumbnails.length) {
    return { removed: null, thumbnails }
  }

  const removed = thumbnails[idx]
  thumbnails.splice(idx, 1)
  existingUploads[sirid].thumbnails = thumbnails
  setExistingUploads(request, existingUploads)

  return { removed, thumbnails }
}

function clearSessionDetailsBySirId (request, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return sirid
  }

  const existingUploads = getExistingUploads(request)
  delete existingUploads[sirid]
  setExistingUploads(request, existingUploads)

  return sirid
}

function addSirIdToSession (request) {
  const { sirid } = request.query

  if (sirid) {
    const existingUploads = getExistingUploads(request)

    if (!existingUploads[sirid]) {
      existingUploads[sirid] = { thumbnails: [] }
      setExistingUploads(request, existingUploads)
    }
  }

  return sirid
}

function removeSirIdFromSession (request) {
  const sirid = clearSessionDetailsBySirId(request)
  return sirid
}

function addSirIdToQueryString (request, url) {
  const { sirid } = request.query
  const nextUrl = sirid ? `${url}?sirid=${sirid}` : url
  return nextUrl
}

async function hasValidSirId (request) {
  const { sirid } = request.query

  if (!sirid) {
    return false
  }

  const cachedData = await request.server.app.mediaUploadCache.get(sirid)

  if (!cachedData) {
    return false
  }

  return true
}

export {
  addSirIdToQueryString,
  addSirIdToSession,
  hasValidSirId,
  removeSirIdFromSession,
  getSirIdFromRequest,
  getExistingUploads,
  setExistingUploads,
  getSessionDetailsBySirId,
  getThumbnailsBySirId,
  addThumbnailBySirId,
  removeThumbnailBySirIdAtIndex,
  clearSessionDetailsBySirId
}

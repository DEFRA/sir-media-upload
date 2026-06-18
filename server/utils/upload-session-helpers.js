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

function removeThumbnailFromSession (request, imageIndex, sirid = getSirIdFromRequest(request)) {
  const existingUploads = getExistingUploads(request)
  const sessionDetails = sirid && existingUploads[sirid]
  const thumbnails = sessionDetails && Array.isArray(sessionDetails.thumbnails) ? sessionDetails.thumbnails : null
  const idx = Number(imageIndex)

  if (!thumbnails || !Number.isInteger(idx) || idx < 0 || idx >= thumbnails.length) {
    return null
  }

  const [removed] = thumbnails.splice(idx, 1)
  setExistingUploads(request, existingUploads)
  return removed
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

function getSubmittedSirId (request) {
  return request.yar.get('submitted-sirid') || null
}

function markSirIdAsSubmitted (request, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return null
  }

  request.yar.set('submitted-sirid', sirid)

  return sirid
}

function hasSubmittedSirId (request, sirid = getSirIdFromRequest(request)) {
  if (!sirid) {
    return false
  }

  return getSubmittedSirId(request) === sirid
}

function getInvalidSirIdRedirectUrl (request, routes) {
  const { sirid } = request.query

  if (!sirid || hasSubmittedSirId(request, sirid)) {
    return addSirIdToQueryString(request, routes.LINK_USED)
  }

  return addSirIdToQueryString(request, routes.LINK_EXPIRED)
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
  getSubmittedSirId,
  markSirIdAsSubmitted,
  hasSubmittedSirId,
  getInvalidSirIdRedirectUrl,
  getSessionDetailsBySirId,
  getThumbnailsBySirId,
  addThumbnailBySirId,
  removeThumbnailFromSession,
  clearSessionDetailsBySirId
}

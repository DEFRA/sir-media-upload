function addSirIdToSession (request) {
  const { sirid } = request.query

  if (sirid) {
    const existingUploads = request.yar.get('existing-uploads') || {}

    if (!Object.keys(existingUploads).includes(sirid)) {
      existingUploads[sirid] = {}
      request.yar.set('existing-uploads', existingUploads)
    }
  }

  return sirid
}

// FIXME: need functions to add and remove images/thumbnail details to
// session related to the sirid

function removeSirIdFromSession (request) {
  const { sirid } = request.query

  const existingUploads = request.yar.get('existing-uploads') || []
  const updatedUploads = existingUploads.filter(id => id !== sirid)
  request.yar.set('existing-uploads', updatedUploads)

  return sirid
}

function addSirIdToQueryString (request, url) {
  const { sirid } = request.query
  return sirid ? `${url}?sirid=${sirid}` : url
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

// FIXME: need to add thumbnail location and upload loction details

export {
  addSirIdToQueryString,
  addSirIdToSession,
  hasValidSirId,
  removeSirIdFromSession
}

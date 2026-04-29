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

function removeSirIdFromSession (request, sirid) {
  const existingUploads = request.yar.get('existing-uploads') || []
  const updatedUploads = existingUploads.filter(id => id !== sirid)
  request.yar.set('existing-uploads', updatedUploads)
}

function addSirIdToQueryString (request, url) {
  const { sirid } = request.query
  return sirid ? `${url}?sirid=${sirid}` : url
}

async function hasValidSirId (request) {
  const { sirid } = request.query

  if (!sirid) {
    console.log('No sirid in query')
    console.log('Request query:', request.query)
    return false
  }

  const cachedData = await request.server.app.mediaUploadCache.get(sirid)

  if (!cachedData) {
    console.log('No cached data for sirid:', sirid)
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

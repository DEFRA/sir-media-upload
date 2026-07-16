import imageChecker from './image-checker.js'
import { prepareImageForBackgroundCheck } from './convert-image-size.js'

const inFlightJobs = {}
const AI_FAIL_SEVERITY = 8

const buildAIFailResult = (errorMessage = 'AI validation failed') => ({
  categoriesAnalysis: [{ category: 'AIFail', severity: AI_FAIL_SEVERITY }],
  severityScores: `AIFail:${AI_FAIL_SEVERITY}`,
  shouldBlock: true,
  error: errorMessage
})

const getCache = (server) => server?.app?.mediaUploadCache || null
const getJobKey = (sirid, finalFilename) => `${sirid}:${finalFilename}`

const getImageCheckByFilename = async (server, sirid) => {
  const cache = getCache(server)

  if (!cache || !sirid) {
    return null
  }

  const cacheEntry = await cache.get(sirid) || {}
  return cacheEntry.imageCheckByFilename || {}
}

const setImageCheckByFilename = async (server, sirid, imageCheckByFilename) => {
  const cache = getCache(server)

  if (!cache || !sirid) {
    return
  }

  const cacheEntry = await cache.get(sirid) || {}

  await cache.set(sirid, {
    ...cacheEntry,
    imageCheckByFilename
  })
}

const setImageStatus = async (server, sirid, finalFilename, status, validationResult = null) => {
  if (!finalFilename) {
    return
  }

  const imageCheckByFilename = await getImageCheckByFilename(server, sirid) || {}

  imageCheckByFilename[finalFilename] = {
    status,
    validationResult
  }

  await setImageCheckByFilename(server, sirid, imageCheckByFilename)
}

const removeImageCheckStatusByFilename = async (server, sirid, finalFilename) => {
  if (!finalFilename) {
    return
  }

  const imageCheckByFilename = await getImageCheckByFilename(server, sirid)
  if (!imageCheckByFilename || !imageCheckByFilename[finalFilename]) {
    return
  }

  delete imageCheckByFilename[finalFilename]
  await setImageCheckByFilename(server, sirid, imageCheckByFilename)
}

const runImageCheck = async (server, sirid, image, logger = null) => {
  await setImageStatus(server, sirid, image.finalFilename, 'pending', null)

  try {
    const preparedImage = await prepareImageForBackgroundCheck(image)
    const validation = await imageChecker.validate([preparedImage])
    const validationResult = validation?.response?.[0] || buildAIFailResult('Unexpected response from background AI validation')

    await setImageStatus(server, sirid, image.finalFilename, 'complete', validationResult)
  } catch (error) {
    await setImageStatus(
      server,
      sirid,
      image.finalFilename,
      'complete',
      buildAIFailResult('Background image check failed')
    )

    logger?.error?.({
      message: 'Background image check failed',
      sirid,
      finalFilename: image.finalFilename,
      error: error?.message || error
    })
  }
}

const queueImageCheckInBackground = async (server, sirid, images = [], logger = null) => {
  if (!server || !sirid || !Array.isArray(images) || images.length === 0) {
    return
  }

  for (const image of images) {
    if (!image?.finalFilename) {
      continue
    }

    const jobKey = getJobKey(sirid, image.finalFilename)
    if (inFlightJobs[jobKey]) {
      continue
    }

    inFlightJobs[jobKey] = true

    runImageCheck(server, sirid, image, logger)
      .finally(() => {
        delete inFlightJobs[jobKey]
      })
  }
}

const getSendPhotosValidation = async (server, sirid, images = []) => {
  const imageCheckByFilename = await getImageCheckByFilename(server, sirid) || {}
  const response = []

  for (const image of images) {
    const imageJob = imageCheckByFilename[image.finalFilename]

    if (!imageJob || imageJob.status === 'pending') {
      return { ready: false, validationResult: null }
    }

    response.push(imageJob.validationResult || buildAIFailResult('Background image check failed'))
  }

  return {
    ready: true,
    validationResult: {
      success: true,
      skipped: false,
      response,
      shouldBlockAny: response.some(result => result?.shouldBlock || imageChecker.shouldBlockImage(result))
    }
  }
}

export {
  queueImageCheckInBackground,
  getSendPhotosValidation,
  removeImageCheckStatusByFilename
}

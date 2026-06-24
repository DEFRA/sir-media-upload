import ContentSafetyClient, { isUnexpected } from '@azure-rest/ai-content-safety'
// import { AzureKeyCredential } from '@azure/core-auth'
import { getUploadContainerClient } from './blob-storage.js'
import config from '../utils/config.js'
import wreck from '@hapi/wreck'

const AI_FAIL_SEVERITY = 8
const AI_REVIEW_SEVERITIES = new Set([4, 6])

// const contentSafetyApiVersion = '2023-10-01'

const tokenEndpoint = `https://login.microsoftonline.com/${config.apimAITenantId}/oauth2/v2.0/token`
const contentSafetyAPIMEndpoint = `https://${config.apimAIEndpoint}/contentsafety/image:analyze/v1.0?api-version=2024-09-01`

const getAccessToken = async () => {
  try {
    const formData = {
      grant_type: 'client_credentials',
      scope: config.apimAIScope,
      client_id: config.apimAIClientId,
      client_secret: config.apimAISecret
    }

    const response = await wreck.post(tokenEndpoint, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams(formData).toString(),
      json: true
    })

    return response.payload.access_token
  } catch (err) {
    // FIXME: handle error properly, maybe throw an error or log it
    console.error(err)
    return null
  }
}

const callAIContentSafetyAPIM = async (accessToken, imageBuffer) => {
  try {
    const response = await wreck.post(contentSafetyAPIMEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        image: { content: imageBuffer.toString('base64') },
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        outputType: 'FourSeverityLevels'
      }),
      json: true
    })
    console.log(response.payload)
    return response.payload
    // return response.payload.access_token
  } catch (err) {
    // FIXME: handle error properly, maybe throw an error or log it
    console.error(err)
    // return null
  }

  // const result = await contentSafetyClient.path('/image:analyze').post({
  //     body: {
  //       image: {
  //         content: aiBuffer.toString('base64')
  //       }
  //     }
  //   })
}

// const getContentSafetyConfig = () => ({
//   endpoint: config.contentSafetyEndpoint,
//   key: config.contentSafetyKey
// })

// const getContentSafetyClient = () => {
//   const { endpoint, key } = getContentSafetyConfig()

//   if (!endpoint || !key) {
//     return null
//   }

//   return ContentSafetyClient(endpoint, new AzureKeyCredential(key), {
//     apiVersion: contentSafetyApiVersion
//   })
// }

const isViolenceCategory = category => (category ?? '').toLowerCase().trim() === 'violence'

const shouldBlockCategory = ({ category, severity }) => {
  if (severity === AI_FAIL_SEVERITY) {
    return true
  }

  if (!AI_REVIEW_SEVERITIES.has(severity)) {
    return false
  }

  return !isViolenceCategory(category)
}

const shouldBlockImage = (imageResult = {}) => {
  const categories = imageResult.categoriesAnalysis ?? []
  return categories.some(shouldBlockCategory)
}

const buildAIFailResult = (errorMessage = 'AI validation failed') => ({
  categoriesAnalysis: [{ category: 'AIFail', severity: AI_FAIL_SEVERITY }],
  severityScores: `AIFail:${AI_FAIL_SEVERITY}`,
  shouldBlock: true,
  error: errorMessage
})

// const validateSingleImage = async (containerClient, image, contentSafetyClient) => {
const validateSingleImage = async (containerClient, image, accessToken) => {
  const aiBuffer = image.aiCheckerImage
    ? Buffer.from(image.aiCheckerImage, 'base64')
    : await containerClient.getBlobClient(image.finalFilename).downloadToBuffer()

  const result = await callAIContentSafetyAPIM(accessToken, aiBuffer)

  // FIXME: handle unexpected response from Azure Content Safety API
  // if (isUnexpected(result)) {
  //   console.log(result)
  //   throw new Error('Unexpected response from Azure Content Safety API')
  // }

  const categories = result.categoriesAnalysis
  const scores = categories.map(({ category, severity }) => `${category}:${severity}`).join(', ')
  console.log(`Content Safety severity scores for ${image.finalFilename}: ${scores}`)

  return {
    ...result.body,
    severityScores: scores,
    shouldBlock: shouldBlockImage(result.body)
  }
}

// const validateWithRetry = async (containerClient, image, contentSafetyClient, maxRetries = 3) => {
const validateWithRetry = async (containerClient, image, accessToken, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // return await validateSingleImage(containerClient, image, contentSafetyClient)
      return await validateSingleImage(containerClient, image, accessToken)
    } catch (error) {
      console.log(`Content Safety API attempt ${attempt}/${maxRetries} failed for ${image.finalFilename}: ${error.message}`)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 100))
      }
    }
  }

  console.log(`Content Safety severity scores for ${image.finalFilename}: AIFail:${AI_FAIL_SEVERITY}`)
  return buildAIFailResult('Content Safety API failed after 3 attempts')
}

const validate = async (thumbnails = []) => {
  // FIXME: capture these cases where return success true and skipped true, and log them
  // const contentSafetyClient = getContentSafetyClient()

  // if (!contentSafetyClient || thumbnails.length === 0) {
  //   return { success: true, skipped: true }
  // }

  const containerClient = await getUploadContainerClient()

  if (!containerClient) {
    return { success: true, skipped: true }
  }

  const accessToken = await getAccessToken()

  const response = await Promise.all(
    thumbnails.map(async (image) => {
      // return await validateWithRetry(containerClient, image, contentSafetyClient)
      return await validateWithRetry(containerClient, image, accessToken)
    })
  )

  return {
    success: true,
    skipped: false,
    response,
    shouldBlockAny: response.some(image => image.shouldBlock)
  }
}

export default {
  validate,
  shouldBlockImage,
  validateWithRetry
}

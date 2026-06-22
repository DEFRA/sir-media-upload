import { getUploadContainerClient } from './blob-storage.js'
import config from '../utils/config.js'

const FALLBACK_ALT_TEXT = 'User submitted image'

const getAltTextConfig = () => ({
  enabled: config.altTextEnabled,
  endpoint: config.altTextEndpoint,
  apiKey: config.altTextApiKey,
  deployment: config.altTextDeployment,
  apiVersion: config.altTextApiVersion,
  maxChars: Number(config.altTextMaxChars) || 125
})

const hasRequiredAltTextConfig = (altTextConfig) => {
  return Boolean(
    altTextConfig.enabled &&
    altTextConfig.endpoint &&
    altTextConfig.apiKey &&
    altTextConfig.deployment
  )
}

const buildAltTextUrl = ({ endpoint, deployment, apiVersion }) => {
  const trimmedEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
  return `${trimmedEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
}

const sanitizeAltText = (value, maxChars) => {
  const compactText = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!compactText) {
    return null
  }

  return compactText.slice(0, Math.max(maxChars, 1))
}

const extractAltTextFromResponse = (resultBody, maxChars) => {
  const firstChoice = resultBody?.choices?.[0]
  const content = firstChoice?.message?.content

  if (typeof content === 'string') {
    return sanitizeAltText(content, maxChars)
  }

  if (Array.isArray(content)) {
    const textParts = content
      .filter(part => part?.type === 'text' && part?.text)
      .map(part => part.text)
      .join(' ')

    return sanitizeAltText(textParts, maxChars)
  }

  return null
}

const buildRequestBody = (imageBase64, maxChars) => ({
  messages: [
    {
      role: 'system',
      content: `You generate accessible alt text for incident-report images. Keep response under ${maxChars} characters, factual, and concise.`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Generate one alt text sentence for this image. Do not guess details you cannot see.' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
  ],
  max_completion_tokens: 80,
  temperature: 0.2
})

const generateAltTextFromFoundry = async (imageBase64, altTextConfig) => {
  const response = await fetch(buildAltTextUrl(altTextConfig), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': altTextConfig.apiKey
    },
    body: JSON.stringify(buildRequestBody(imageBase64, altTextConfig.maxChars))
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Foundry alt text failed with ${response.status}: ${responseText}`)
  }

  const responseBody = await response.json()
  const altText = extractAltTextFromResponse(responseBody, altTextConfig.maxChars)

  if (!altText) {
    throw new Error('Foundry alt text response did not contain usable text')
  }

  return altText
}

const getImageAsBase64 = async (containerClient, image) => {
  if (image.aiCheckerImage) {
    return image.aiCheckerImage
  }

  const blobBuffer = await containerClient.getBlobClient(image.finalFilename).downloadToBuffer()
  return blobBuffer.toString('base64')
}

const generateSingleAltText = async (containerClient, image, altTextConfig) => {
  try {
    const imageBase64 = await getImageAsBase64(containerClient, image)
    const altText = await generateAltTextFromFoundry(imageBase64, altTextConfig)

    return {
      altText,
      source: 'foundry',
      skipped: false
    }
  } catch (error) {
    console.log(`Foundry alt text failed for ${image.finalFilename}: ${error.message}`)
    return {
      altText: FALLBACK_ALT_TEXT,
      source: 'fallback',
      skipped: false,
      error: 'Foundry alt text failed'
    }
  }
}

const generate = async (thumbnails = []) => {
  const altTextConfig = getAltTextConfig()

  if (!hasRequiredAltTextConfig(altTextConfig) || thumbnails.length === 0) {
    return { success: true, skipped: true, response: [] }
  }

  const uploadContainerClient = await getUploadContainerClient()

  if (!uploadContainerClient) {
    return { success: true, skipped: true, response: [] }
  }

  const response = await Promise.all(
    thumbnails.map(image => generateSingleAltText(uploadContainerClient, image, altTextConfig))
  )

  return {
    success: true,
    skipped: false,
    response
  }
}

export default {
  generate,
  sanitizeAltText,
  extractAltTextFromResponse
}

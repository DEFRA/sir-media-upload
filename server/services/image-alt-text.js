import { AzureOpenAI } from 'openai'
import config from '../utils/config.js'

const MAX_ALT_TEXT_LENGTH = 125
const SOURCE = 'azure-openai'

const createClient = () => {
  if (!config.azureOpenAiEndpoint || !config.azureOpenAiKey) {
    return null
  }

  return new AzureOpenAI({
    endpoint: config.azureOpenAiEndpoint,
    apiKey: config.azureOpenAiKey,
    apiVersion: config.azureOpenAiApiVersion
  })
}

const cleanAltText = (text = '') => {
  const collapsed = text.replace(/\s+/g, ' ').trim()

  if (!collapsed) {
    return null
  }

  if (collapsed.length <= MAX_ALT_TEXT_LENGTH) {
    return collapsed
  }

  return `${collapsed.slice(0, MAX_ALT_TEXT_LENGTH - 1)}…`
}

const generateAltText = async (imageBuffer, mimeType = 'image/jpeg') => {
  const client = createClient()

  if (!client || !imageBuffer?.length) {
    return {
      skipped: true,
      altText: null,
      confidence: null,
      source: SOURCE
    }
  }

  try {
    const response = await client.chat.completions.create({
      model: config.azureOpenAiModel,
      temperature: 0.2,
      max_tokens: 60,
      messages: [
        {
          role: 'system',
          content: 'Write one concise sentence of accessibility alt text that describes the image. Keep it factual and 125 characters or less.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Generate alt text for this uploaded image.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBuffer.toString('base64')}`
              }
            }
          ]
        }
      ]
    })

    const rawAltText = response.choices?.[0]?.message?.content || ''

    return {
      skipped: false,
      altText: cleanAltText(rawAltText),
      confidence: null,
      source: SOURCE
    }
  } catch (err) {
    console.log(`Azure OpenAI alt text generation failed: ${err.message}`)

    return {
      skipped: false,
      altText: null,
      confidence: null,
      source: SOURCE
    }
  }
}

export default {
  generateAltText
}

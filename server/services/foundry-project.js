import wreck from '@hapi/wreck'
import { DefaultAzureCredential } from '@azure/identity'
import config from '../utils/config.js'

const credential = new DefaultAzureCredential()
const CONNECTION_TIMEOUT_MS = 5000
const TOKEN_SCOPE = 'https://ai.azure.com/.default'

const getAccessToken = async () => {
  const controller = new AbortController()
  let tokenTimeout
  let accessToken
  try {
    accessToken = await Promise.race([
      credential.getToken(TOKEN_SCOPE, { abortSignal: controller.signal }),
      new Promise((resolve, reject) => {
        tokenTimeout = setTimeout(() => {
          controller.abort()
          reject(new Error('Foundry access token request timed out after 5 seconds'))
        }, CONNECTION_TIMEOUT_MS)
      })
    ])
  } finally {
    clearTimeout(tokenTimeout)
  }
  if (!accessToken?.token) {
    throw new Error('No access token returned for Foundry project connection')
  }
  return accessToken.token
}

const getResponseText = response => (response.output ?? [])
  .filter(item => item.type === 'message')
  .flatMap(item => item.content ?? [])
  .filter(content => content.type === 'output_text')
  .map(content => content.text)
  .join('')

const analyzeImage = async imageBuffer => {
  if (!config.azureAIModelDeploymentName) {
    throw new Error('Set AZURE_AI_MODEL_DEPLOYMENT_NAME to an image-capable Foundry deployment.')
  }

  const endpoint = new URL(
    'openai/v1/responses',
    `${config.azureAIProjectEndpoint.replace(/\/+$/, '')}/`
  )
  const accessToken = await getAccessToken()
  const imageType = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 ? 'image/jpeg' : 'image/png'

  const response = await wreck.post(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      model: config.azureAIModelDeploymentName,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Describe the visible contents of this image. Return JSON with caption (string), tags (array of strings), and objects (array of strings). Do not include confidence scores.'
          },
          {
            type: 'input_image',
            image_url: `data:${imageType};base64,${imageBuffer.toString('base64')}`
          }
        ]
      }],
      text: { format: { type: 'json_object' } },
      store: false
    }),
    json: true
  })

  const rawResponse = getResponseText(response.payload)
  if (!rawResponse) {
    throw new Error('No text was returned by the Foundry model.')
  }

  const result = JSON.parse(rawResponse)
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The Foundry model returned an invalid analysis response.')
  }

  return {
    caption: typeof result.caption === 'string' ? result.caption : '',
    tags: Array.isArray(result.tags) ? result.tags.filter(tag => typeof tag === 'string') : [],
    objects: Array.isArray(result.objects) ? result.objects.filter(object => typeof object === 'string') : [],
    rawResponse
  }
}

const checkConnection = async () => {
  const endpoint = new URL(
    'deployments',
    `${config.azureAIProjectEndpoint.replace(/\/+$/, '')}/`
  )
  endpoint.searchParams.set('api-version', 'v1')

  console.log('Checking Foundry project connection', { endpoint: endpoint.toString() })
  console.log('Requesting Foundry access token')
  const accessToken = await getAccessToken()

  console.log('Foundry access token acquired; requesting project deployments')
  const response = await wreck.get(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    },
    json: true,
    timeout: CONNECTION_TIMEOUT_MS
  })

  if (!Array.isArray(response.payload?.value)) {
    throw new Error('Unexpected response from Foundry project deployments API')
  }

  console.log('Foundry project connection succeeded', {
    deployments: response.payload.value,
    hasMoreDeployments: Boolean(response.payload.nextLink)
  })
  return response.payload
}

export default { checkConnection, analyzeImage }

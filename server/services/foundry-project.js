import { AIProjectClient } from '@azure/ai-projects'
import { DefaultAzureCredential } from '@azure/identity'
import config from '../utils/config.js'

const credential = new DefaultAzureCredential()
const projectClients = new Map()

const getProjectClient = () => {
  const endpoint = config.azureAIProjectEndpoint
  if (!endpoint) {
    throw new Error('The Foundry project endpoint is not configured.')
  }

  if (!projectClients.has(endpoint)) {
    projectClients.set(endpoint, new AIProjectClient(endpoint, credential))
  }

  return projectClients.get(endpoint)
}

const analyzeImage = async imageBuffer => {
  if (!config.azureAIModelDeploymentName) {
    throw new Error('Set AZURE_AI_MODEL_DEPLOYMENT_NAME to an image-capable Foundry deployment.')
  }

  const imageType = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 ? 'image/jpeg' : 'image/png'
  const response = await getProjectClient().getOpenAIClient().responses.create({
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
  })

  const rawResponse = response.output_text
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
  const deployments = []
  for await (const deployment of getProjectClient().deployments.list()) {
    deployments.push(deployment)
  }
  return deployments
}

export default { checkConnection, analyzeImage }

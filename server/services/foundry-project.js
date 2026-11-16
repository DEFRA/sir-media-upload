import wreck from '@hapi/wreck'
import { DefaultAzureCredential } from '@azure/identity'
import config from '../utils/config.js'

const credential = new DefaultAzureCredential()
const CONNECTION_TIMEOUT_MS = 5000

const checkConnection = async () => {
  const endpoint = new URL(
    'deployments',
    `${config.azureAIProjectEndpoint.replace(/\/+$/, '')}/`
  )
  endpoint.searchParams.set('api-version', 'v1')

  console.log('Checking Foundry project connection', { endpoint: endpoint.toString() })
  console.log('Requesting Foundry access token')
  const controller = new AbortController()
  let tokenTimeout
  let accessToken
  try {
    accessToken = await Promise.race([
      credential.getToken('https://ai.azure.com/.default', { abortSignal: controller.signal }),
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

  console.log('Foundry access token acquired; requesting project deployments')
  const response = await wreck.get(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
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

export default { checkConnection }

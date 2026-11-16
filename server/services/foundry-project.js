import wreck from '@hapi/wreck'
import { DefaultAzureCredential } from '@azure/identity'
import config from '../utils/config.js'

const credential = new DefaultAzureCredential()

const checkConnection = async () => {
  const endpoint = new URL(
    'deployments',
    `${config.azureAIProjectEndpoint.replace(/\/+$/, '')}/`
  )
  endpoint.searchParams.set('api-version', 'v1')

  console.log('Checking Foundry project connection', { endpoint: endpoint.toString() })
  const accessToken = await credential.getToken('https://ai.azure.com/.default')
  if (!accessToken?.token) {
    throw new Error('No access token returned for Foundry project connection')
  }

  const response = await wreck.get(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      Accept: 'application/json'
    },
    json: true
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

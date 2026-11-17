import foundryProject from '../foundry-project.js'
import { AIProjectClient } from '@azure/ai-projects'
import config from '../../utils/config.js'

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'test-token' })
  }))
}))

jest.mock('@azure/ai-projects', () => ({
  AIProjectClient: jest.fn()
}))

const mockOpenAIClient = {
  responses: {
    create: jest.fn()
  }
}

const mockProjectClient = {
  getOpenAIClient: jest.fn().mockReturnValue(mockOpenAIClient),
  deployments: {
    list: jest.fn()
  }
}

const rawResponse = JSON.stringify({
  caption: 'A river',
  tags: ['river', 'water'],
  objects: ['river']
})

describe('foundry-project image analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.azureAIProjectEndpoint = 'https://foundry.example.test/api/projects/test-project'
    config.azureAIModelDeploymentName = 'test-vision-deployment'
    AIProjectClient.mockImplementation(() => mockProjectClient)
    mockProjectClient.getOpenAIClient.mockReturnValue(mockOpenAIClient)
    mockOpenAIClient.responses.create.mockResolvedValue({ output_text: rawResponse })
  })

  it('uses the Foundry SDK client to send an image and parses its result', async () => {
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    const result = await foundryProject.analyzeImage(imageBuffer)

    expect(AIProjectClient).toHaveBeenCalledWith(
      'https://foundry.example.test/api/projects/test-project',
      expect.anything()
    )
    const payload = mockOpenAIClient.responses.create.mock.calls[0][0]
    expect(payload.model).toBe('test-vision-deployment')
    expect(payload.input[0].content[1].image_url).toBe(`data:image/png;base64,${imageBuffer.toString('base64')}`)
    expect(payload.store).toBe(false)
    expect(payload.text.format.type).toBe('json_object')
    expect(result).toEqual({
      caption: 'A river',
      tags: ['river', 'water'],
      objects: ['river'],
      rawResponse
    })
  })

  it('requires a configured model deployment', async () => {
    config.azureAIModelDeploymentName = undefined
    await expect(foundryProject.analyzeImage(Buffer.from('image')))
      .rejects.toThrow('AZURE_AI_MODEL_DEPLOYMENT_NAME')
    expect(mockOpenAIClient.responses.create).not.toHaveBeenCalled()
  })
})

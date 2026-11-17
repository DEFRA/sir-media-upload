import foundryProject from '../foundry-project.js'
import wreck from '@hapi/wreck'
import config from '../../utils/config.js'

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'test-token' })
  }))
}))

jest.mock('@hapi/wreck', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn()
  }
}))

describe('foundry-project image analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.azureAIProjectEndpoint = 'https://foundry.example.test/api/projects/test-project'
    config.azureAIModelDeploymentName = 'test-vision-deployment'
    wreck.post.mockResolvedValue({
      payload: {
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            text: JSON.stringify({
              caption: 'A river',
              tags: ['river', 'water'],
              objects: ['river']
            })
          }]
        }]
      }
    })
  })

  it('sends an image to the configured project deployment and parses its result', async () => {
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    const result = await foundryProject.analyzeImage(imageBuffer)

    expect(wreck.post).toHaveBeenCalledWith(
      'https://foundry.example.test/api/projects/test-project/openai/v1/responses',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        json: true
      })
    )
    const payload = JSON.parse(wreck.post.mock.calls[0][1].payload)
    expect(payload.model).toBe('test-vision-deployment')
    expect(payload.input[0].content[1].image_url).toBe(`data:image/png;base64,${imageBuffer.toString('base64')}`)
    expect(payload.store).toBe(false)
    expect(result).toEqual({
      caption: 'A river',
      tags: ['river', 'water'],
      objects: ['river'],
      rawResponse: JSON.stringify({ caption: 'A river', tags: ['river', 'water'], objects: ['river'] })
    })
  })

  it('requires a configured model deployment', async () => {
    config.azureAIModelDeploymentName = undefined
    await expect(foundryProject.analyzeImage(Buffer.from('image')))
      .rejects.toThrow('AZURE_AI_MODEL_DEPLOYMENT_NAME')
    expect(wreck.post).not.toHaveBeenCalled()
  })
})

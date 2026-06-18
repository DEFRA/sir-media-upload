import imageAltText from '../image-alt-text.js'
import { AzureOpenAI } from 'openai'
import config from '../../utils/config.js'

jest.mock('openai', () => ({
  AzureOpenAI: jest.fn()
}))

describe('image-alt-text', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.azureOpenAiEndpoint = 'https://sir-media-test.cognitiveservices.azure.com/'
    config.azureOpenAiKey = 'test-openai-key'
    config.azureOpenAiApiVersion = '2024-10-21'
    config.azureOpenAiModel = 'gpt-4o-mini'
  })

  it('returns skipped when endpoint is missing', async () => {
    config.azureOpenAiEndpoint = ''

    const result = await imageAltText.generateAltText(Buffer.from('image'))

    expect(result).toEqual({
      skipped: true,
      altText: null,
      confidence: null,
      source: 'azure-openai'
    })
  })

  it('creates AzureOpenAI client and returns cleaned alt text', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '  A person standing next to a damaged car on a road.  '
          }
        }
      ]
    })

    AzureOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create
        }
      }
    }))

    const result = await imageAltText.generateAltText(Buffer.from('image-bytes'), 'image/jpeg')

    expect(AzureOpenAI).toHaveBeenCalledWith({
      endpoint: 'https://sir-media-test.cognitiveservices.azure.com/',
      apiKey: 'test-openai-key',
      apiVersion: '2024-10-21'
    })
    expect(create).toHaveBeenCalled()
    expect(result.altText).toBe('A person standing next to a damaged car on a road.')
    expect(result.source).toBe('azure-openai')
  })

  it('returns null altText when Azure call fails', async () => {
    const create = jest.fn().mockRejectedValue(new Error('network error'))

    AzureOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create
        }
      }
    }))

    const result = await imageAltText.generateAltText(Buffer.from('image-bytes'), 'image/jpeg')

    expect(result).toEqual({
      skipped: false,
      altText: null,
      confidence: null,
      source: 'azure-openai'
    })
  })
})

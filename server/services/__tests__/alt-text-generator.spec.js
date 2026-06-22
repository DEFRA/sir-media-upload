import altTextGenerator from '../alt-text-generator.js'
import * as blobStorage from '../blob-storage.js'
import config from '../../utils/config.js'

jest.mock('../blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

const createContainer = (buffer = Buffer.from('image-data')) => ({
  getBlobClient: jest.fn().mockReturnValue({
    downloadToBuffer: jest.fn().mockResolvedValue(buffer)
  })
})

describe('alt-text-generator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()

    config.altTextEnabled = true
    config.foundryAltTextEndpoint = 'https://test-foundry.openai.azure.com'
    config.foundryAltTextApiKey = 'test-api-key'
    config.foundryAltTextDeployment = 'gpt-4o-mini'
    config.foundryAltTextApiVersion = '2025-01-01-preview'
    config.foundryAltTextMaxChars = 125
  })

  afterEach(() => {
    delete global.fetch
  })

  it('returns skipped when feature is disabled', async () => {
    config.altTextEnabled = false
    const result = await altTextGenerator.generate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true, response: [] })
  })

  it('returns skipped when required config is missing', async () => {
    config.foundryAltTextDeployment = ''
    const result = await altTextGenerator.generate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true, response: [] })
  })

  it('uses aiCheckerImage directly when available', async () => {
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Image of road flooding' } }]
      })
    })

    const aiCheckerImage = Buffer.from('pre-encoded').toString('base64')
    const result = await altTextGenerator.generate([{ finalFilename: 'a.jpg', aiCheckerImage }])

    expect(result.response[0].altText).toBe('Image of road flooding')
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(requestBody.messages[1].content[1].image_url.url.endsWith(aiCheckerImage)).toBe(true)
  })

  it('downloads blob when aiCheckerImage is absent', async () => {
    const container = createContainer(Buffer.from('downloaded-image'))
    blobStorage.getUploadContainerClient.mockResolvedValue(container)
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Image showing debris on carriageway' } }]
      })
    })

    const result = await altTextGenerator.generate([{ finalFilename: 'a.jpg' }])

    expect(result.response[0].altText).toBe('Image showing debris on carriageway')
    expect(container.getBlobClient).toHaveBeenCalledWith('a.jpg')
  })

  it('falls back after retries fail', async () => {
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    global.fetch.mockRejectedValue(new Error('network down'))

    const result = await altTextGenerator.generate([{ finalFilename: 'a.jpg' }])

    expect(result.response[0].altText).toBe('User submitted image')
    expect(result.response[0].source).toBe('fallback')
  })

  it('sanitizes and truncates returned alt text', () => {
    const altText = altTextGenerator.sanitizeAltText('  A long   description   ', 8)
    expect(altText).toBe('A long d')
  })
})

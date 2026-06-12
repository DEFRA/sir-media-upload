import imageChecker from '../image-checker.js'
import * as blobStorage from '../blob-storage.js'
import ContentSafetyClient, { isUnexpected } from '@azure-rest/ai-content-safety'
import { AzureKeyCredential } from '@azure/core-auth'
import config from '../../utils/config.js'

jest.mock('../blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

jest.mock('@azure-rest/ai-content-safety', () => ({
  __esModule: true,
  default: jest.fn(),
  isUnexpected: jest.fn()
}))

jest.mock('@azure/core-auth', () => ({
  AzureKeyCredential: jest.fn()
}))

const createClient = ({ postResult, unexpected = false } = {}) => {
  const mockPost = jest.fn().mockResolvedValue(postResult || { body: { categoriesAnalysis: [] } })
  const mockPath = jest.fn().mockReturnValue({ post: mockPost })
  ContentSafetyClient.mockReturnValue({ path: mockPath })
  isUnexpected.mockReturnValue(unexpected)
  return { mockPost, mockPath }
}

const createContainer = (buffer = Buffer.from('image-data')) => ({
  getBlobClient: jest.fn().mockReturnValue({
    downloadToBuffer: jest.fn().mockResolvedValue(buffer)
  })
})

describe('image-checker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.contentSafetyEndpoint = 'https://example.cognitiveservices.azure.com/'
    config.contentSafetyKey = 'test-content-safety-key'
  })

  it('returns skipped when thumbnails are empty', async () => {
    const result = await imageChecker.validate([])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('returns skipped when content safety endpoint is missing', async () => {
    config.contentSafetyEndpoint = ''
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('returns skipped when content safety key is missing', async () => {
    config.contentSafetyKey = ''
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('returns skipped when blob container is unavailable', async () => {
    createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(null)
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('creates azure key credential from config key', async () => {
    createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(AzureKeyCredential).toHaveBeenCalledWith('test-content-safety-key')
  })

  it('calls content safety image analyze path', async () => {
    const { mockPath } = createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(mockPath).toHaveBeenCalledWith('/image:analyze')
  })

  it('fetches blob content when aiCheckerImage is absent', async () => {
    const container = createContainer()
    createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(container)
    await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(container.getBlobClient).toHaveBeenCalledWith('a.jpg')
  })

  it('uses aiCheckerImage when present', async () => {
    const { mockPost } = createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const aiCheckerImage = Buffer.from('ai-ready').toString('base64')
    await imageChecker.validate([{ finalFilename: 'a.jpg', aiCheckerImage }])
    expect(mockPost.mock.calls[0][0].body.image.content).toBe(aiCheckerImage)
  })

  it('returns severityScores with all categories at 0 when nothing detected', async () => {
    createClient({
      postResult: {
        body: {
          categoriesAnalysis: [
            { category: 'Hate', severity: 0 },
            { category: 'Sexual', severity: 0 },
            { category: 'SelfHarm', severity: 0 },
            { category: 'Violence', severity: 0 }
          ]
        }
      }
    })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:0, Sexual:0, SelfHarm:0, Violence:0')
  })

  it('returns severityScores with category values', async () => {
    createClient({ postResult: { body: { categoriesAnalysis: [{ category: 'Hate', severity: 4 }] } } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:4')
  })

  it('sets shouldBlockAny true when a blocked category exists', async () => {
    createClient({ postResult: { body: { categoriesAnalysis: [{ category: 'Hate', severity: 4 }] } } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.shouldBlockAny).toBe(true)
  })

  it('sets shouldBlockAny false when only violence review severity exists', async () => {
    createClient({ postResult: { body: { categoriesAnalysis: [{ category: 'Violence', severity: 4 }] } } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.shouldBlockAny).toBe(false)
  })

  it('sets shouldBlock true when AI fail severity is present', () => {
    const result = imageChecker.shouldBlockImage({ categoriesAnalysis: [{ category: 'Any', severity: 8 }] })
    expect(result).toBe(true)
  })

  it('sets shouldBlock false for low severity categories', () => {
    const result = imageChecker.shouldBlockImage({ categoriesAnalysis: [{ category: 'Hate', severity: 2 }] })
    expect(result).toBe(false)
  })

  it('handles unexpected content safety response as ai fail', async () => {
    createClient({ postResult: { body: { message: 'bad' } }, unexpected: true })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('retries content safety call on first failure then succeeds', async () => {
    const mockPost = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ body: { categoriesAnalysis: [{ category: 'Hate', severity: 2 }] } })
    const mockPath = jest.fn().mockReturnValue({ post: mockPost })
    ContentSafetyClient.mockReturnValue({ path: mockPath })
    isUnexpected.mockReturnValue(false)
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:2')
  })

  it('returns ai fail after 3 failed retry attempts', async () => {
    const mockPost = jest.fn().mockRejectedValue(new Error('service unavailable'))
    const mockPath = jest.fn().mockReturnValue({ post: mockPost })
    ContentSafetyClient.mockReturnValue({ path: mockPath })
    isUnexpected.mockReturnValue(false)
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('returns non-skipped successful validation result', async () => {
    createClient()
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.success && !result.skipped).toBe(true)
  })

  it('logs content safety severity scores during validation', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    const mockPost = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ body: { categoriesAnalysis: [{ category: 'Hate', severity: 4 }] } })
    const mockPath = jest.fn().mockReturnValue({ post: mockPost })
    ContentSafetyClient.mockReturnValue({ path: mockPath })
    isUnexpected.mockReturnValue(false)
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    await imageChecker.validate([{ finalFilename: 'test-image.jpg' }])
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Content Safety API attempt 1/3 failed for test-image.jpg')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Content Safety severity scores for test-image.jpg: Hate:4')
    )
    consoleSpy.mockRestore()
  })

  it('returns AIFail after all retry attempts fail', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    const mockPost = jest.fn().mockRejectedValue(new Error('service unavailable'))
    const mockPath = jest.fn().mockReturnValue({ post: mockPost })
    ContentSafetyClient.mockReturnValue({ path: mockPath })
    isUnexpected.mockReturnValue(false)
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'test-image.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Content Safety severity scores for test-image.jpg: AIFail:8')
    )
    consoleSpy.mockRestore()
  })

  it('sets shouldBlock false when violence category at review severity', () => {
    const result = imageChecker.shouldBlockImage({ categoriesAnalysis: [{ category: 'Violence', severity: 6 }] })
    expect(result).toBe(false)
  })

  it('sets shouldBlock true when non-violence category at review severity', () => {
    const result = imageChecker.shouldBlockImage({ categoriesAnalysis: [{ category: 'Sexual', severity: 6 }] })
    expect(result).toBe(true)
  })

  it('returns false when shouldBlockImage called with no arguments', () => {
    expect(imageChecker.shouldBlockImage()).toBe(false)
  })

  it('blocks when category property is missing at review severity', () => {
    const result = imageChecker.shouldBlockImage({ categoriesAnalysis: [{ severity: 4 }] })
    expect(result).toBe(true)
  })

  it('handles response body without categoriesAnalysis', async () => {
    createClient({ postResult: { body: {} } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('returns ai fail when validateWithRetry maxRetries is explicitly set', async () => {
    const mockPost = jest.fn().mockRejectedValue(new Error('fail'))
    const mockPath = jest.fn().mockReturnValue({ post: mockPost })
    const mockClient = { path: mockPath }
    const container = createContainer()
    const result = await imageChecker.validateWithRetry(
      container,
      { finalFilename: 'a.jpg' },
      mockClient,
      1
    )
    expect(result.severityScores).toBe('AIFail:8')
  })
})

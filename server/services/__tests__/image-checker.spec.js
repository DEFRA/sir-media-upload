import imageChecker from '../image-checker.js'
import * as blobStorage from '../blob-storage.js'
import wreck from '@hapi/wreck'
import config from '../../utils/config.js'

jest.mock('../blob-storage.js', () => ({
  getUploadContainerClient: jest.fn()
}))

jest.mock('@hapi/wreck', () => ({
  __esModule: true,
  default: {
    post: jest.fn()
  }
}))

const createContainer = (buffer = Buffer.from('image-data')) => ({
  getBlobClient: jest.fn().mockReturnValue({
    downloadToBuffer: jest.fn().mockResolvedValue(buffer)
  })
})

const mockTokenCall = (accessToken = 'fake-token') => {
  wreck.post.mockResolvedValueOnce({ payload: { access_token: accessToken } })
}

const mockImageAnalyzeCall = (categoriesAnalysis = []) => {
  wreck.post.mockResolvedValueOnce({ payload: { categoriesAnalysis } })
}

describe('image-checker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    config.apimAIScope = 'api://scope/.default'
    config.apimAIClientId = 'client-id'
    config.apimAISecret = 'client-secret'
    config.apimAITenantId = 'tenant-id'
    config.apimAIEndpoint = 'example-apim.contoso.net'
  })

  it('returns skipped when thumbnails are empty', async () => {
    const result = await imageChecker.validate([])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('returns skipped when access token cannot be acquired', async () => {
    wreck.post.mockRejectedValueOnce(new Error('token failure'))
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('returns skipped when blob container is unavailable', async () => {
    blobStorage.getUploadContainerClient.mockResolvedValue(null)
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result).toEqual({ success: true, skipped: true })
  })

  it('calls token endpoint and APIM image analyze endpoint', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([])
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(wreck.post).toHaveBeenCalledTimes(2)
  })

  it('fetches blob content when aiCheckerImage is absent', async () => {
    const container = createContainer()
    mockTokenCall()
    mockImageAnalyzeCall([])
    blobStorage.getUploadContainerClient.mockResolvedValue(container)
    await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(container.getBlobClient).toHaveBeenCalledWith('a.jpg')
  })

  it('uses aiCheckerImage when present', async () => {
    const container = createContainer()
    mockTokenCall()
    mockImageAnalyzeCall([])
    blobStorage.getUploadContainerClient.mockResolvedValue(container)
    const aiCheckerImage = Buffer.from('ai-ready').toString('base64')
    await imageChecker.validate([{ finalFilename: 'a.jpg', aiCheckerImage }])
    expect(container.getBlobClient).not.toHaveBeenCalled()

    const imageAnalyzeCallArgs = wreck.post.mock.calls[1]
    const payload = JSON.parse(imageAnalyzeCallArgs[1].payload)
    expect(payload.image.content).toBe(aiCheckerImage)
  })

  it('returns severityScores with all categories at 0 when nothing detected', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([
      { category: 'Hate', severity: 0 },
      { category: 'Sexual', severity: 0 },
      { category: 'SelfHarm', severity: 0 },
      { category: 'Violence', severity: 0 }
    ])
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:0, Sexual:0, SelfHarm:0, Violence:0')
  })

  it('returns severityScores with category values', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([{ category: 'Hate', severity: 4 }])
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:4')
  })

  it('sets shouldBlockAny true when non-violence review severity exists', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([{ category: 'Hate', severity: 4 }])
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.shouldBlockAny).toBe(true)
  })

  it('sets shouldBlockAny false when only violence review severity exists', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([{ category: 'Violence', severity: 4 }])
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
    mockTokenCall()
    wreck.post.mockResolvedValueOnce({ payload: { message: 'bad' } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('retries content safety call on first failure then succeeds', async () => {
    mockTokenCall()
    wreck.post
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ payload: { categoriesAnalysis: [{ category: 'Hate', severity: 2 }] } })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('Hate:2')
  })

  it('returns ai fail after 3 failed retry attempts', async () => {
    mockTokenCall()
    wreck.post.mockRejectedValue(new Error('service unavailable'))
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('returns non-skipped successful validation result', async () => {
    mockTokenCall()
    mockImageAnalyzeCall([])
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.success && !result.skipped).toBe(true)
  })

  it('logs content safety severity scores during validation', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    mockTokenCall()
    wreck.post
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ payload: { categoriesAnalysis: [{ category: 'Hate', severity: 4 }] } })
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
    mockTokenCall()
    wreck.post.mockRejectedValue(new Error('service unavailable'))
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
    mockTokenCall()
    wreck.post.mockResolvedValueOnce({ payload: {} })
    blobStorage.getUploadContainerClient.mockResolvedValue(createContainer())
    const result = await imageChecker.validate([{ finalFilename: 'a.jpg' }])
    expect(result.response[0].severityScores).toBe('AIFail:8')
  })

  it('returns ai fail when validateWithRetry maxRetries is explicitly set', async () => {
    wreck.post.mockRejectedValue(new Error('fail'))
    const container = createContainer()
    const result = await imageChecker.validateWithRetry(
      container,
      { finalFilename: 'a.jpg' },
      'fake-token',
      1
    )
    expect(result.severityScores).toBe('AIFail:8')
  })
})

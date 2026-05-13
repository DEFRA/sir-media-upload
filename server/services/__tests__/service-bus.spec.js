import { ServiceBusClient } from '@azure/service-bus'
import { sendMessage } from '../service-bus.js'

jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn()
}))

const createTestContext = () => {
  const logger = {
    info: jest.fn()
  }

  const message = {
    mediaUpload: {
      sessionId: 'session-123'
    }
  }

  const mockBatch = {
    tryAddMessage: jest.fn()
  }

  const mockSender = {
    createMessageBatch: jest.fn().mockResolvedValue(mockBatch),
    sendMessages: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }

  const createSender = jest.fn().mockReturnValue(mockSender)
  ServiceBusClient.mockImplementation(() => ({ createSender }))

  return {
    logger,
    message,
    mockBatch,
    mockSender,
    createSender
  }
}

describe('service-bus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses service bus connection string', async () => {
    const { logger, message } = createTestContext()
    await sendMessage(logger, message)
    expect(ServiceBusClient).toHaveBeenCalledWith('testConnectionString')
  })

  it('uses default queue name when no suffix is provided', async () => {
    const { logger, message, createSender } = createTestContext()
    await sendMessage(logger, message)
    expect(createSender).toHaveBeenCalledWith('testQueueName')
  })

  it('uses suffixed queue name when queueSuffix is provided', async () => {
    const { logger, message, createSender } = createTestContext()
    await sendMessage(logger, message, '-testSuffix')
    expect(createSender).toHaveBeenCalledWith('testQueueName-testSuffix')
  })

  it('creates a message batch once', async () => {
    const { logger, message, mockSender } = createTestContext()
    await sendMessage(logger, message)
    expect(mockSender.createMessageBatch).toHaveBeenCalledTimes(1)
  })

  it('adds the payload to the batch body', async () => {
    const { logger, message, mockBatch } = createTestContext()
    await sendMessage(logger, message)
    expect(mockBatch.tryAddMessage).toHaveBeenCalledWith({ body: message })
  })

  it('sends the created batch', async () => {
    const { logger, message, mockBatch, mockSender } = createTestContext()
    await sendMessage(logger, message)
    expect(mockSender.sendMessages).toHaveBeenCalledWith(mockBatch)
  })

  it('closes sender after sending', async () => {
    const { logger, message, mockSender } = createTestContext()
    await sendMessage(logger, message)
    expect(mockSender.close).toHaveBeenCalledTimes(1)
  })

  // it('logs queue target and payload', async () => {
  //   const { logger, message } = createTestContext()
  //   await sendMessage(logger, message, '-testSuffix')
  //   expect(logger.info).toHaveBeenCalledWith(
  //     'service-bus.js:sendMessage {"mediaUpload":{"sessionId":"session-123"}} to service bus testQueueName-testSuffix'
  //   )
  // })
})

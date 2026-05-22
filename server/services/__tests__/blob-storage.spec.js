import { BlobServiceClient } from '@azure/storage-blob'
import { ManagedIdentityCredential } from '@azure/identity'
import { getUploadContainerClient, getThumbnailContainerClient, moveBlobToFolder } from '../blob-storage.js'

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn()
}))

jest.mock('@azure/identity', () => ({
  ManagedIdentityCredential: jest.fn()
}))

describe('blob-storage', () => {
  const setupServiceClient = () => {
    process.env.AZURE_BLOB_SERVICE_URL = 'https://blob-storage-url'

    const createIfNotExists = jest.fn().mockResolvedValue(undefined)
    const uploadContainerClient = { createIfNotExists }
    const thumbnailContainerClient = { createIfNotExists }

    const getContainerClient = jest.fn((name) => {
      if (name === 'sir-media-uploads-thumbnails') {
        return thumbnailContainerClient
      }
      return uploadContainerClient
    })

    BlobServiceClient.mockImplementation(() => ({ getContainerClient }))

    return {
      createIfNotExists,
      uploadContainerClient,
      thumbnailContainerClient,
      getContainerClient
    }
  }

  beforeEach(() => {
    delete getUploadContainerClient.cachedClient
    delete getThumbnailContainerClient.cachedClient
    jest.clearAllMocks()
  })

  it('returns upload container client', async () => {
    const { uploadContainerClient } = setupServiceClient()
    const result = await getUploadContainerClient()
    expect(result).toBe(uploadContainerClient)
  })

  it('returns thumbnail container client', async () => {
    const { thumbnailContainerClient } = setupServiceClient()
    const result = await getThumbnailContainerClient()
    expect(result).toBe(thumbnailContainerClient)
  })

  it('creates upload container once when cached', async () => {
    const { createIfNotExists } = setupServiceClient()
    await getUploadContainerClient()
    await getUploadContainerClient()
    expect(createIfNotExists).toHaveBeenCalledTimes(1)
  })

  it('creates thumbnail container once when cached', async () => {
    const { createIfNotExists } = setupServiceClient()
    await getThumbnailContainerClient()
    await getThumbnailContainerClient()
    expect(createIfNotExists).toHaveBeenCalledTimes(1)
  })

  it('uses ManagedIdentityCredential for storage auth', async () => {
    const createIfNotExists = jest.fn().mockResolvedValue(undefined)
    const uploadContainerClient = { createIfNotExists }
    const getContainerClient = jest.fn(() => uploadContainerClient)

    BlobServiceClient.mockImplementation(() => ({ getContainerClient }))

    delete getUploadContainerClient.cachedClient
    await getUploadContainerClient()

    expect(ManagedIdentityCredential).toHaveBeenCalled()
  })

  it('moves blob to destination folder path', async () => {
    const beginCopyFromURL = jest.fn().mockResolvedValue({ pollUntilDone: jest.fn().mockResolvedValue(undefined) })
    const sourceBlob = { url: 'https://storage/sir-media-uploads/quarantine/a.jpg', deleteIfExists: jest.fn().mockResolvedValue(undefined) }
    const destBlob = { beginCopyFromURL }
    const containerClient = {
      getBlockBlobClient: jest.fn((blobPath) => (blobPath === 'quarantine/a.jpg' ? sourceBlob : destBlob))
    }
    const result = await moveBlobToFolder(containerClient, 'quarantine/a.jpg', 'cleared')
    expect(result).toBe('cleared/a.jpg')
  })

  it('copies from source blob url', async () => {
    const beginCopyFromURL = jest.fn().mockResolvedValue({ pollUntilDone: jest.fn().mockResolvedValue(undefined) })
    const sourceBlob = { url: 'https://storage/sir-media-uploads/quarantine/a.jpg', deleteIfExists: jest.fn().mockResolvedValue(undefined) }
    const destBlob = { beginCopyFromURL }
    const containerClient = {
      getBlockBlobClient: jest.fn((blobPath) => (blobPath === 'quarantine/a.jpg' ? sourceBlob : destBlob))
    }
    await moveBlobToFolder(containerClient, 'quarantine/a.jpg', 'cleared')
    expect(beginCopyFromURL).toHaveBeenCalledWith('https://storage/sir-media-uploads/quarantine/a.jpg')
  })

  it('deletes source blob after move', async () => {
    const deleteIfExists = jest.fn().mockResolvedValue(undefined)
    const beginCopyFromURL = jest.fn().mockResolvedValue({ pollUntilDone: jest.fn().mockResolvedValue(undefined) })
    const sourceBlob = { url: 'https://storage/sir-media-uploads/quarantine/a.jpg', deleteIfExists }
    const destBlob = { beginCopyFromURL }
    const containerClient = {
      getBlockBlobClient: jest.fn((blobPath) => (blobPath === 'quarantine/a.jpg' ? sourceBlob : destBlob))
    }
    await moveBlobToFolder(containerClient, 'quarantine/a.jpg', 'cleared')
    expect(deleteIfExists).toHaveBeenCalledTimes(1)
  })
})

import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import config from '../../utils/config.js'
import {
  getBlobServiceClient,
  getUploadContainerClient,
  moveBlobToFolder
} from '../blob-storage.js'

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn()
}))

jest.mock('@azure/storage-blob', () => ({
  BlobServiceClient: jest.fn(),
  StorageSharedKeyCredential: jest.fn()
}))

jest.mock('../../utils/config.js', () => ({
  __esModule: true,
  default: {
    blobServiceUrl: 'https://blob-storage-url',
    storageAccount: 'test-account',
    storageAccessKey: undefined,
    appPathPrefix: '/media'
  }
}))

const setupMocks = () => {
  const containerClient = {
    createIfNotExists: jest.fn().mockResolvedValue(undefined),
    getBlockBlobClient: jest.fn()
  }
  const blobServiceClient = {
    getContainerClient: jest.fn().mockReturnValue(containerClient)
  }
  BlobServiceClient.mockImplementation(() => blobServiceClient)
  DefaultAzureCredential.mockImplementation(() => ({}))
  StorageSharedKeyCredential.mockImplementation(() => ({}))
  return { containerClient, blobServiceClient }
}

describe('blob-storage', () => {
  beforeEach(() => {
    delete getBlobServiceClient.cachedClient
    delete getUploadContainerClient.cachedClient
    jest.clearAllMocks()
    config.storageAccessKey = undefined
  })

  describe('getBlobServiceClient', () => {
    describe('when called multiple times', () => {
      it('should return the same cached client', async () => {
        const { blobServiceClient } = setupMocks()

        const first = await getBlobServiceClient()
        const second = await getBlobServiceClient()

        expect(first).toBe(blobServiceClient)
        expect(second).toBe(blobServiceClient)
        expect(BlobServiceClient).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('getUploadContainerClient', () => {
    describe('when no storage access key is configured', () => {
      it('should use DefaultAzureCredential', async () => {
        setupMocks()

        await getUploadContainerClient()

        expect(DefaultAzureCredential).toHaveBeenCalled()
        expect(StorageSharedKeyCredential).not.toHaveBeenCalled()
      })
    })

    describe('when a storage access key is configured', () => {
      it('should use StorageSharedKeyCredential', async () => {
        setupMocks()
        config.storageAccessKey = 'test-key'

        await getUploadContainerClient()

        expect(StorageSharedKeyCredential).toHaveBeenCalledWith('test-account', 'test-key')
        expect(DefaultAzureCredential).not.toHaveBeenCalled()
      })
    })

    describe('when called for the first time', () => {
      it('should return the upload container client', async () => {
        const { containerClient, blobServiceClient } = setupMocks()

        const result = await getUploadContainerClient()

        expect(blobServiceClient.getContainerClient).toHaveBeenCalledWith('sir-media-uploads')
        expect(containerClient.createIfNotExists).toHaveBeenCalledTimes(1)
        expect(result).toBe(containerClient)
      })
    })

    describe('when called multiple times', () => {
      it('should return the same cached container client', async () => {
        setupMocks()

        const firstResult = await getUploadContainerClient()
        const secondResult = await getUploadContainerClient()

        expect(firstResult).toBe(secondResult)
      })

      it('should only create the container once', async () => {
        const { containerClient } = setupMocks()

        await getUploadContainerClient()
        await getUploadContainerClient()

        expect(containerClient.createIfNotExists).toHaveBeenCalledTimes(1)
      })

      it('should only instantiate BlobServiceClient once', async () => {
        setupMocks()

        await getUploadContainerClient()
        await getUploadContainerClient()

        expect(BlobServiceClient).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('moveBlobToFolder', () => {
    const createBlobMocks = (sourcePathPrefixes = ['original', 'uploads', 'temp', 'staging']) => {
      const copyPoller = { pollUntilDone: jest.fn().mockResolvedValue(undefined) }
      const sourceBlob = {
        url: 'https://blob-storage-url/container/source/file.jpg',
        deleteIfExists: jest.fn().mockResolvedValue(undefined)
      }
      const destBlob = { beginCopyFromURL: jest.fn().mockResolvedValue(copyPoller) }
      const containerClient = {
        getBlockBlobClient: jest.fn((path) =>
          sourcePathPrefixes.some((prefix) => path.startsWith(prefix)) ? sourceBlob : destBlob
        )
      }
      return { copyPoller, sourceBlob, destBlob, containerClient }
    }

    describe('when moving a blob to a new folder', () => {
      it('should return the destination path', async () => {
        const { containerClient } = createBlobMocks()

        const result = await moveBlobToFolder(containerClient, 'original/file.jpg', 'processed')

        expect(result).toBe('processed/file.jpg')
      })

      it('should copy from the source blob url', async () => {
        const { sourceBlob, destBlob, containerClient } = createBlobMocks()

        await moveBlobToFolder(containerClient, 'original/file.jpg', 'processed')

        expect(destBlob.beginCopyFromURL).toHaveBeenCalledWith(sourceBlob.url)
      })

      it('should delete the source blob after copying', async () => {
        const { sourceBlob, containerClient } = createBlobMocks()

        await moveBlobToFolder(containerClient, 'original/file.jpg', 'processed')

        expect(sourceBlob.deleteIfExists).toHaveBeenCalled()
      })

      it('should wait for the copy to complete before deleting', async () => {
        const { copyPoller, sourceBlob, containerClient } = createBlobMocks()
        const callOrder = []
        copyPoller.pollUntilDone.mockImplementation(() => { callOrder.push('poll'); return Promise.resolve() })
        sourceBlob.deleteIfExists.mockImplementation(() => { callOrder.push('delete'); return Promise.resolve() })

        await moveBlobToFolder(containerClient, 'original/file.jpg', 'processed')

        expect(callOrder).toEqual(['poll', 'delete'])
      })
    })

    describe('when the source path has multiple segments', () => {
      it('should only replace the first path segment with the destination folder', async () => {
        const { sourceBlob, destBlob } = createBlobMocks()
        const containerClient = {
          getBlockBlobClient: jest.fn((path) =>
            path === 'original/nested/deep/file.jpg' ? sourceBlob : destBlob
          )
        }

        const result = await moveBlobToFolder(containerClient, 'original/nested/deep/file.jpg', 'archived')

        expect(result).toBe('archived/nested/deep/file.jpg')
        expect(containerClient.getBlockBlobClient).toHaveBeenCalledWith('archived/nested/deep/file.jpg')
      })
    })

    describe('when the source path has only one directory level', () => {
      it('should move the file to the destination folder', async () => {
        const { containerClient } = createBlobMocks(['uploads'])

        const result = await moveBlobToFolder(containerClient, 'uploads/file.txt', 'archive')

        expect(result).toBe('archive/file.txt')
      })
    })

    describe('when called with different source paths and the same destination', () => {
      it('should produce independent destination paths for each call', async () => {
        const { containerClient } = createBlobMocks(['temp', 'staging'])

        const result1 = await moveBlobToFolder(containerClient, 'temp/photo1.jpg', 'final')
        const result2 = await moveBlobToFolder(containerClient, 'staging/photo2.jpg', 'final')

        expect(result1).toBe('final/photo1.jpg')
        expect(result2).toBe('final/photo2.jpg')
      })
    })
  })
})

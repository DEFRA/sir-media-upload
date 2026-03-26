import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import config from '../utils/config.js'

const uploadContainerName = 'sir-media-uploads'

const getUploadContainerClient = async () => {
  if (getUploadContainerClient.cachedClient) {
    return getUploadContainerClient.cachedClient
  }

  const blobServiceClient = new BlobServiceClient(
    config.blobServiceUrl,
    new StorageSharedKeyCredential(config.storageAccount, config.storageAccessKey)
  )

  const containerClient = blobServiceClient.getContainerClient(uploadContainerName)
  await containerClient.createIfNotExists()
  getUploadContainerClient.cachedClient = containerClient

  return containerClient
}

export {
  getUploadContainerClient
}

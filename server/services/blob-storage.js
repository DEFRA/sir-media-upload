import { DefaultAzureCredential } from "@azure/identity";
// import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import { BlobServiceClient } from '@azure/storage-blob'
import config from '../utils/config.js'

const uploadContainerName = 'sir-media-uploads'

const getUploadContainerClient = async () => {
  if (getUploadContainerClient.cachedClient) {
    return getUploadContainerClient.cachedClient
  }

  const blobServiceClient = new BlobServiceClient(
    config.blobServiceUrl,
    new DefaultAzureCredential()
  )

  const containerClient = blobServiceClient.getContainerClient(uploadContainerName)
  await containerClient.createIfNotExists()
  getUploadContainerClient.cachedClient = containerClient

  return containerClient
}

export {
  getUploadContainerClient
}

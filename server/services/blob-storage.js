import { ManagedIdentityCredential } from '@azure/identity'
import { BlobServiceClient } from '@azure/storage-blob'
import config from '../utils/config.js'

const uploadContainerName = 'sir-media-uploads'
const thumbnailContainerName = 'sir-media-uploads-thumbnails'

const createBlobServiceClient = () => {
  return new BlobServiceClient(config.blobServiceUrl, new ManagedIdentityCredential())
}

const getUploadContainerClient = async () => {
  if (getUploadContainerClient.cachedClient) {
    return getUploadContainerClient.cachedClient
  }

  const blobServiceClient = createBlobServiceClient()
  const containerClient = blobServiceClient.getContainerClient(uploadContainerName)
  await containerClient.createIfNotExists()
  getUploadContainerClient.cachedClient = containerClient

  return containerClient
}

const getThumbnailContainerClient = async () => {
  if (getThumbnailContainerClient.cachedClient) {
    return getThumbnailContainerClient.cachedClient
  }

  const blobServiceClient = createBlobServiceClient()
  const containerClient = blobServiceClient.getContainerClient(thumbnailContainerName)
  await containerClient.createIfNotExists()
  getThumbnailContainerClient.cachedClient = containerClient

  return containerClient
}

const moveBlobToFolder = async (containerClient, sourcePath, destFolder) => {
  const pathParts = sourcePath.split('/')
  pathParts[0] = destFolder
  const destPath = pathParts.join('/')

  const sourceBlob = containerClient.getBlockBlobClient(sourcePath)
  const destBlob = containerClient.getBlockBlobClient(destPath)

  const copyPoller = await destBlob.beginCopyFromURL(sourceBlob.url)
  await copyPoller.pollUntilDone()
  await sourceBlob.deleteIfExists()

  return destPath
}

export {
  getUploadContainerClient,
  getThumbnailContainerClient,
  moveBlobToFolder
}

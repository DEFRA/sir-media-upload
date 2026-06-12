import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'
import config from '../utils/config.js'

const uploadContainerName = 'sir-media-uploads'

const getBlobServiceClient = async () => {
  if (getBlobServiceClient.cachedClient) {
    return getBlobServiceClient.cachedClient
  }

  let blobServiceClient

  if (config.storageAccessKey) {
    const sharedKeyCredential = new StorageSharedKeyCredential(config.storageAccount, config.storageAccessKey)
    blobServiceClient = new BlobServiceClient(
      config.blobServiceUrl,
      sharedKeyCredential
    )
  } else {
    blobServiceClient = new BlobServiceClient(
      config.blobServiceUrl,
      new DefaultAzureCredential()
    )
  }

  getBlobServiceClient.cachedClient = blobServiceClient
  return blobServiceClient
}

const getContainerClientByName = async (containerName) => {
  const blobServiceClient = await getBlobServiceClient()
  const containerClient = blobServiceClient.getContainerClient(containerName)
  await containerClient.createIfNotExists()
  return containerClient
}

const getUploadContainerClient = async () => {
  if (getUploadContainerClient.cachedClient) {
    return getUploadContainerClient.cachedClient
  }

  const containerClient = await getContainerClientByName(uploadContainerName)
  getUploadContainerClient.cachedClient = containerClient
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
  getBlobServiceClient,
  getUploadContainerClient,
  moveBlobToFolder
}

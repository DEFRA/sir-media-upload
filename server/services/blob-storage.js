import { DefaultAzureCredential } from '@azure/identity'
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob'
import config from '../utils/config.js'

const uploadContainerName = 'sir-media-uploads'
const aiCheckerSasDurationMs = 10 * 60 * 1000

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

const getAIImageBlobUrl = (blobClient) => {
  if (!config.storageAccessKey) {
    throw new Error('AZURE_STORAGE_ACCESS_KEY is required to generate an AI image blob URL')
  }

  const startsOn = new Date(Date.now() - 60 * 1000)
  const expiresOn = new Date(Date.now() + aiCheckerSasDurationMs)
  const credential = new StorageSharedKeyCredential(config.storageAccount, config.storageAccessKey)
  const sasToken = generateBlobSASQueryParameters({
    containerName: blobClient.containerName,
    blobName: blobClient.name,
    permissions: BlobSASPermissions.parse('r'),
    startsOn,
    expiresOn,
    protocol: 'https'
  }, credential).toString()

  return `${blobClient.url}?${sasToken}`
}

const moveBlobToFolder = async (containerClient, sourcePath, destFolder) => {
  const pathParts = sourcePath.split('/')
  pathParts[0] = destFolder

  const filenameIndex = pathParts.length - 1
  pathParts[filenameIndex] = encodeURIComponent(pathParts[filenameIndex]).replace(/%20/g, ' ')

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
  getAIImageBlobUrl,
  moveBlobToFolder
}

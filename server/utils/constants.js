const urls = {
  GOV_UK_HOME: 'https://www.gov.uk'
}

const HOME = 'home'
const PUBLIC = 'public'
const UPLOAD_PHOTO = 'upload-photo'
const ADD_A_PHOTO = 'add-a-photo'
const YOUR_PHOTOS = 'your-photos'
const SEND_PHOTOS = 'send-photos'
const SUCCESS = 'success'
const TERMS_FOR_UPLOADING_PHOTOS = 'terms-for-uploading-photos'
const LINK_USED = 'link-used'
const HEALTH = 'health'

const views = {
  HOME,
  PUBLIC,
  UPLOAD_PHOTO,
  ADD_A_PHOTO,
  YOUR_PHOTOS,
  SEND_PHOTOS,
  SUCCESS,
  TERMS_FOR_UPLOADING_PHOTOS,
  LINK_USED,
  HEALTH
}

const routes = {
  ...views
}

for (const [key, value] of Object.entries(views)) {
  // Journey routes get the /media prefix; HOME, PUBLIC, and HEALTH keep their original paths
  const journeyRoutes = ['UPLOAD_PHOTO', 'ADD_A_PHOTO', 'YOUR_PHOTOS', 'SEND_PHOTOS', 'SUCCESS', 'TERMS_FOR_UPLOADING_PHOTOS', 'LINK_USED']
  const prefix = journeyRoutes.includes(key) ? '/media' : ''
  routes[key] = `${prefix}/${value}`
}

const statusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  REDIRECT: 302,
  UNAUTHORIZED: 401,
  PAGE_NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
  PROBLEM_WITH_SERVICE: 500,
  SERVICE_UNAVAILABLE: 503
}

const uploadErrors = {
  noFileScanResponse: 'Timed out awaiting anti virus scan result',
  threatDetected: 'The selected file contains a virus'
}

export default Object.freeze({
  routes,
  views,
  statusCodes,
  urls,
  uploadErrors
  // serviceNames,
  // redisKeys,
  // errorSummary,
  // phoneRegex,
  // waterFeatureLabels,
  // setReferer,
  // clearReferer
})

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

const views = {
  HOME,
  PUBLIC,
  UPLOAD_PHOTO,
  ADD_A_PHOTO,
  YOUR_PHOTOS,
  SEND_PHOTOS,
  SUCCESS,
  TERMS_FOR_UPLOADING_PHOTOS,
}

const routes = {
  ...views
}

for (const [key, value] of Object.entries(views)) {
  routes[key] = `/${value}`
}

export default Object.freeze({
  routes,
  views,
  // statusCodes,
  urls
  // serviceNames,
  // redisKeys,
  // errorSummary,
  // phoneRegex,
  // waterFeatureLabels,
  // setReferer,
  // clearReferer
})

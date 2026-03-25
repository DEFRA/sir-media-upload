const urls = {
  GOV_UK_HOME: 'https://www.gov.uk'
}

const HOME = 'home'
const PUBLIC = 'public'

const views = {
  HOME,
  PUBLIC
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

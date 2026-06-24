import Joi from 'joi'
const envs = ['development', 'test', 'production']
const defaultPort = 8000
const defaultRedisPort = 6379

const getBoolean = booleanString =>
  String(booleanString).toLowerCase() === 'true'

export const updateBaseUrl = urlString => {
  const value = String(urlString)

  if (value.startsWith('https://') || value.startsWith('http://')) {
    return value
  }

  return `https://${value}`
}

// Define config schema
const schema = Joi.object().keys({
  env: Joi
    .string()
    .valid(...envs)
    .default(envs[0]),
  servicePort: Joi.number().default(defaultPort),
  redisHost: Joi.string().default('localhost'),
  redisPort: Joi.number().default(defaultRedisPort),
  redisPassword: Joi.string(),
  redisTls: Joi.bool().default(false),
  logLevel: Joi.string().default('info'),
  sessionCookiePassword: Joi.string().default('the-password-must-be-at-least-32-characters-long'),
  authCookiePassword: Joi.string().default('the-password-must-be-at-least-32-characters-long'),
  cookieIsSecure: Joi.bool().default(false),
  serviceBusConnectionString: Joi.string().required(),
  serviceBusQueueName: Joi.string().required(),
  blobServiceUrl: Joi.string().required(),
  storageAccount: Joi.string().required(),
  storageAccessKey: Joi.string().optional(),
  smartIncidentReportingBaseUrl: Joi.string().required(),
  contentSafetyEndpoint: Joi.string().required(),
  contentSafetyKey: Joi.string().required(),
  apimAIScope: Joi.string().required(),
  apimAIClientId: Joi.string().required(),
  apimAISecret: Joi.string().required(),
  apimAITenantId: Joi.string().required(),
  apimAIEndpoint: Joi.string().required(),
  sirIdTesting: Joi.string().optional()
})

// Build config
const config = {
  env: process.env.NODE_ENV,
  servicePort: process.env.SERVICE_PORT,
  logLevel: process.env.LOG_LEVEL,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  redisPassword: process.env.REDIS_PASSWORD,
  redisTls: getBoolean(process.env.REDIS_TLS),
  sessionCookiePassword: process.env.SESSION_COOKIE_PASSWORD,
  authCookiePassword: process.env.SESSION_COOKIE_PASSWORD,
  cookieIsSecure: getBoolean(process.env.COOKIE_IS_SECURE),
  serviceBusConnectionString: process.env.SERVICE_BUS_CONNECTION_STRING,
  serviceBusQueueName: process.env.SERVICE_BUS_QUEUE_NAME,
  blobServiceUrl: process.env.AZURE_BLOB_SERVICE_URL,
  storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
  storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
  smartIncidentReportingBaseUrl: updateBaseUrl(process.env.SMART_INCIDENT_REPORTING_BASE_URL),
  contentSafetyEndpoint: process.env.CONTENT_SAFETY_ENDPOINT,
  contentSafetyKey: process.env.CONTENT_SAFETY_KEY,
  apimAIScope: process.env.APIM_AI_SCOPE,
  apimAIClientId: process.env.APIM_AI_CLIENT_ID,
  apimAISecret: process.env.APIM_AI_SECRET,
  apimAITenantId: process.env.APIM_AI_TENANT_ID,
  apimAIEndpoint: process.env.APIM_AI_ENDPOINT,
  sirIdTesting: process.env.SIR_ID_TESTING
}

// Validate config
const { error, value } = schema.validate(config)

// Throw if config is invalid
if (error) {
  throw new Error(`The server config is invalid. ${error.message}`)
}

// Add some helper props
value.isDev = value.env === 'development'

export default {
  ...value
}

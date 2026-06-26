export default [
  {
    method: 'GET',
    path: '/health',
    handler: (_request, h) => h.response('OK').code(200)
  }
]

export default [
  {
    method: 'GET',
    path: '/',
    handler: (_request, h) => h.response('OK').code(200)
  }
]

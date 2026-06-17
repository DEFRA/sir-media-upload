const handlers = {
  get: (request, h) => {
    return h.view('home')
  }
}

export default [
  {
    method: 'GET',
    path: '/',
    handler: handlers.get
  }
]

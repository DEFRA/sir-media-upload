const errorPages = {
  name: 'error-pages',
  register: server => {
    server.ext('onPreResponse', (request, h) => {
      const { response } = request

      if (!response.isBoom) {
        return h.continue
      }

      const statusCode = response.output.statusCode

      if (statusCode === 404) {
        return h.view('404').code(statusCode)
      }

      request.log('error', {
        statusCode,
        message: response.message,
        stack: response.data ? response.data.stack : response.stack
      })

      return h.view('500').code(statusCode)
    })
  }
}

export default errorPages

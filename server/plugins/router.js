import constants from '../utils/constants.js'

const router = async () => {
  const routes = [].concat(
    ...await Promise.all(Object.values(constants.views).map(async view => (await import(`../routes/${view}.js`)).default))
  )

  return {
    name: 'router',
    register: server => { server.route(routes) }
  }
}
export default router

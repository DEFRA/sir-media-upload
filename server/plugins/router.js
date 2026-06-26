import constants from '../utils/constants.js'

const router = async () => {
  const allRoutes = constants.routes
  allRoutes.HEALTH = '/health'

  const routes = [].concat(
    ...await Promise.all(Object.values(allRoutes).map(async route => (await import(`../routes/${route}.js`)).default))
  )

  return {
    name: 'router',
    register: server => { server.route(routes) }
  }
}
export default router

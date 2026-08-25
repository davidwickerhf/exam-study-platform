import { AsyncLocalStorage } from 'node:async_hooks'

const requestContext = new AsyncLocalStorage()

export function withRequestContext(context, callback) {
  return requestContext.run(context, callback)
}

export function setRequestContext(context) {
  requestContext.enterWith(context)
}

export function currentUserId() {
  return requestContext.getStore()?.userId || 'local-dev'
}

export function currentAuth() {
  return requestContext.getStore() || { userId: 'local-dev', mode: 'local' }
}

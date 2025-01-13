import { logger } from './logger'

export const tryCatch = <T>(
  fn: () => Promise<T>,
  errorMsg: string,
): Promise<T | null> => {
  return fn().catch((error) => {
    logger.error({ err: error, msg: errorMsg })
    return null
  })
}

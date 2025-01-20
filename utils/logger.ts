// utils/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
  serializers: {
    // Add custom serializers
    err: pino.stdSerializers.err,
    // Add a safe serializer for complex objects
    data: (value: unknown) => {
      try {
        return JSON.parse(JSON.stringify(value))
      } catch (error) {
        return '[Unable to serialize]'
      }
    },
  },
})

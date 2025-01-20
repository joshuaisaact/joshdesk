import { serve } from 'bun'
import { App } from '@slack/bolt'
import { logger } from '../utils/logger'

export const startServer = async (slackApp: App) => {
  // Start the Bolt app first
  await slackApp.start(process.env.PORT || 3000)

  // Read the HTML templates
  const indexTemplate = await Bun.file('./public/index.html').text()
  const privacyTemplate = await Bun.file('./public/privacy.html').text()

  // Then start your static server on a different port
  serve({
    port: process.env.STATIC_PORT || 3001,
    async fetch(req) {
      const url = new URL(req.url)
      logger.info(`Incoming request to: ${url.pathname}`)

      // Handle your static routes
      switch (url.pathname) {
        case '/':
          return new Response(indexTemplate, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
            },
          })

        case '/privacy':
          return new Response(privacyTemplate, {
            headers: {
              'Content-Type': 'text/html',
              'Cache-Control': 'public, max-age=3600',
            },
          })

        // Handle static files from /media directory
        case url.pathname.startsWith('/media/') && url.pathname:
          try {
            const file = Bun.file(`./public${url.pathname}`)
            const exists = await file.exists()

            if (!exists) {
              return new Response('Not Found', { status: 404 })
            }

            const contentType = url.pathname.endsWith('.gif')
              ? 'image/gif'
              : url.pathname.endsWith('.webp')
                ? 'image/webp'
                : 'application/octet-stream'

            return new Response(file, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
              },
            })
          } catch (error) {
            console.error('Error serving static file:', error)
            return new Response('Internal Server Error', { status: 500 })
          }

        // Handle other static files (favicon, etc)
        case url.pathname.startsWith('/') && url.pathname:
          try {
            const file = Bun.file(`./public${url.pathname}`)
            const exists = await file.exists()

            if (!exists) {
              return new Response('Not Found', { status: 404 })
            }

            return new Response(file, {
              headers: {
                'Cache-Control': 'public, max-age=86400',
              },
            })
          } catch (error) {
            console.error('Error serving static file:', error)
            return new Response('Internal Server Error', { status: 500 })
          }

        default:
          return new Response('Not Found', { status: 404 })
      }
    },
  })
}

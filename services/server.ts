import { serve } from 'bun'
import { App } from '@slack/bolt'

export const startServer = async (slackApp: App) => {
  // Start Slack app
  await slackApp.start(process.env.PORT || 3000)

  // Read the HTML template once at startup
  const indexTemplate = await Bun.file('./public/index.html').text()
  const privacyTemplate = await Bun.file('./public/privacy.html').text()

  // Start landing page server
  serve({
    port: process.env.WEB_PORT || 3001,
    async fetch(req) {
      const url = new URL(req.url)

      // Route based on pathname
      switch (url.pathname) {
        case '/':
          // Replace template variables for index
          const html = indexTemplate.replace(
            '{{SLACK_INSTALL_URL}}',
            process.env.SLACK_INSTALL_URL || '#',
          )
          return new Response(html, {
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

            // Set appropriate content type based on file extension
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

import type { KnownBlock } from '@slack/types'
import { logger } from './logger'

// quotes.ts
interface Quote {
  q: string
  a: string
  h: string
  c: string // category/tag if available
}

interface QuoteCache {
  quote: Quote | null
  date: string
}

// Private module state
const cache: QuoteCache = {
  quote: null,
  date: '',
}

// Get quote, using cache if available
export async function getDailyQuote(): Promise<KnownBlock[]> {
  const today = new Date().toISOString().split('T')[0]

  if (!cache.quote || cache.date !== today) {
    try {
      const response = await fetch('https://zenquotes.io/api/today')
      const data: Quote[] = await response.json()

      cache.quote = data[0]
      cache.date = today
    } catch (error) {
      logger.error({ msg: 'Failed to fetch quote', error })
      cache.quote = {
        q: 'Success is not final, failure is not fatal: it is the courage to continue that counts',
        a: 'Winston Churchill',
        h: '',
        c: 'motivation',
      }
    }
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> 💭  _"${cache.quote?.q}"_\n> \n> — ${cache.quote?.a}`,
      },
    },
  ]
}

// If needed, expose a way to clear the cache
export function clearQuoteCache(): void {
  cache.quote = null
  cache.date = ''
}

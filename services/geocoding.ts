import { logger } from '../utils/logger'

// services/geocoding.ts
interface GeocodeResult {
  latitude: number
  longitude: number
  timezone: string
  formattedAddress: string
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address) {
    throw new Error('Address is required')
  }

  const apiKey = Bun.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('Google Maps API key is not configured')
  }

  // Geocode the address
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address,
  )}&key=${apiKey}`

  const geocodeResponse = await fetch(geocodeUrl)
  const geocodeData = await geocodeResponse.json()

  if (!geocodeData.results?.[0]) {
    throw new Error('Address not found')
  }

  const { lat, lng } = geocodeData.results[0].geometry.location
  const formattedAddress = geocodeData.results[0].formatted_address

  // Get timezone
  const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(
    Date.now() / 1000,
  )}&key=${apiKey}`

  const timezoneResponse = await fetch(timezoneUrl)
  const timezoneData = await timezoneResponse.json()

  return {
    latitude: lat,
    longitude: lng,
    timezone: timezoneData.timeZoneId,
    formattedAddress,
  }
}

interface PlaceResult {
  description: string
  place_id: string
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!query || query.length < 3) return []

  const apiKey = Bun.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('Google Maps API key not configured')
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}` +
        `&types=address` +
        `&key=${apiKey}`,
    )

    const data = await response.json()

    if (data.status !== 'OK') {
      logger.error({
        msg: 'Places API error',
        status: data.status,
        error: data.error_message,
      })
      return []
    }

    return data.predictions.map((prediction: any) => ({
      description: prediction.description,
      place_id: prediction.place_id,
    }))
  } catch (error) {
    logger.error({ msg: 'Failed to fetch places suggestions', error })
    return []
  }
}

interface PlaceDetails {
  latitude: number
  longitude: number
  timezone: string
  formatted_address: string
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const apiKey = Bun.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('Google Maps API key not configured')
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}` +
        `&fields=geometry,formatted_address` +
        `&key=${apiKey}`,
    )

    const data = await response.json()

    if (data.status !== 'OK' || !data.result) {
      throw new Error('Failed to get place details')
    }

    const { lat, lng } = data.result.geometry.location

    // Get timezone
    const tzResponse = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?` +
        `location=${lat},${lng}` +
        `&timestamp=${Math.floor(Date.now() / 1000)}` +
        `&key=${apiKey}`,
    )

    const tzData = await tzResponse.json()

    return {
      latitude: lat,
      longitude: lng,
      timezone: tzData.timeZoneId || 'UTC',
      formatted_address: data.result.formatted_address,
    }
  } catch (error) {
    logger.error({ msg: 'Failed to fetch place details', error })
    throw new Error('Failed to get location details')
  }
}

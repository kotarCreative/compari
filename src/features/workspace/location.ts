export type RequestLocation = {
  location?: string
  askForLocation: boolean
}

const locationTimeoutMs = 8_000

export function formatApproximateLocation(
  latitude: number,
  longitude: number,
): string {
  return `Approximate coordinates ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
}

export function getRequestLocation(): Promise<RequestLocation> {
  if (typeof window === 'undefined')
    return Promise.resolve({ askForLocation: true })
  const geolocation = navigator.geolocation as Geolocation | undefined
  if (!geolocation) return Promise.resolve({ askForLocation: true })

  return new Promise((resolve) => {
    try {
      geolocation.getCurrentPosition(
        (position) =>
          resolve({
            location: formatApproximateLocation(
              position.coords.latitude,
              position.coords.longitude,
            ),
            askForLocation: false,
          }),
        () => resolve({ askForLocation: true }),
        {
          enableHighAccuracy: false,
          maximumAge: 5 * 60 * 1_000,
          timeout: locationTimeoutMs,
        },
      )
    } catch {
      resolve({ askForLocation: true })
    }
  })
}

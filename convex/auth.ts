import { convexAuth } from '@convex-dev/auth/server'
import { Anonymous } from '@convex-dev/auth/providers/Anonymous'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Convex Auth persists the anonymous credential in this browser, giving a
  // first-time visitor a private device-local workspace without fingerprinting.
  providers: [Anonymous],
})

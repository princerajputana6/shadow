import { google } from 'googleapis'

// Builds an OAuth2 client from a User doc's googleTokens (already decrypted
// by the Mongoose getter). googleapis handles refresh-token rotation
// automatically when access_token is expired.
export function getOAuthClient(googleTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  client.setCredentials({
    access_token: googleTokens?.accessToken,
    refresh_token: googleTokens?.refreshToken,
    expiry_date: googleTokens?.expiryDate,
    scope: googleTokens?.scope
  })
  return client
}

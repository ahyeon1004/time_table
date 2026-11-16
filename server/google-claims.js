export function validateGoogleClaims(claims, nonce) {
  return typeof claims?.sub === "string" && claims.sub.length > 0
    && typeof claims.email === "string" && /^[^@\s]+@[^@\s]+$/.test(claims.email)
    && claims.email_verified === true && typeof nonce === "string" && Boolean(nonce)
    && claims.nonce === nonce;
}

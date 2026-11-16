// Cloudflare Access gate for the private dashboard: verifies the Cf-Access-Jwt-Assertion JWT with Web Crypto.
// Pure of Worker globals except `crypto`, so tests/stats-dashboard.test.ts imports it; the JWKS fetch is injected.
// Fails closed: a missing env var, a bad token or an email outside DASHBOARD_EMAILS all give null (the Worker answers 404).

export interface AccessEnv { ACCESS_AUD?: string; ACCESS_TEAM_DOMAIN?: string; DASHBOARD_EMAILS?: string }
export type Jwk = { kid?: string; kty?: string; n?: string; e?: string; alg?: string }
/** Returns the team's public keys ({ keys: [...] }); the Worker's real one fetches https://<team>/cdn-cgi/access/certs. */
export type JwksFetch = (teamDomain: string) => Promise<{ keys?: Jwk[] }>

const b64url = (s: string): Uint8Array<ArrayBuffer> => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const json = (s: string): Record<string, unknown> => JSON.parse(new TextDecoder().decode(b64url(s)))

/** "team.cloudflareaccess.com" (a scheme or trailing slash is tolerated), or null if it isn't one. */
export function teamDomain(v: string | undefined): string | null {
  const d = (v ?? '').trim().replace(/^https:\/\//, '').replace(/\/+$/, '').toLowerCase()
  return /^[a-z0-9-]+\.cloudflareaccess\.com$/.test(d) ? d : null
}

/** The verified email of a valid, allowed Access identity, or null. `now` is in seconds (injectable for tests). */
export async function verifyAccess(token: string | null, env: AccessEnv, fetchJwks: JwksFetch, now = Math.floor(Date.now() / 1000)): Promise<string | null> {
  try {
    const team = teamDomain(env.ACCESS_TEAM_DOMAIN)
    const aud = (env.ACCESS_AUD ?? '').trim()
    const allowed = (env.DASHBOARD_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (!team || !aud || !allowed.length || !token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const header = json(parts[0])
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null
    const jwk = (await fetchJwks(team)).keys?.find((k) => k.kid === header.kid && k.kty === 'RSA')
    if (!jwk) return null
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))
    if (!ok) return null
    const p = json(parts[1]) as { iss?: unknown; aud?: unknown; exp?: unknown; nbf?: unknown; email?: unknown }
    if (p.iss !== 'https://' + team) return null
    if (!(Array.isArray(p.aud) ? p.aud.includes(aud) : p.aud === aud)) return null
    if (typeof p.exp !== 'number' || p.exp <= now) return null
    if (typeof p.nbf === 'number' && p.nbf > now + 60) return null
    const email = typeof p.email === 'string' ? p.email.toLowerCase() : ''
    return email && allowed.includes(email) ? email : null
  } catch {
    return null
  }
}

/** The Worker's JWKS fetch: the team's certs endpoint, kept in memory for 5 minutes. */
let cache: { team: string; at: number; jwks: { keys?: Jwk[] } } | null = null
export const fetchTeamJwks: JwksFetch = async (team) => {
  if (cache && cache.team === team && Date.now() - cache.at < 300_000) return cache.jwks
  const r = await fetch('https://' + team + '/cdn-cgi/access/certs')
  if (!r.ok) throw new Error('jwks ' + r.status)
  const jwks = (await r.json()) as { keys?: Jwk[] }
  cache = { team, at: Date.now(), jwks }
  return jwks
}

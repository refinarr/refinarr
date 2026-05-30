# Security Policy

refinarr stores credentials for your Sonarr/Radarr instances (API keys, encrypted at rest with AES-256-GCM). Security reports get priority handling.

## Reporting a vulnerability

**Please do NOT open a public GitHub issue for security problems.** Public disclosure before a fix is available puts every refinarr user at risk.

**Primary channel — GitHub Security Advisory.** [Open a draft advisory](https://github.com/refinarr/refinarr/security/advisories/new). This keeps the report private until a coordinated disclosure and is the channel guaranteed to reach the maintainer.

Other channels (only if you cannot use GitHub Security Advisory, e.g. you don't have a GitHub account):

- Email the maintainer at the address listed on their GitHub profile. If that's not available, please open a GitHub account and use the Security Advisory flow — it routes to a private intake we monitor reliably.

Include:

- Affected version (`yarn version` or the Docker tag you're running)
- Deployment shape (Docker compose / dev / reverse-proxied / direct)
- Steps to reproduce or a proof-of-concept
- Your assessment of impact (RCE, auth bypass, info disclosure, etc.)

## Response timeline

- **Acknowledgement**: within 7 days
- **Initial assessment** (severity + scope): within 14 days
- **Patch + advisory**: depends on severity. Critical issues (RCE, auth bypass, secret exfiltration) targeted for 30-day disclosure window; lower-severity issues coordinated case-by-case.

Single-maintainer project — please be patient with timelines outside the response SLA above.

## Scope

In scope:

- Authentication / authorization flaws in `src/proxy.ts` (auth gate)
- Cryptographic weaknesses in `src/server/lib/crypto.ts` (AES-256-GCM at-rest encryption, scrypt password hashing)
- SSRF / URL-validation bypasses in `src/server/lib/url-guard.ts` (user-supplied *arr URLs)
- Secret leakage in logs or error responses (despite `redact.ts`)
- Injection vulnerabilities (SQLi via Prisma, XSS, command injection)
- Session management issues (token generation, cookie attributes, fixation)

Out of scope:

- DNS rebinding attacks — refinarr is intended for LAN deployment behind a trusted network; rebinding requires the attacker to control the user's DNS resolver, at which point all bets are off
- Findings that require physical access to the `/data` volume — losing control of the volume means losing control of the encrypted secrets, by design
- Rate-limiting bypass via spoofed `X-Forwarded-For` — refinarr deliberately does NOT trust this header for auth decisions (see [`url-guard.ts`](src/server/lib/url-guard.ts))
- Issues in dependencies — please report directly to the affected package

## What we ship to mitigate

- AES-256-GCM at-rest encryption for Sonarr/Radarr API keys
- Deny-by-default auth via `src/proxy.ts` — every route private unless explicitly allow-listed
- Scrypt password hashing for the admin account
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict` in production
- All user-supplied URLs validated via `assertSafeArrUrl()` — blocks non-http(s), cloud metadata endpoints (169.254.169.254, 192.0.0.192, IPv6 link-local)
- All log context routed through `redactContext()` — masks `apikey=`, `Authorization:`, 32-hex tokens, reserved keys
- Rate limiting on login + setup endpoints

## Deployment guidance

Refinarr **must not be exposed to the public internet** without a reverse proxy you trust to do TLS and (optionally) external auth. The built-in login is good for a private LAN; it is not designed to be the only thing between the internet and your media server.

The only public surfaces are `/api/health`, `/login`, and — only while no user exists — `/setup`. Everything else is gated by the deny-by-default proxy.

**Reverse-proxy auth (Authelia / Authentik / Caddy / etc.).** Refinarr can trust a username header from a reverse proxy that has already authenticated the user. Off by default:

```env
TRUST_PROXY_AUTH=true
PROXY_USER_HEADER=X-Remote-User   # default; change if your proxy sets a different header
```

Only enable this when refinarr is bound to a private interface that **only** the trusted proxy can reach — anything else can spoof the header. Refinarr deliberately does **not** read `X-Forwarded-For` or any IP header for auth decisions.

**API access from scripts.** The `X-Api-Key` header is honored for non-browser callers. The key is shown (and rotatable) in Settings → API Access; both reveal and rotate require your password again. Keep the key out of shell history and version control.

## What we deliberately don't do

- **No file uploads, no archive extraction, no path-from-input filesystem access** — eliminates Zip Slip and path-traversal classes entirely.
- **No client-controlled flags that bypass auth** — auth state never comes from a request body or URL parameter.
- **No allow-list-shaped auth** — every route is private unless explicitly listed as public; there is no "skip auth for X" code path.
- **No telemetry, no analytics** — outbound HTTP calls only to your configured *arr instances.
- **Process does not run as root** inside the container.

## Acknowledgements

We'll credit security reporters in the GitHub Security Advisory + release notes for the fix release. Let us know if you'd prefer to stay anonymous.

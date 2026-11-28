# NEXORA / CampusCast — DYPIU Digital Signage

CMS (React) + API (Express/MySQL) + TV players (browser kiosk, Android TV, LG webOS).

## Quick start (development)

```powershell
npm install
copy .env.example .env          # set DB_* (XAMPP: user root, empty password)
# import campuscast_schema.sql once (phpMyAdmin or: mysql -u root < campuscast_schema.sql)
npm run server                  # API on :5000 — runs migrations + first-run account setup
npm run dev                     # CMS on :3000
```

On first start every account that has no usable password gets a **temporary password printed once in the server
console** (or the value of `CAMPUSCAST_BOOTSTRAP_PASSWORD`). Sign in and change it from *User Management*.

## Production (one port)

```powershell
npm run build
$env:NODE_ENV="production"; npm start     # API + CMS + TV player on http://<server-ip>:5000
```

or `docker compose up -d --build` (needs `DB_PASSWORD` and `CAMPUSCAST_AUTH_SECRET` in `.env`).

## TVs

| Player | Setup |
| --- | --- |
| Browser / kiosk | open `http://<server>:5000/tv?tv=<SCREEN_ID>&kiosk=1` (add `&key=<DEVICE_KEY>` when keys are enforced) |
| Android TV | install `NEXORA-TV.apk`, enter server address, Screen ID (+ device key) once |
| LG webOS | install `NEXORA-TV.ipk`; on first launch enter the same three values (YELLOW key re-opens setup) |

Device keys are shown by the API (`GET /api/v1/screens`, field `deviceKey`) and are enforced when
`CAMPUSCAST_REQUIRE_DEVICE_KEY=1`.

## Control Center (all screens from one place)

Sidebar → **Control Center** (Super Administrator and IT Administrator by default; tick *Control Center* for other users in
User Management). Pick screens by **Wi-Fi network** (grouped by /24 subnet of the IP the server sees), building, group,
or individually, then:

| Action | What happens |
| --- | --- |
| Refresh player | the TV page reloads (picks up new player code and content) |
| Identify | the screen shows its name and ID for ~20 s so you can find it physically |
| On-screen message | banner (normal or urgent red) for 1 min – until cleared; *Clear* removes it |
| Standby / Wake | switches screens off/on in the CMS (same as the Screen Management toggle, in bulk) |

Commands are queued on the server and delivered in each TV's next heartbeat (every 10 s); a screen that is briefly
offline still receives them until they expire. **New TVs on the network** that show a pairing code appear at the top of
the page with their IP address – type a name and click *Adopt TV*. History of the last commands is listed at the bottom.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | TypeScript type-check |
| `npm test` | backend unit tests (no database needed) |
| `SMOKE_EMAIL=… SMOKE_PASSWORD=… node server/tests/smoke.mjs` | end-to-end API check against a running server |
| `npm run build:webos` | rebuild `public/NEXORA-TV.ipk` |

## Releasing a new Android build

1. Bump `versionCode` / `versionName` in `android-tv-app/app/build.gradle.kts`.
2. Build, copy the APK to `public/NEXORA-TV.apk`.
3. Set the same numbers in `server/ota.json`. TVs verify the SHA-256 the server advertises before installing.

See `docs/NEXORA_System_Audit_and_Fix_Report.docx` for the full audit, every fix and the remaining work.

## CI/CD (GitHub Actions → campus server)

- `.github/workflows/ci-cd.yml` – type-check, tests, build on every push/PR; pushes to `main` then deploy on the
  self-hosted runner labelled `nexora` using `deploy/deploy.sh` (Docker Compose, health check, automatic rollback).
- `.github/workflows/android.yml` – builds the signed APK (artifact) when `android-tv-app/**` changes.
- One-time server setup: `sudo bash deploy/setup-server.sh --repo <repo-url> --token <runner-token> --public-url http://<server-ip>:5000`
  (token: GitHub → Settings → Actions → Runners → New self-hosted runner).
- Required repository secrets for the APK build: `NEXORA_KEYSTORE_B64`, `NEXORA_KEYSTORE_PASSWORD`, `NEXORA_KEY_ALIAS`, `NEXORA_KEY_PASSWORD`.
  The keystore itself lives only in `android-tv-app/keystore/` (git-ignored) – back it up.

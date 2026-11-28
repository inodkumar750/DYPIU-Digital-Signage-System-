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

# CampusCast Android TV Player (`CampusCastTV`)

Dedicated standalone Android TV kiosk `.apk` project for **D.Y. Patil International University**.

## Features
- **True Standalone Digital Signage:** Runs directly on the Sansui / Android TV with zero casting or laptop mirroring needed.
- **TV Remote Friendly Setup:** First launch asks for Server URL (`http://10.40.0.193:3000`) and Screen ID (`DYPIU-TV-012` / `DYPIU-TV-001` one-click presets).
- **24/7 Immersive Kiosk & Wake Lock:** Keeps TV screen on, hides navigation bars, allows HTTP LAN playback (`usesCleartextTraffic=true`), auto-plays videos, and retries automatically every 5s if Wi-Fi drops.
- **Auto-Start on Boot:** Automatically opens CampusCast TV when the TV powers on.
- **Hidden Admin Menu:** Press `MENU` (or press `BACK` 3 times quickly) on the TV remote to change Screen ID or Server IP.

## Build `.apk`
Open the `android-tv-app` folder in **Android Studio** -> **Build > Build Bundle(s) / APK(s) > Build APK(s)**, or compile via Gradle (`./gradlew assembleDebug`).

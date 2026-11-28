# CampusCast Android TV Player (`CampusCastTV`)

Dedicated standalone Android TV kiosk `.apk` project for **D.Y. Patil International University**.

## Features
- **True Standalone Digital Signage:** Runs directly on the Sansui / Android TV with zero casting or laptop mirroring needed.
- **TV Remote Friendly Setup:** First launch asks for the Server URL (e.g. `http://10.100.0.39:5000`), the Screen ID and (optionally) the device key shown in the CMS. Nothing is hard-coded.
- **24/7 Immersive Kiosk & Wake Lock:** Keeps TV screen on, hides navigation bars, allows HTTP LAN playback (`usesCleartextTraffic=true`), auto-plays videos, and retries automatically every 5s if Wi-Fi drops.
- **Auto-Start on Boot:** Automatically opens CampusCast TV when the TV powers on.
- **Hidden Admin Menu:** Press `MENU` (or press `BACK` 3 times quickly) on the TV remote to change Screen ID or Server IP.

## Build `.apk`
Open the `android-tv-app` folder in **Android Studio** -> **Build > Build Bundle(s) / APK(s) > Build APK(s)**, or compile via Gradle: `./gradlew assembleRelease` (set `NEXORA_KEYSTORE`, `NEXORA_KEYSTORE_PASSWORD`, `NEXORA_KEY_ALIAS`, `NEXORA_KEY_PASSWORD` for the release key; without them the debug key is used). Output: `app/build/outputs/apk/release/NEXORA-TV.apk`.

# DOCTIS Mobile

Expo React Native patient app. It uses the existing DOCTIS API and MongoDB data; database credentials stay on the backend.

## Start on iPhone

1. Install Expo Go from the iOS App Store.
2. From this directory, run `npm install` once and then `npm start`.
3. Keep the iPhone and computer on the same Wi-Fi network.
4. Scan the terminal QR code with the iPhone Camera and open it in Expo Go.

## API

The app defaults to `https://doctis.vercel.app/api`. To point it at another API, copy `.env.example` to `.env`, edit `EXPO_PUBLIC_API_URL`, and restart Expo.

The app stores the JWT in iOS Keychain through Expo SecureStore. It does not store MongoDB credentials in the mobile client.

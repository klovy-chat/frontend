# Klovy Chat — aplikacje mobilne

Frontend jest budowany jako lokalny bundle Vite i uruchamiany w Capacitorze. Aplikacja nie jest tylko WebView wskazującym na stronę internetową: podstawowe widoki, logowanie i obsługa offline błędów są częścią paczki, a API i WebSocket korzystają z produkcyjnego HTTPS/WSS.

## Przygotowanie

```powershell
bun install
bun run build
bun run cap:sync
```

Do uruchomienia Androida potrzebne są Android Studio, SDK i emulator/urządzenie. Do iOS potrzebny jest macOS z Xcode i Apple Developer Program:

```powershell
bun run cap:open:android
# na macOS:
bun run cap:open:ios
```

## Konfiguracja backendu

Mobilny bundle musi mieć:

- `VITE_BACKEND_URL` wskazujący publiczny adres HTTPS API,
- `VITE_CDN_BASE_URL` wskazujący HTTPS CDN,
- `VITE_TURNSTILE_SITE_KEY` ustawiony dla buildu produkcyjnego,
- `VITE_LIVEKIT_ALLOWED_HOSTS` ograniczony do używanych hostów LiveKit.

Backend musi mieć w `ORIGIN` (lub `FRONTEND_URL`) także originy Capacitor:

- `https://app.klovy.chat` dla webu,
- `http://localhost` dla Android WebView,
- `capacitor://localhost` dla iOS WebView.

Nie dodawaj wildcardów ani originów deweloperskich do produkcji.

## Wymagania przed wysłaniem do sklepów

- Google Play: aktualny target SDK, podpisany AAB, formularz Data safety, publiczna polityka prywatności, działający formularz usuwania konta, testy na Androidzie z back gesture i odrzuceniem uprawnień.
- App Store: App Store Connect privacy labels, polityka prywatności, konto demonstracyjne dla review, wymagane opisy kamery/mikrofonu/zdjęć, testy na iPhonie bez dostępu do sieci i po odebraniu uprawnień.
- Oba sklepy: zgłaszanie i blokowanie użytkowników, moderacja treści, obsługa nadużyć, brak sekretów w bundle, aktualne screenshoty oraz opis funkcji zgodny z rzeczywistym działaniem.

Samo opakowanie istniejącego serwisu nie gwarantuje akceptacji. Przed publikacją trzeba uzupełnić natywne push notifications (FCM/APNs), obsługę linków zaproszeń i proces usuwania konta oraz przejść checklistę polityk aktualną dla danego sklepu.

# frontend

[![License: Klovy](https://img.shields.io/badge/License-Klovy-blue.svg)](LICENSE)

The official frontend of Klovy Chat.

Oficjalna aplikacja webowa komunikatora **Klovy Chat** (Klovy Systems) — React + Vite + TypeScript, hostowana na Cloudflare.

Produkcja: [app.klovy.chat](https://app.klovy.chat)

---

## O projekcie

Frontend to klient Klovy Chat w przeglądarce: logowanie, czat, kanały, znajomi, załączniki, połączenia głosowe (LiveKit) i obecność na żywo przez WebSocket.

W dewelopmencie Vite proxy’uje `/api`, `/whitelist` i `/ws` na backend. Produkcja to SPA na Cloudflare Workers (`wrangler deploy`). Aplikacja desktopowa ładuje ten sam frontend z `app.klovy.chat`.

### Ekosystem

| Repo | Rola |
|------|------|
| [backend](https://github.com/klovy-chat/backend) | API i WebSocket |
| [frontend](https://github.com/klovy-chat/frontend) | Aplikacja web (`app.klovy.chat`) |
| [website](https://github.com/klovy-chat/website) | Strona (`klovy.chat`) |
| [application](https://github.com/klovy-chat/application) | Desktop (Tauri) |

---

## Funkcje

- Logowanie, rejestracja, 2FA, Cloudflare Turnstile
- Czat: wiadomości, załączniki, reakcje, pinowanie, wyszukiwanie
- Kanały, ustawienia, zaproszenia, znajomi i kontakty
- WebSocket: obecność, typing, cache wiadomości
- Połączenia głosowe (LiveKit)
- GIF-y, stickery, emoji
- i18n: polski i angielski
- Tryb desktop (Tauri) i ograniczenia mobile

---

## Wymagania

- **Node.js** >= 18 albo **Bun** (w `package.json`: `bun@1.2.15`)
- Backend na `127.0.0.1:8080` przy lokalnym API

---

## Uruchomienie lokalne

```bash
git clone https://github.com/klovy-chat/frontend.git
cd frontend
cp .env.example .env
```

Szablon [`.env.example`](.env.example) wskazuje na lokalny backend (`http://127.0.0.1:8080`). Turnstile w trybie Vite (DEV) jest wyłączony.

```bash
bun install
bun run dev
```

Albo `npm install` / `npm run dev`. Vite: [http://127.0.0.1:5173](http://127.0.0.1:5173).

Frontend i backend razem (backend w `../backend`):

```bash
npm run dev:all
```

Build i podgląd:

```bash
bun run build
bun run preview
```

Produkcja (Cloudflare, utrzymujący):

```bash
bun run deploy
```

---

## Zmienne środowiska

Szablon: [`.env.example`](.env.example) (`cp .env.example .env`). Nie commituj prawdziwego `.env`.

| Zmienna | Opis |
|---------|------|
| `VITE_BACKEND_URL` | URL API (lokalnie: `http://127.0.0.1:8080`) |
| `VITE_CDN_BASE_URL` | CDN załączników (lokalnie ten sam host co API) |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile — puste w DEV, wymagane przy buildzie prod |
| `VITE_LIVEKIT_ALLOWED_HOSTS` | Dozwolone hosty LiveKit (np. `*.livekit.cloud`) |

Build produkcyjny wymaga HTTPS w `VITE_BACKEND_URL` oraz ustawionego Turnstile.

---

## Technologie

- **React 18** + **TypeScript**
- **Vite 8** — bundler i dev server
- **React Router** — trasy (login, signup, chat, invite, settings)
- **i18next** — tłumaczenia PL / EN
- **LiveKit** — głos
- **Cloudflare Turnstile** — captcha
- **Cloudflare Workers** — hosting SPA (`wrangler`)

---

## Struktura projektu

```
frontend/
├── src/
│   ├── main.tsx             # Wejście aplikacji
│   ├── App.tsx              # Trasy publiczne i chronione
│   ├── pages/               # Login, Signup, Chat, Invite, …
│   ├── components/          # Czat, kanały, call, layout
│   ├── context/             # Auth, WebSocket, presence, call
│   ├── api/                 # Klient HTTP / WS
│   ├── crypto/              # Szyfrowanie po stronie klienta
│   ├── languages/           # pl.json, en.json
│   ├── settings/            # Ustawienia konta
│   ├── styles/              # CSS per obszar
│   └── utils/               # Media, env, device, chat
├── scripts/                 # build-locales
├── wrangler.jsonc           # Cloudflare Workers
├── vite.config.ts
├── .env.example
└── package.json
```

---

## Contributing

Kod jest publiczny na [Klovy License](LICENSE). Issue i pull requesty są mile widziane.

1. Zrób [fork](https://github.com/klovy-chat/frontend/fork)
2. Utwórz branch: `git checkout -b feature/opis-zmiany`
3. Commit (bez `.env` i sekretów)
4. Otwórz pull request do `main`

Opisz w PR **co** i **dlaczego**. Drobne poprawki (docs, typo, i18n) też są OK.

---

## Bezpieczeństwo

Luki zgłaszaj prywatnie przez [GitHub Security Advisories](https://github.com/klovy-chat/frontend/security/advisories/new). Nie otwieraj publicznego issue z exploitami.

---

## Licencja

Kod jest udostępniony na **[Klovy License](LICENSE)** — użycie osobiste, edukacyjne i niekomercyjne. Dystrybucja komercyjna, konkurencyjny komunikator oraz użycie marek Klovy wymagają pisemnej zgody Jakuba Maksymowicza. Zgłoszenie PR, błędu lub audytu bezpieczeństwa oznacza zgodę na warunki kontrybucji z licencji (pkt 7–11).

© 2026 [Jakub Maksymowicz](https://github.com/klovy-chat)

import {
  CLIENT_USER_AGENT_HEADER,
} from "../env/clientId";
import { simplifyOsLabel } from "./osLabel";
import { parseUserAgentPlatform } from "./parseUserAgentPlatform";

export interface ClientEnvironment {
  browser: string;
  os: string;
  label: string;
}

/** Markery osadzane w X-Klovy-User-Agent — widoczne ASCII, dozwolone w nagłówkach HTTP. */
export const CLIENT_ENV_TRANSPORT_MARKER = "<<KLOVY_ENV>>";
export const CLIENT_ENV_TRANSPORT_SEPARATOR = "<<KLOVY_SEP>>";

type UaBrand = { brand: string; version: string };

type NavigatorWithUaData = Navigator & {
  userAgentData?: {
    platform?: string;
    brands?: UaBrand[];
    mobile?: boolean;
    getHighEntropyValues?: (
      hints: string[],
    ) => Promise<{
      platform?: string;
      platformVersion?: string;
      architecture?: string;
      bitness?: string;
      model?: string;
      wow64?: boolean;
      fullVersionList?: UaBrand[];
    }>;
  };
};

const IGNORED_BROWSER_BRANDS = new Set([
  "Not/A)Brand",
  "Not;A=Brand",
  "Not)A;Brand",
  "Not A;Brand",
  "Not_A Brand",
]);

const cache: ClientEnvironment = {
  browser: "",
  os: "",
  label: "",
};

let loadPromise: Promise<void> | null = null;
let loaded = false;

function shortVersion(version: string, parts = 2): string {
  const chunks = version.split(".").filter(Boolean);
  if (chunks.length <= parts) return version;
  return chunks.slice(0, parts).join(".");
}

function pickBrowserBrand(brands: UaBrand[]): UaBrand | null {
  const meaningful = brands.filter((b) => !IGNORED_BROWSER_BRANDS.has(b.brand));
  if (meaningful.length === 0) return brands[0] ?? null;
  return meaningful.find((b) => b.brand !== "Chromium") ?? meaningful[0];
}

function browserFromBrands(brands: UaBrand[] | undefined): string | null {
  if (!brands?.length) return null;
  const brand = pickBrowserBrand(brands);
  if (!brand) return null;
  const version = shortVersion(brand.version);
  return version ? `${brand.brand} ${version}` : brand.brand;
}

function browserFromUserAgent(ua: string): string | null {
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/EdgA?\/([\d.]+)/, (m) => `Edge ${shortVersion(m[1])}`],
    [/EdgiOS\/([\d.]+)/, (m) => `Edge ${shortVersion(m[1])}`],
    [/OPR\/([\d.]+)/, (m) => `Opera ${shortVersion(m[1])}`],
    [/Vivaldi\/([\d.]+)/, (m) => `Vivaldi ${shortVersion(m[1])}`],
    [/Firefox\/([\d.]+)/, (m) => `Firefox ${shortVersion(m[1])}`],
    [/CriOS\/([\d.]+)/, (m) => `Chrome ${shortVersion(m[1])}`],
    [/Chrome\/([\d.]+)/, (m) => `Chrome ${shortVersion(m[1])}`],
    [/Version\/([\d.]+).*Safari/, (m) => `Safari ${shortVersion(m[1])}`],
  ];

  for (const [pattern, format] of rules) {
    const match = ua.match(pattern);
    if (match) return format(match);
  }
  return null;
}

function osFromClientHints(values: { platform?: string }): string | null {
  const platform = values.platform?.trim();
  return platform || null;
}

function osFromUserAgentParenthetical(ua: string): string | null {
  return parseUserAgentPlatform(ua);
}

async function detectClientEnvironment(): Promise<ClientEnvironment> {
  const ua = navigator.userAgent ?? "";
  let browser = browserFromUserAgent(ua);
  let os: string | null = null;

  const nav = navigator as NavigatorWithUaData;
  const uaData = nav.userAgentData;

  if (uaData) {
    browser = browserFromBrands(uaData.brands) ?? browser;

    if (typeof uaData.getHighEntropyValues === "function") {
      try {
        const values = await uaData.getHighEntropyValues([
          "platform",
          "fullVersionList",
        ]);

        browser = browserFromBrands(values.fullVersionList) ?? browser;
        os = osFromClientHints(values) ?? os;
      } catch {
        // Brak uprawnień lub przeglądarka nie wspiera high-entropy hints.
      }
    }

    if (!os && uaData.platform) {
      os = uaData.platform.trim();
    }
  }

  if (!os) {
    os = osFromUserAgentParenthetical(ua);
  }

  if (!os) {
    os = navigator.platform?.trim() ?? null;
  }

  const browserFinal = browser ?? "Unknown browser";
  const osFinal = simplifyOsLabel(os ?? "") || "Unknown OS";

  return {
    browser: browserFinal,
    os: osFinal,
    label: `${browserFinal} on ${osFinal}`,
  };
}

async function loadClientEnvironment(): Promise<void> {
  if (typeof navigator === "undefined") return;
  const detected = await detectClientEnvironment();
  cache.browser = detected.browser;
  cache.os = detected.os;
  cache.label = detected.label;
  loaded = true;
}

export function preloadClientEnvironment(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadClientEnvironment();
  }
  return loadPromise;
}

export async function ensureClientEnvironment(): Promise<ClientEnvironment> {
  await preloadClientEnvironment();
  return { ...cache };
}

export function formatClientUserAgentHeader(
  navigatorUserAgent: string,
  environment?: Pick<ClientEnvironment, "browser" | "os">,
): string {
  const ua = navigatorUserAgent.trim();
  if (!ua) return ua;

  const browser = environment?.browser?.trim();
  const os = environment?.os?.trim();
  if (!browser || !os) return ua;

  return `${ua}${CLIENT_ENV_TRANSPORT_MARKER}${browser}${CLIENT_ENV_TRANSPORT_SEPARATOR}${os}`;
}

/**
 * Ustawia X-Klovy-User-Agent z osadzonym browser/os — jeden nagłówek zamiast trzech
 * dodatkowych pól wymagających osobnej zgody CORS na produkcji.
 */
export function applyClientUserAgentHeader(headers: Headers): void {
  if (typeof navigator === "undefined") return;

  const navigatorUserAgent = navigator.userAgent ?? "";
  if (!navigatorUserAgent) return;

  const value = isClientEnvironmentReady()
    ? formatClientUserAgentHeader(navigatorUserAgent, cache)
    : navigatorUserAgent;

  headers.set(CLIENT_USER_AGENT_HEADER, value);
}

/** @deprecated Użyj applyClientUserAgentHeader — nie wysyłaj osobnych nagłówków env. */
export function applyClientEnvironmentHeaders(headers: Headers): void {
  applyClientUserAgentHeader(headers);
}

export function isClientEnvironmentReady(): boolean {
  return loaded;
}

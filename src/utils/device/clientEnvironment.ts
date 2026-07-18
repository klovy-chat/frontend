import {
  CLIENT_BROWSER_HEADER,
  CLIENT_ENVIRONMENT_LABEL_HEADER,
  CLIENT_OS_HEADER,
} from "../env/clientId";

export interface ClientEnvironment {
  browser: string;
  os: string;
  label: string;
}

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

const PLATFORM_SEGMENT_NOISE = new Set([
  "X11",
  "WOW64",
  "Win64",
  "U",
  "Mobile",
  "Tablet",
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

function osFromClientHints(values: {
  platform?: string;
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
  wow64?: boolean;
}): string | null {
  const chunks: string[] = [];
  const platform = values.platform?.trim();
  const platformVersion = values.platformVersion?.trim();

  if (platform) {
    if (platformVersion && platformVersion !== "0.0.0") {
      chunks.push(`${platform} ${shortVersion(platformVersion)}`);
    } else {
      chunks.push(platform);
    }
  }

  if (values.model?.trim() && platform === "Android") {
    chunks.push(values.model.trim());
  }

  const architecture = values.architecture?.trim();
  if (architecture && architecture !== "unknown") {
    chunks.push(architecture);
  }

  if (values.bitness === "64") chunks.push("64-bit");
  else if (values.bitness === "32") chunks.push("32-bit");

  if (values.wow64) chunks.push("WoW64");

  return chunks.length > 0 ? chunks.join(" · ") : null;
}

function osFromUserAgentParenthetical(ua: string): string | null {
  const match = ua.match(/\(([^)]+)\)/);
  if (!match) return null;

  const segments = match[1]
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (PLATFORM_SEGMENT_NOISE.has(part)) return false;
      if (/^rv:/i.test(part)) return false;
      if (/^compatible$/i.test(part)) return false;
      return true;
    });

  return segments.length > 0 ? segments.join(" · ") : null;
}

function osFromNavigatorFallback(): string | null {
  const platform = navigator.platform?.trim();
  if (platform) return platform;

  const ua = navigator.userAgent ?? "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/macintosh|mac os x/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return null;
}

async function detectClientEnvironment(): Promise<ClientEnvironment> {
  const ua = navigator.userAgent ?? "";
  let browser = browserFromUserAgent(ua);
  let os = osFromUserAgentParenthetical(ua) ?? osFromNavigatorFallback();

  const nav = navigator as NavigatorWithUaData;
  const uaData = nav.userAgentData;

  if (uaData) {
    browser = browserFromBrands(uaData.brands) ?? browser;

    if (typeof uaData.getHighEntropyValues === "function") {
      try {
        const values = await uaData.getHighEntropyValues([
          "platform",
          "platformVersion",
          "architecture",
          "bitness",
          "model",
          "wow64",
          "fullVersionList",
        ]);

        browser = browserFromBrands(values.fullVersionList) ?? browser;
        os = osFromClientHints(values) ?? os;
      } catch {
        // Brak uprawnień lub przeglądarka nie wspiera high-entropy hints.
      }
    }

    if (!os && uaData.platform) {
      os = uaData.platform;
    }
  }

  const browserFinal = browser ?? "Unknown browser";
  const osFinal = os ?? "Unknown OS";

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

export function applyClientEnvironmentHeaders(headers: Headers): void {
  if (!loaded) return;
  if (cache.browser) headers.set(CLIENT_BROWSER_HEADER, cache.browser);
  if (cache.os) headers.set(CLIENT_OS_HEADER, cache.os);
  if (cache.label) headers.set(CLIENT_ENVIRONMENT_LABEL_HEADER, cache.label);
}

export function isClientEnvironmentReady(): boolean {
  return loaded;
}

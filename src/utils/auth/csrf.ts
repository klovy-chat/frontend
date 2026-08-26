// csrf.ts
// Token CSRF z cookie do mutujących requestów.
// Zakres:
//  - nazwa cookie jak na backendzie
//  - odczyt cookie i wstawka nagłówka na mutacje
// Zmiana nazwy cookie = middlewares/csrf.rs + tu.
// Przy zmianach: api/client.ts, security/csrf.rs.

let cachedCsrfToken: string | null = null;

function setCsrfToken(token: string | null): void {
  const trimmed = token?.trim();
  cachedCsrfToken = trimmed ? trimmed : null;
}

export function getCsrfToken(): string | null {
  return cachedCsrfToken;
}

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export function absorbCsrfToken<T>(data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.csrfToken !== "string" || !record.csrfToken.trim()) {
    return data;
  }

  setCsrfToken(record.csrfToken);
  const { csrfToken: _removed, ...rest } = record;
  return rest as T;
}

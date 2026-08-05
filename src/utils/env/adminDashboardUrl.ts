/** Production panel URL (dash.klovy.chat). Override with VITE_ADMIN_DASHBOARD_URL for local/dev. */
const PRODUCTION_DASH_URL = "https://dash.klovy.chat"

/** URL panelu administracyjnego (dashboard) — poza komunikatorem. */
export function getAdminDashboardBaseUrl(): string {
    const fromEnv = import.meta.env.VITE_ADMIN_DASHBOARD_URL?.trim()
    const raw = fromEnv || PRODUCTION_DASH_URL
    return raw.replace(/\/$/, "").replace(/\/admin.*$/, "")
}

export function getAdminDashboardHandoffUrl(handoffToken: string): string {
    return `${getAdminDashboardBaseUrl()}/admin/auth/handoff?token=${encodeURIComponent(handoffToken)}`
}

export function getAdminDashboardUrl(): string {
    const fromEnv = import.meta.env.VITE_ADMIN_DASHBOARD_URL?.trim()
    if (fromEnv) return fromEnv.replace(/\/$/, "")
    return `${getAdminDashboardBaseUrl()}/admin`
}

export function getAdminDashboardUserLoginUrl(): string {
    return `${getAdminDashboardBaseUrl()}/user/login`
}

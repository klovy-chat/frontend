/** URL panelu administracyjnego (dashboard) — poza komunikatorem. */
export function getAdminDashboardBaseUrl(): string {
    const fromEnv = import.meta.env.VITE_ADMIN_DASHBOARD_URL?.trim()
    const raw = fromEnv || "http://localhost:3000"
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

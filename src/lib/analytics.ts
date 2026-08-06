/**
 * Analytics tracking utility for GA4 and client-side logging
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export const events = {
  LOGIN: "user_login",
  LOGOUT: "user_logout",
  DASHBOARD_VIEW: "dashboard_viewed",
  PAYMENT_CREATE: "payment_created",
  PAYMENT_UPDATE: "payment_updated",
  PAYMENT_MARK_PAID: "payment_marked_paid",
  STATEMENT_IMPORT: "statement_imported",
  STATEMENT_VIEW: "statement_viewed",
  DEBT_CREATE: "debt_created",
  DEBT_UPDATE: "debt_updated",
  DEBT_PAY: "debt_payment_made",
  RECOVERY_PLAN_VIEW: "recovery_plan_viewed",
  FILTER_APPLIED: "filter_applied",
  EXPORT_DATA: "data_exported",
  SETTINGS_UPDATED: "settings_updated",
  CARD_LINKED: "card_linked",
  ACCOUNT_LINKED: "account_linked",
};

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Track analytics event
 * Sends to GA4 if available, logs to console in development
 */
export function trackEvent(eventName: string, properties?: AnalyticsProperties): void {
  try {
    // Send to GA4 if gtag is available
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", eventName, properties);
    }

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Analytics]", eventName, properties);
    }

    // Optional: Send to backend for server-side logging
    if (properties?.logToServer) {
      const eventData = { ...properties };
      delete eventData.logToServer;
      logEventToServer(eventName, eventData).catch((err) => {
        console.error("[Analytics] Failed to log to server:", err);
      });
    }
  } catch (error) {
    console.error("[Analytics] Error tracking event:", error);
  }
}

/**
 * Log event to server (optional, for critical events)
 */
async function logEventToServer(eventName: string, properties: AnalyticsProperties): Promise<void> {
  if (typeof fetch === "undefined") return; // Not in browser

  try {
    await fetch("/api/analytics/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("[Analytics] Server logging error:", error);
  }
}

/**
 * Page view tracking (useful for SPA)
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  trackEvent("page_view", {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * User interaction tracking
 */
export function trackUserAction(action: string, category: string, label?: string): void {
  trackEvent(action, {
    action_category: category,
    action_label: label,
  });
}

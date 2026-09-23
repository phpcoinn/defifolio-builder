const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8034') + '/api.php';

export type ActivityEvent =
  | 'app_opened'
  | 'editor_started'
  | 'profile_imported'
  | 'html_exported'
  | 'ai_bio_generated'
  | 'ai_analysis_generated'
  | 'publish_success'
  | 'wallet_login_success'
  | 'permanent_link_success'
  | 'save_changes_success';

const SESSION_KEY = 'defifolio_activity_session';
const APP_OPENED_KEY = 'defifolio_activity_opened';

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

function campaignValue(name: string): string | undefined {
  const value = new URLSearchParams(window.location.search).get(name)?.trim();
  return value || undefined;
}

function referrerHostname(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname || undefined;
  } catch {
    return undefined;
  }
}

// Best-effort, first-party activity logging. Analytics must never interrupt a
// user's workflow, and event payloads deliberately contain no profile or wallet data.
export function trackEvent(event: ActivityEvent): void {
  if (event === 'app_opened') {
    if (sessionStorage.getItem(APP_OPENED_KEY)) return;
    sessionStorage.setItem(APP_OPENED_KEY, '1');
  }

  void fetch(`${BACKEND_URL}?q=track_event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      session: getSessionId(),
      source: campaignValue('utm_source'),
      campaign: campaignValue('utm_campaign'),
      referrer: referrerHostname(),
    }),
    keepalive: true,
  }).catch(() => {});
}

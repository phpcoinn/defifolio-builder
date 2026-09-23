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

// Best-effort, first-party activity logging. Analytics must never interrupt a
// user's workflow, and event payloads deliberately contain no profile or wallet data.
export function trackEvent(event: ActivityEvent): void {
  void fetch(`${BACKEND_URL}?q=track_event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
    keepalive: true,
  }).catch(() => {});
}

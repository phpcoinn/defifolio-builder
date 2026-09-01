const BACKEND_URL = 'http://localhost:8034/api.php';

export interface WalletAccount {
  address: string;
  public_key: string;
  login_at: string;
  auth_domain: string;
}

export interface WalletSession {
  authenticated: boolean;
  account?: WalletAccount;
}

interface ChallengeResponse {
  nonce: string;
  issued_at: number;
  expires_in_ms: number;
}

async function request<T>(action: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}?q=${encodeURIComponent(action)}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload as T;
}

export const getWalletSession = () =>
  request<WalletSession>('authSession', { method: 'GET' });

export const issueWalletChallenge = () =>
  request<ChallengeResponse>('authChallenge', { method: 'POST', body: JSON.stringify({}) });

export const completeWalletLogin = (payload: unknown) =>
  request<WalletAccount>('walletLogin', { method: 'POST', body: JSON.stringify(payload) });

export const logoutWalletSession = () =>
  request<{ logged_out: boolean }>('authLogout', { method: 'POST', body: JSON.stringify({}) });

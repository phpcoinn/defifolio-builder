// PHPCoin wallet-connect popup protocol, ported from dapad-v2's
// apps/frontend/src/lib/walletConnect.js — same wallet, same message shapes,
// so this must stay wire-compatible with what the wallet app expects.
import { completeWalletLogin, issueWalletChallenge, WalletAccount } from './walletApi';

const WALLET_CONNECT_URL = import.meta.env.VITE_WALLET_CONNECT_URL || 'https://wallet.phpcoin.net/#/connect';
const DEFAULT_TIMEOUT_MS = 120000;

function getWalletConnectOrigin(): string {
  try {
    return new URL(WALLET_CONNECT_URL).origin;
  } catch {
    return '';
  }
}

function openPopup(url: string, title: string): Window | null {
  const width = 480;
  const height = 760;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'popup=yes',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  return window.open(url, title, features);
}

export async function requestWalletAuth(): Promise<WalletAccount> {
  const walletOrigin = getWalletConnectOrigin();
  const popup = openPopup(WALLET_CONNECT_URL, 'phpcoin-wallet-connect');

  if (!popup) {
    throw new Error('Wallet popup was blocked.');
  }

  const challengeResponse = await issueWalletChallenge();
  const nonce = challengeResponse.nonce;
  if (!nonce) {
    popup.close();
    throw new Error('Could not start wallet auth challenge.');
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      popup.close();
      reject(new Error('Wallet connection timed out.'));
    }, DEFAULT_TIMEOUT_MS);

    const closePoll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Wallet popup was closed.'));
      }
    }, 400);

    function cleanup() {
      window.clearTimeout(timeout);
      window.clearInterval(closePoll);
      window.removeEventListener('message', onMessage);
    }

    async function onMessage(event: MessageEvent) {
      if (event.source !== popup) return;
      if (walletOrigin && event.origin !== walletOrigin) return;

      const type = event.data?.type;
      const payload = event.data?.payload || {};

      if (type === 'PHPCOIN_WALLET_READY') {
        popup!.postMessage(
          {
            type: 'PHPCOIN_REQUEST_AUTH',
            payload: {
              domain: window.location.origin,
              nonce,
              issued_at: Date.now(),
            },
          },
          walletOrigin || '*'
        );
        return;
      }

      if (type === 'PHPCOIN_AUTH_REJECTED') {
        cleanup();
        popup!.close();
        reject(new Error(payload.reason || 'Wallet authentication rejected.'));
        return;
      }

      if (type === 'PHPCOIN_AUTH_RESPONSE') {
        try {
          const account = await completeWalletLogin(payload);
          cleanup();
          popup!.close();
          resolve(account);
        } catch (error) {
          cleanup();
          popup!.close();
          reject(error);
        }
      }
    }

    window.addEventListener('message', onMessage);
  });
}

export async function requestWalletTransactionSignature(
  transaction: object,
  chainId: string,
  signatureBase: string
): Promise<Record<string, unknown>> {
  const walletOrigin = getWalletConnectOrigin();
  const popup = openPopup(WALLET_CONNECT_URL, 'phpcoin-wallet-connect');

  if (!popup) {
    throw new Error('Wallet popup was blocked.');
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      popup.close();
      reject(new Error('Wallet signing timed out.'));
    }, DEFAULT_TIMEOUT_MS);

    const closePoll = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Wallet popup was closed.'));
      }
    }, 400);

    function cleanup() {
      window.clearTimeout(timeout);
      window.clearInterval(closePoll);
      window.removeEventListener('message', onMessage);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== popup) return;
      if (walletOrigin && event.origin !== walletOrigin) return;

      const type = event.data?.type;
      const payload = event.data?.payload || {};

      if (type === 'PHPCOIN_WALLET_READY') {
        popup!.postMessage(
          {
            type: 'PHPCOIN_REQUEST_SIGN_TX',
            payload: {
              domain: window.location.origin,
              issued_at: Date.now(),
              transaction,
              chainId,
              signatureBase,
            },
          },
          walletOrigin || '*'
        );
        return;
      }

      if (type === 'PHPCOIN_SIGN_TX_REJECTED') {
        cleanup();
        popup!.close();
        reject(new Error(payload.reason || 'Wallet signing rejected.'));
        return;
      }

      if (type === 'PHPCOIN_SIGN_TX_RESPONSE') {
        cleanup();
        popup!.close();
        try {
          const json = atob(payload.signedTransaction);
          resolve(JSON.parse(json));
        } catch (error) {
          reject(new Error('Could not decode signed transaction.'));
        }
      }
    }

    window.addEventListener('message', onMessage);
  });
}

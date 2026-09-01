import React, { useState, useRef, useEffect } from 'react';
import { Editor } from './components/Editor';
import { PortfolioPreview } from './components/PortfolioPreview';
import { INITIAL_PROFILE, UserProfile, SocialLink, CryptoAddress } from './types';
import { UploadCloud, Smartphone, Monitor, Download, FileJson, Rocket, X, Copy, ExternalLink, Check, Globe, Edit3, Eye, Sun, Moon, Wallet, LogOut } from 'lucide-react';
import { requestWalletAuth, requestWalletTransactionSignature } from './services/walletConnect';
import { getWalletSession, logoutWalletSession, WalletAccount } from './services/walletApi';
import { buildPublishTransaction, submitTransaction, findLatestPublish, PublishRecord, CHAIN_ID } from './services/txData';

// Configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8034';
const PUBLISH_API_URL = `${BACKEND_URL}/api.php?q=publish_ipfs`;
const IPFS_GATEWAY_URL = 'https://ipfs.phpcoin.net/ipfs/'; // Our own node's gateway - reliable for content we just published
const permanentLinkUrl = (address: string) => `https://defifolio.dap.ad/p/${address}`;
const explorerTxUrl = (txId: string) => `https://main1.phpcoin.net/apps/explorer/tx.php?id=${txId}`;
const STORAGE_KEY = 'defifolio_draft_v1';
const THEME_STORAGE_KEY = 'defifolio_theme';
const SHOW_DNS_SECTION = true; // Shows the dap.ad custom-domain promotion after publishing
const SHOW_STABLE_LINK_SECTION = true; // Shows the "login with PHPCoin for a stable link" promotion after publishing

// SVG Paths for the exported HTML to avoid dependency on external icon libs
const ICONS: Record<string, string> = {
  x: '<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  telegram: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  discord: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M7.5 7.2c.3-.4.8-.7 1.3-.8 1.2.3 2.5.5 3.9.5 1.3 0 2.6-.2 3.8-.5.5.1 1 .4 1.3.8 0 0 2.7 4.9 2.7 10.8 0 0-1.8 1.9-4 2.2-1.3-.9-2.2-2.3-2.6-3.8-1.2.4-2.5.4-3.7 0-.4 1.5-1.3 2.9-2.6 3.8-2.2-.3-4-2.2-4-2.2 0-5.9 2.7-10.8 2.7-10.8Z"/>',
  website: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  qrcode: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"/>'
};

// Sanitization helpers for the exported/published HTML. All profile fields can come
// from an imported file, so nothing is trusted when interpolated into raw HTML strings.
const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

const isSafeColor = (hex: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex || '');
const sanitizeColor = (hex: string, fallback: string) => (isSafeColor(hex) ? hex : fallback);

// Only allow schemes that can't execute script (blocks javascript:, vbscript:, data:text/html, etc).
const sanitizeUrl = (url: string, allowedSchemes: string[], fallback: string) => {
  const trimmed = (url || '').trim();
  if (!trimmed) return fallback;
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return trimmed; // scheme-less (relative/protocol-relative) is safe
  return allowedSchemes.includes(schemeMatch[1].toLowerCase()) ? trimmed : fallback;
};
const sanitizeLinkUrl = (url: string) => sanitizeUrl(url, ['http', 'https', 'mailto'], '#');
const sanitizeImageUrl = (url: string, fallback: string) => sanitizeUrl(url, ['http', 'https', 'data'], fallback);

// Validates and coerces an imported (untrusted) profile JSON blob into a well-shaped
// UserProfile. Imported files can come from anywhere, so nothing about their structure
// is trusted — wrong types, missing fields, or oversized arrays must not crash the app.
const MAX_LIST_ITEMS = 50;
const MAX_TEXT_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 3_000_000; // generous cap for base64 data URIs

const asString = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.slice(0, maxLength) : '';

const validateImportedProfile = (data: unknown): UserProfile | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const name = asString(d.name, 100).trim();
  if (!name) return null;

  const rawSocials = Array.isArray(d.socials) ? d.socials.slice(0, MAX_LIST_ITEMS) : [];
  const rawAddresses = Array.isArray(d.addresses) ? d.addresses.slice(0, MAX_LIST_ITEMS) : [];

  const socials: SocialLink[] = rawSocials
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s, i) => ({
      id: asString(s.id, 50) || `social-${i}`,
      platform: (asString(s.platform, 30) || 'website') as SocialLink['platform'],
      url: asString(s.url, MAX_TEXT_LENGTH),
    }));

  const addresses: CryptoAddress[] = rawAddresses
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a, i) => ({
      id: asString(a.id, 50) || `address-${i}`,
      network: asString(a.network, 50),
      address: asString(a.address, 200),
      label: asString(a.label, 50),
      color: isSafeColor(a.color as string) ? (a.color as string) : '#627EEA',
    }));

  return {
    name,
    title: asString(d.title, 150),
    bio: asString(d.bio, MAX_TEXT_LENGTH),
    avatarUrl: asString(d.avatarUrl, MAX_IMAGE_URL_LENGTH),
    coverImageUrl: d.coverImageUrl ? asString(d.coverImageUrl, MAX_IMAGE_URL_LENGTH) : undefined,
    themeColor: isSafeColor(d.themeColor as string) ? (d.themeColor as string) : '#818cf8',
    backgroundColor: isSafeColor(d.backgroundColor as string) ? (d.backgroundColor as string) : '#0b1120',
    socials,
    addresses,
  };
};

// Shared by file-based import and wallet-based profile loading - both start
// from a full exported HTML page and pull the embedded profile JSON out of it.
const parseProfileFromHtml = (html: string): UserProfile | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const scriptTag = doc.getElementById('defifolio-data');
  if (!scriptTag || !scriptTag.textContent) return null;
  try {
    return validateImportedProfile(JSON.parse(scriptTag.textContent));
  } catch {
    return null;
  }
};

function App() {
  // Initialize state from localStorage if available, otherwise use default
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_PROFILE;
    } catch (e) {
      console.warn("Failed to load draft from storage", e);
      return INITIAL_PROFILE;
    }
  });

  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ cid: string; url: string } | null>(null);
  const [hasCopiedCid, setHasCopiedCid] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [walletAccount, setWalletAccount] = useState<WalletAccount | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [existingPublish, setExistingPublish] = useState<PublishRecord | null>(null);
  const [justUpdatedTxId, setJustUpdatedTxId] = useState<string | null>(null);
  const [isCheckingExistingPublish, setIsCheckingExistingPublish] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save effect: Save to localStorage whenever profile changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  // Restore an existing wallet session on load
  useEffect(() => {
    getWalletSession()
      .then((session) => setWalletAccount(session.account ?? null))
      .catch(() => setWalletAccount(null));
  }, []);

  // Whenever we know who's signed in, check whether they already have a
  // permanent link so we don't re-pitch "get one" to someone who already has one.
  useEffect(() => {
    if (!walletAccount) {
      setExistingPublish(null);
      return;
    }
    setIsCheckingExistingPublish(true);
    findLatestPublish(walletAccount.address)
      .then(setExistingPublish)
      .catch(() => setExistingPublish(null))
      .finally(() => setIsCheckingExistingPublish(false));
  }, [walletAccount]);

  // Sync theme choice to <html> class and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Helper for generating the HTML
  const generateHtml = (p: UserProfile) => {
    const primaryColor = sanitizeColor(p.themeColor, '#818cf8');
    const bgColor = sanitizeColor(p.backgroundColor, '#0b1120');

    // Luminance logic for export
    const getLuminance = (hex: string) => {
      if(!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return 0;
      let c = hex.substring(1);
      if(c.length === 3) c = c.split('').map(x => x + x).join('');
      const rgb = parseInt(c, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    const isLightMode = getLuminance(bgColor) > 180;
    const textColor = isLightMode ? '#0f172a' : '#f8fafc';
    const mutedTextColor = isLightMode ? '#475569' : '#94a3b8';
    const cardBgBase = isLightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)';
    const cardBorderBase = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
    const iconColor = isLightMode ? '#64748b' : '#94a3b8';

    const hexToRgba = (hex: string, alpha: number) => {
        let c: any;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return `rgba(129, 140, 248, ${alpha})`;
    };

    const socialsHtml = p.socials.map(s => {
        const iconSvg = ICONS[s.platform] || ICONS.link;
        return `
        <a href="${escapeHtml(sanitizeLinkUrl(s.url))}" target="_blank" rel="noreferrer" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">${iconSvg}</svg>
            <span style="font-size: 0.875rem; font-weight: 500; text-transform: capitalize;">${escapeHtml(s.platform)}</span>
        </a>`;
    }).join('');

    const addressesHtml = p.addresses.map(a => {
        // Only show label badge if label text exists
        const labelHtml = a.label && a.label.trim() !== "" ? `<span class="label-badge">${escapeHtml(a.label)}</span>` : '';
        const safeAddress = escapeHtml(a.address);
        return `
        <div class="address-card" onclick="void(0)">
            <div class="card-header">
                <div>
                     ${labelHtml}
                     <h3 style="font-size: 1.125rem; font-weight: 700; color: ${textColor};">${escapeHtml(a.network)}</h3>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                     <button data-address="${safeAddress}" onclick="showQr(this.dataset.address)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.qrcode}</svg>
                     </button>
                     <button data-address="${safeAddress}" onclick="copyToClipboard(this.dataset.address, this)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.copy}</svg>
                     </button>
                </div>
            </div>
            <div class="address-text">${safeAddress}</div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(p.name)} - Portfolio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background-color: ${bgColor}; color: ${textColor}; margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 4px; }
        
        /* Dynamic Styles */
        .social-link {
            display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.75rem; border: 1px solid ${cardBorderBase}; background-color: ${cardBgBase}; color: ${iconColor}; text-decoration: none; transition: all 0.2s;
        }
        .social-link:hover {
            background-color: ${hexToRgba(primaryColor, 0.2)}; border-color: ${primaryColor}; color: ${primaryColor};
        }
        
        .address-card {
            position: relative; border-radius: 1rem; padding: 1.25rem; border: 1px solid ${cardBorderBase}; background-color: ${cardBgBase}; margin-bottom: 1rem; transition: all 0.3s;
        }
        .address-card:hover {
            background-color: ${hexToRgba(primaryColor, 0.05)}; border-color: ${hexToRgba(primaryColor, 0.4)}; transform: translateY(-2px); box-shadow: 0 10px 30px -10px ${hexToRgba(primaryColor, 0.2)};
        }
        
        .label-badge {
            display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;
            background-color: ${hexToRgba(primaryColor, 0.2)}; color: ${primaryColor}; border: 1px solid ${hexToRgba(primaryColor, 0.2)};
        }
        
        .icon-btn {
            padding: 0.5rem; border-radius: 0.5rem; transition: background-color 0.2s; color: ${iconColor}; border: none; background: transparent; cursor: pointer;
        }
        .icon-btn:hover { background-color: rgba(128,128,128,0.1); color: ${isLightMode ? '#000' : '#fff'}; }
        
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        
        .address-text {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.875rem; padding: 0.75rem; border-radius: 0.5rem; word-break: break-all;
            background-color: ${isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.3)'}; color: ${isLightMode ? '#334155' : 'rgba(255,255,255,0.8)'}; border: 1px solid ${isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'};
        }

        /* Modal */
        #qr-modal { display: none; position: fixed; inset: 0; background-color: rgba(0,0,0,0.8); z-index: 50; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        #qr-modal.flex { display: flex; }
    </style>
</head>
<body class="custom-scrollbar">

    <!-- Cover -->
    <div style="position: relative; width: 100%;">
        ${p.coverImageUrl ?
            `<div style="width: 100%; height: 16rem; position: relative;">
                <img src="${escapeHtml(sanitizeImageUrl(p.coverImageUrl, ''))}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, ${bgColor}, transparent);"></div>
            </div>` :
            `<div style="width: 100%; height: 16rem; background: linear-gradient(to bottom, ${hexToRgba(primaryColor, 0.3)}, ${hexToRgba(primaryColor, 0.05)}, transparent);"></div>`
        }
    </div>

    <!-- Content -->
    <div style="max-width: 36rem; margin: 0 auto; padding: 0 2rem 3rem 2rem; position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; margin-top: -6rem; width: 100%; box-sizing: border-box;">
        
        <!-- Avatar -->
        <div style="width: 8rem; height: 8rem; border-radius: 9999px; border: 4px solid ${p.coverImageUrl ? bgColor : hexToRgba(primaryColor, 0.2)}; background-color: ${isLightMode ? '#fff' : '#0f172a'}; overflow: hidden; margin-bottom: 1rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <img src="${escapeHtml(sanitizeImageUrl(p.avatarUrl, ''))}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>

        <!-- Info -->
        <h1 style="font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 0.5rem; text-align: center;">${escapeHtml(p.name)}</h1>
        <p style="font-size: 1rem; font-weight: 500; color: ${primaryColor}; margin-bottom: 0.75rem; text-align: center;">${escapeHtml(p.title)}</p>
        <p style="font-size: 0.875rem; line-height: 1.625; color: ${mutedTextColor}; margin-bottom: 1.5rem; text-align: center; max-width: 24rem;">${escapeHtml(p.bio)}</p>

        <!-- Socials -->
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; margin-bottom: 2rem;">
            ${socialsHtml}
        </div>

        <!-- Addresses -->
        <div style="width: 100%; display: flex; flex-direction: column; gap: 1rem;">
            ${addressesHtml}
        </div>

        <!-- Footer -->
        <div style="margin-top: 3rem; text-align: center; opacity: 0.5;">
            <a href="https://defifolio.dap.ad" target="_blank" style="text-decoration: none; color: ${mutedTextColor}; font-size: 0.75rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;">
                Built with PHPCoin DeFiFolio
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
        </div>

    </div>

    <!-- QR Modal -->
    <div id="qr-modal" onclick="closeQr()">
        <div style="background-color: #0f172a; border: 1px solid #334155; padding: 1.5rem; border-radius: 1rem; max-width: 20rem; width: 100%; position: relative;" onclick="event.stopPropagation()">
            <button onclick="closeQr()" style="position: absolute; top: 1rem; right: 1rem; color: #94a3b8; background: none; border: none; cursor: pointer;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.close}</svg>
            </button>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center; color: white;">Scan to Pay</h3>
            <div style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
                <div style="background-color: white; padding: 1rem; border-radius: 0.75rem;">
                    <img id="qr-image" src="" alt="QR Code" style="width: 12rem; height: 12rem;">
                </div>
            </div>
            <p id="qr-address" style="text-align: center; color: #94a3b8; font-family: monospace; font-size: 0.75rem; word-break: break-all; background-color: #1e293b; padding: 0.75rem; border-radius: 0.25rem; margin: 0;"></p>
        </div>
    </div>

    <!-- EMBEDDED CONFIGURATION DATA -->
    <script id="defifolio-data" type="application/json">
        ${JSON.stringify(p).replace(/</g, '\\u003c')}
    </script>

    <script>
        function copyToClipboard(text, btn) {
            navigator.clipboard.writeText(text).then(() => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.check}</svg>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 2000);
            });
        }

        function showQr(address) {
            const modal = document.getElementById('qr-modal');
            const img = document.getElementById('qr-image');
            const addrText = document.getElementById('qr-address');
            
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(address);
            addrText.textContent = address;
            modal.classList.add('flex');
        }

        function closeQr() {
            document.getElementById('qr-modal').classList.remove('flex');
        }
    </script>
</body>
</html>`;
  };

  const handleDeploy = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      const htmlContent = generateHtml(profile);
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", "index.html");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
        const htmlContent = generateHtml(profile);
        
        // Use Fetch API to send data to the backend
        const response = await fetch(PUBLISH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ html: htmlContent })
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
        }

        const data = await response.json();
        
        // Expecting { ipfsCID: "..." } from the backend
        if (data.ipfsCID) {
             setPublishResult({
                cid: data.ipfsCID,
                url: `${IPFS_GATEWAY_URL}${data.ipfsCID}`
            });
        } else {
             throw new Error("Invalid response: ipfsCID not found in server response.");
        }

    } catch (error) {
        console.error("Publishing error:", error);
        alert("Failed to publish to IPFS. Please check that the backend is running and configured correctly.");
    } finally {
        setIsPublishing(false);
    }
  };

  const handleCopyCid = () => {
    if (publishResult) {
        navigator.clipboard.writeText(publishResult.cid);
        setHasCopiedCid(true);
        setTimeout(() => setHasCopiedCid(false), 2000);
    }
  };

  const handlePhpCoinLogin = async () => {
    setIsWalletConnecting(true);
    try {
      const account = await requestWalletAuth();
      setWalletAccount(account);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Wallet login failed.');
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handlePhpCoinLogout = async () => {
    try {
      await logoutWalletSession();
    } finally {
      setWalletAccount(null);
      setJustUpdatedTxId(null);
    }
  };

  // Loads the caller's existing on-chain profile, if any - their PHPCoin
  // address doubles as portable profile storage across devices. Silently
  // does nothing if there's no published profile yet (first-time user).
  const loadProfileFromChainIfAny = async (address: string) => {
    try {
      const record = await findLatestPublish(address);
      if (!record) return;

      const response = await fetch(`${IPFS_GATEWAY_URL}${record.cid}`);
      if (!response.ok) throw new Error('Could not fetch saved profile');

      const loadedProfile = parseProfileFromHtml(await response.text());
      if (!loadedProfile) return;

      if (confirm('Load your saved profile from PHPCoin? This will replace your current draft.')) {
        setProfile(loadedProfile);
      }
    } catch (error) {
      console.error('Failed to load profile from chain:', error);
      // Don't alert - login itself still succeeded, this is a bonus on top of it.
    }
  };

  const handleHeaderLogin = async () => {
    setIsWalletConnecting(true);
    try {
      const account = await requestWalletAuth();
      setWalletAccount(account);
      await loadProfileFromChainIfAny(account.address);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Wallet login failed.');
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const handlePinToAddress = async () => {
    if (!walletAccount || !publishResult) return;
    setIsPinning(true);
    try {
      const { tx, signatureBase } = await buildPublishTransaction(
        walletAccount.address,
        walletAccount.public_key,
        publishResult.cid
      );
      const signedTx = await requestWalletTransactionSignature(tx, CHAIN_ID, signatureBase);
      const txId = await submitTransaction(signedTx);
      setExistingPublish({ txId, cid: publishResult.cid });
      setJustUpdatedTxId(txId);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not create the permanent link.');
    } finally {
      setIsPinning(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        try {
          const importedProfile = parseProfileFromHtml(text);
          if (importedProfile) {
             setProfile(importedProfile);
             alert('Profile loaded successfully!');
          } else {
             alert('Could not find a valid portfolio in this file.');
          }
        } catch (err) {
          console.error(err);
          alert('Error parsing portfolio file.');
        }
      };
      reader.readAsText(file);
    }
    // Reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-crypto-dark text-slate-800 dark:text-slate-200 font-sans overflow-hidden flex-col md:flex-row">
      {/* Hidden Import Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport} 
        className="hidden" 
        accept=".html" 
      />

       {/* Mobile Nav - Visible only on small screens */}
       <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-50 pb-safe">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'editor' ? 'text-crypto-accent' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <Edit3 size={20} />
            <span className="text-[10px] font-medium">Editor</span>
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'preview' ? 'text-crypto-accent' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <Eye size={20} />
            <span className="text-[10px] font-medium">Preview</span>
          </button>
       </div>

      {/* Left Panel: Editor */}
      <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-crypto-panel z-20 shadow-2xl h-full`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">D</div>
                <h1 className="font-bold text-lg tracking-tight">DeFiFolio</h1>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsDarkMode(prev => !prev)}
                    className="flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 w-8 h-8 rounded-lg transition-colors"
                    title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                    onClick={handleImportClick}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                    title="Import existing portfolio HTML"
                >
                    <FileJson size={14} /> Import
                </button>
                {walletAccount ? (
                    <button
                        onClick={handlePhpCoinLogout}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                        title={`Signed in as ${walletAccount.address}`}
                    >
                        <Wallet size={14} /> {walletAccount.address.slice(0, 6)}…{walletAccount.address.slice(-4)}
                    </button>
                ) : (
                    <button
                        onClick={handleHeaderLogin}
                        disabled={isWalletConnecting}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        title="Login with PHPCoin to load your saved profile"
                    >
                        <Wallet size={14} /> {isWalletConnecting ? 'Connecting...' : 'Login'}
                    </button>
                )}
            </div>
        </div>
        <div className="flex-1 overflow-hidden">
             <Editor profile={profile} setProfile={setProfile} />
        </div>
      </div>

      {/* Right Panel: Preview Area */}
      <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-slate-50 dark:bg-[#0f172a] relative h-full`}>
        {/* Toolbar */}
        <div className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur z-10 shrink-0 gap-2">
            <div className="flex items-center gap-4 hidden md:flex">
                <span className="text-sm text-slate-500 dark:text-slate-500 font-medium">Preview Mode</span>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setViewMode('desktop')}
                        className={`p-2 rounded flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'desktop' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Monitor size={14} /> Desktop
                    </button>
                    <button
                        onClick={() => setViewMode('mobile')}
                        className={`p-2 rounded flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'mobile' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                        <Smartphone size={14} /> Mobile
                    </button>
                </div>
            </div>

             {/* Mobile Title */}
             <div className="md:hidden flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">D</div>
                  <span className="font-bold text-sm">Preview</span>
              </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={handleDeploy}
                    disabled={isUploading || isPublishing}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-70"
                >
                    {isUploading ? <UploadCloud size={16} className="animate-bounce" /> : <Download size={16} />}
                    <span className="hidden sm:inline">{isUploading ? 'Exporting...' : 'Download HTML'}</span>
                </button>
                
                <button 
                    onClick={handlePublish}
                    disabled={isUploading || isPublishing}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70"
                >
                    {isPublishing ? <Rocket size={16} className="animate-bounce" /> : <Rocket size={16} />}
                     <span className="hidden sm:inline">{isPublishing ? 'Publishing...' : 'Publish to IPFS'}</span>
                </button>
            </div>
        </div>

        {/* Preview Container */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-100 dark:bg-slate-950">
            {/* Dot Grid Background */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <div className={`transition-all duration-500 ease-in-out shadow-2xl overflow-hidden bg-black flex flex-col ${
                viewMode === 'mobile' 
                ? 'w-full h-full md:w-[375px] md:h-[812px] md:rounded-[3rem] md:border-[8px] md:border-slate-800 md:ring-4 md:ring-black md:shadow-slate-900/50' 
                : 'w-full h-full'
            }`}>
                {viewMode === 'mobile' && (
                    <div className="h-6 bg-slate-800 w-full justify-center items-center shrink-0 hidden md:flex">
                         <div className="w-16 h-4 bg-black rounded-b-xl"></div>
                    </div>
                )}
                <div className="flex-1 overflow-hidden relative w-full h-full">
                    <PortfolioPreview profile={profile} />
                </div>
                 {viewMode === 'mobile' && (
                    <div className="h-2 bg-black w-full shrink-0 hidden md:block"></div>
                )}
            </div>
        </div>
      </div>

      {/* Success Modal */}
      {publishResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl max-w-md w-full relative shadow-2xl">
                <button
                    onClick={() => setPublishResult(null)}
                    className="absolute top-4 right-4 text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Rocket size={32} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Portfolio Published!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Your decentralized portfolio is live on IPFS.</p>
                </div>

                <div className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">IPFS CID</label>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
                        <code className="text-xs text-slate-700 dark:text-slate-300 font-mono flex-1 truncate">{publishResult.cid}</code>
                        <button
                            onClick={handleCopyCid}
                            className="text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {hasCopiedCid ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    </div>
                    <div className="mt-3 text-center">
                         <a 
                            href={publishResult.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                         >
                            View Live Profile <ExternalLink size={14} />
                         </a>
                         <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">
                            Temporary link — not pinned, may eventually expire.
                         </p>
                    </div>
                </div>

                {SHOW_STABLE_LINK_SECTION && (
                    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-lg text-cyan-600 dark:text-cyan-400">
                                <Wallet size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-1">
                                    {existingPublish ? 'Your Permanent Link' : 'Get a Free Permanent Link'}
                                </h3>
                                {walletAccount ? (
                                    <>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-3">
                                            Signed in as <code className="text-slate-700 dark:text-slate-300">{walletAccount.address.slice(0, 6)}…{walletAccount.address.slice(-4)}</code>.{' '}
                                            {isCheckingExistingPublish
                                                ? 'Checking for an existing link...'
                                                : existingPublish && publishResult && existingPublish.cid === publishResult.cid
                                                ? 'Your permanent link points at this publish.'
                                                : existingPublish
                                                ? 'Your permanent link points at an older publish.'
                                                : 'Point your permanent link at this publish.'}
                                        </p>
                                        {existingPublish && (
                                            <div className="bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs rounded-lg p-2 mb-3 break-all">
                                                <a
                                                    href={permanentLinkUrl(walletAccount.address)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline hover:no-underline"
                                                >
                                                    {permanentLinkUrl(walletAccount.address)}
                                                </a>
                                                {justUpdatedTxId && justUpdatedTxId === existingPublish.txId && (
                                                    <div className="mt-1 text-slate-600 dark:text-slate-400">
                                                        Submitted — tx{' '}
                                                        <a
                                                            href={explorerTxUrl(justUpdatedTxId)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="underline hover:no-underline"
                                                        >
                                                            <code>{justUpdatedTxId}</code>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!isCheckingExistingPublish && (!existingPublish || (publishResult && existingPublish.cid !== publishResult.cid)) && (
                                            <button
                                                onClick={handlePinToAddress}
                                                disabled={isPinning}
                                                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-center py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 mb-2"
                                            >
                                                {isPinning ? 'Signing...' : existingPublish ? 'Update to This Publish' : 'Get Permanent Link'}
                                            </button>
                                        )}
                                        <button
                                            onClick={handlePhpCoinLogout}
                                            className="w-full flex items-center justify-center gap-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-center py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            <LogOut size={12} /> Logout
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-3">
                                            Sign in with PHPCoin to get a stable link that always follows your latest publish, for just a small network fee.
                                        </p>
                                        <button
                                            onClick={handlePhpCoinLogin}
                                            disabled={isWalletConnecting}
                                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-center py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
                                        >
                                            {isWalletConnecting ? 'Connecting...' : 'Login with PHPCoin'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {SHOW_DNS_SECTION && (
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/40 border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Globe size={20} />
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-1">Get a Human-Readable Name</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mb-3">
                                    Map your profile to a decentralized domain (e.g. <span className="text-slate-700 dark:text-slate-300">alex.dap.ad</span>) using dap.ad.
                                </p>
                                <a
                                    href="https://dap.ad"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white text-center py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Register on dap.ad
                                </a>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState, useRef, useEffect } from 'react';
import { Editor } from './components/Editor';
import { PortfolioPreview } from './components/PortfolioPreview';
import { INITIAL_PROFILE, UserProfile } from './types';
import { UploadCloud, Smartphone, Monitor, Download, FileJson, Rocket, X, Copy, ExternalLink, Check, Globe, Edit3, Eye } from 'lucide-react';

// Configuration
const PUBLISH_API_URL = 'https://dap.ad/ipfs.php?q=publish_ipfs'; 
const IPFS_GATEWAY_URL = 'https://ipfs.io/ipfs/'; // Configurable Gateway URL
const STORAGE_KEY = 'defifolio_draft_v1';
const SHOW_DNS_SECTION = false; // Set to true to show the PHPCoin DNS promotion

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save effect: Save to localStorage whenever profile changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  // Helper for generating the HTML
  const generateHtml = (p: UserProfile) => {
    const primaryColor = p.themeColor;
    const bgColor = p.backgroundColor;
    
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
        <a href="${s.url}" target="_blank" rel="noreferrer" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">${iconSvg}</svg>
            <span style="font-size: 0.875rem; font-weight: 500; text-transform: capitalize;">${s.platform}</span>
        </a>`;
    }).join('');

    const addressesHtml = p.addresses.map(a => {
        // Only show label badge if label text exists
        const labelHtml = a.label && a.label.trim() !== "" ? `<span class="label-badge">${a.label}</span>` : '';
        return `
        <div class="address-card" onclick="void(0)">
            <div class="card-header">
                <div>
                     ${labelHtml}
                     <h3 style="font-size: 1.125rem; font-weight: 700; color: ${textColor};">${a.network}</h3>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                     <button onclick="showQr('${a.address}')" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.qrcode}</svg>
                     </button>
                     <button onclick="copyToClipboard('${a.address}', this)" class="icon-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.copy}</svg>
                     </button>
                </div>
            </div>
            <div class="address-text">${a.address}</div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${p.name} - Portfolio</title>
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
                <img src="${p.coverImageUrl}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, ${bgColor}, transparent);"></div>
            </div>` : 
            `<div style="width: 100%; height: 16rem; background: linear-gradient(to bottom, ${hexToRgba(primaryColor, 0.3)}, ${hexToRgba(primaryColor, 0.05)}, transparent);"></div>`
        }
    </div>

    <!-- Content -->
    <div style="max-width: 36rem; margin: 0 auto; padding: 0 2rem 3rem 2rem; position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; margin-top: -6rem; width: 100%; box-sizing: border-box;">
        
        <!-- Avatar -->
        <div style="width: 8rem; height: 8rem; border-radius: 9999px; border: 4px solid ${p.coverImageUrl ? bgColor : hexToRgba(primaryColor, 0.2)}; background-color: ${isLightMode ? '#fff' : '#0f172a'}; overflow: hidden; margin-bottom: 1rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
            <img src="${p.avatarUrl}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>

        <!-- Info -->
        <h1 style="font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 0.5rem; text-align: center;">${p.name}</h1>
        <p style="font-size: 1rem; font-weight: 500; color: ${primaryColor}; margin-bottom: 0.75rem; text-align: center;">${p.title}</p>
        <p style="font-size: 0.875rem; line-height: 1.625; color: ${mutedTextColor}; margin-bottom: 1.5rem; text-align: center; max-width: 24rem;">${p.bio}</p>

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
            <a href="https://phpcoin.net" target="_blank" style="text-decoration: none; color: ${mutedTextColor}; font-size: 0.75rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.25rem;">
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
        ${JSON.stringify(p)}
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
            
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + address;
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
          // Parse HTML to find the data script
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const scriptTag = doc.getElementById('defifolio-data');
          
          if (scriptTag && scriptTag.textContent) {
            const importedProfile = JSON.parse(scriptTag.textContent);
            if (importedProfile && importedProfile.name) {
               setProfile(importedProfile);
               alert('Profile loaded successfully!');
            } else {
               alert('Invalid portfolio file.');
            }
          } else {
            alert('Could not find portfolio data in this file.');
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
    <div className="flex h-screen w-screen bg-crypto-dark text-slate-200 font-sans overflow-hidden flex-col md:flex-row">
      {/* Hidden Import Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport} 
        className="hidden" 
        accept=".html" 
      />

       {/* Mobile Nav - Visible only on small screens */}
       <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around z-50 pb-safe">
          <button 
            onClick={() => setMobileTab('editor')}
            className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'editor' ? 'text-crypto-accent' : 'text-slate-500'}`}
          >
            <Edit3 size={20} />
            <span className="text-[10px] font-medium">Editor</span>
          </button>
          <button 
            onClick={() => setMobileTab('preview')}
            className={`flex flex-col items-center gap-1 p-2 ${mobileTab === 'preview' ? 'text-crypto-accent' : 'text-slate-500'}`}
          >
            <Eye size={20} />
            <span className="text-[10px] font-medium">Preview</span>
          </button>
       </div>

      {/* Left Panel: Editor */}
      <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} md:flex w-full md:w-[400px] flex-shrink-0 flex-col border-r border-slate-800 bg-crypto-panel z-20 shadow-2xl h-full`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">D</div>
                <h1 className="font-bold text-lg tracking-tight">DeFiFolio</h1>
            </div>
            <button 
                onClick={handleImportClick}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                title="Import existing portfolio HTML"
            >
                <FileJson size={14} /> Import
            </button>
        </div>
        <div className="flex-1 overflow-hidden">
             <Editor profile={profile} setProfile={setProfile} />
        </div>
      </div>

      {/* Right Panel: Preview Area */}
      <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-[#0f172a] relative h-full`}>
        {/* Toolbar */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 bg-slate-900/50 backdrop-blur z-10 shrink-0 gap-2">
            <div className="flex items-center gap-4 hidden md:flex">
                <span className="text-sm text-slate-500 font-medium">Preview Mode</span>
                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button 
                        onClick={() => setViewMode('desktop')}
                        className={`p-2 rounded flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'desktop' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Monitor size={14} /> Desktop
                    </button>
                    <button 
                        onClick={() => setViewMode('mobile')}
                        className={`p-2 rounded flex items-center gap-2 text-xs font-medium transition-all ${viewMode === 'mobile' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
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
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-70"
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
        <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-slate-950">
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
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-md w-full relative shadow-2xl">
                <button 
                    onClick={() => setPublishResult(null)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Rocket size={32} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Portfolio Published!</h2>
                    <p className="text-slate-400 text-sm">Your decentralized portfolio is live on IPFS.</p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">IPFS CID</label>
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded p-2">
                        <code className="text-xs text-slate-300 font-mono flex-1 truncate">{publishResult.cid}</code>
                        <button 
                            onClick={handleCopyCid}
                            className="text-slate-400 hover:text-white transition-colors"
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
                            View Live Site <ExternalLink size={14} />
                         </a>
                    </div>
                </div>

                {SHOW_DNS_SECTION && (
                    <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <Globe size={20} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-sm mb-1">Get a Human-Readable Name</h3>
                                <p className="text-slate-400 text-xs mb-3">
                                    Map this CID to a decentralized domain (e.g. <span className="text-slate-300">alex.phpcoin</span>) using PHPCoin DNS.
                                </p>
                                <a 
                                    href="https://node1.phpcoin.net/dapps/PeC85pqFgRxmevonG6diUwT4AfF7YUPSm3/dev/dns" 
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white text-center py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Register on PHPCoin DNS
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
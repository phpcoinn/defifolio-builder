import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { ExternalLink, Copy, Check, QrCode, Twitter, Github, Globe, Send, Gamepad2, Sparkles, X } from 'lucide-react';
import { analyzePortfolio } from '../services/gemini';

interface PreviewProps {
  profile: UserProfile;
}

export const PortfolioPreview: React.FC<PreviewProps> = ({ profile }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQr, setActiveQr] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [hoveredSocial, setHoveredSocial] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const copyAddress = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    // Debounce AI analysis
    const timer = setTimeout(async () => {
        // Removed API Key check, now relies on backend availability
        if (profile.addresses.length > 0) {
            const result = await analyzePortfolio(profile);
            setAiAnalysis(result);
        }
    }, 2000);
    return () => clearTimeout(timer);
  }, [profile.addresses]);

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter size={18} />; // Legacy
      case 'x': return <X size={18} />;
      case 'github': return <Github size={18} />;
      case 'telegram': return <Send size={18} />;
      case 'discord': return <Gamepad2 size={18} />;
      case 'website': return <Globe size={18} />;
      default: return <ExternalLink size={18} />;
    }
  };

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
    return `rgba(129, 140, 248, ${alpha})`; // fallback indigo-400
  }

  // Determine if background is light or dark
  const getLuminance = (hex: string) => {
      if(!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return 0;
      let c = hex.substring(1);
      if(c.length === 3) c = c.split('').map(x => x + x).join('');
      const rgb = parseInt(c, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      // Standard luminance formula
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const primaryColor = profile.themeColor || '#818cf8';
  const isLightMode = getLuminance(profile.backgroundColor) > 180; // Threshold for switching to dark text

  // Dynamic colors based on luminance
  const textColor = isLightMode ? '#0f172a' : '#f8fafc'; // Slate-900 vs Slate-50
  const mutedTextColor = isLightMode ? '#475569' : '#94a3b8'; // Slate-600 vs Slate-400
  const cardBgBase = isLightMode ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)';
  const cardBorderBase = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
  const iconBaseColor = isLightMode ? '#64748b' : '#94a3b8';

  return (
    <div 
        className="h-full overflow-y-auto custom-scrollbar relative transition-colors duration-300 flex flex-col pb-24 md:pb-0" 
        style={{ backgroundColor: profile.backgroundColor, color: textColor }}
    >
      {/* Cover Image or Gradient Background */}
      <div className="relative w-full shrink-0">
          {profile.coverImageUrl ? (
            <div className="w-full h-48 sm:h-64 relative">
                <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                <div 
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(to top, ${profile.backgroundColor}, transparent)` }}
                />
            </div>
          ) : (
            <div 
                className="w-full h-48 sm:h-64"
                style={{
                    background: `linear-gradient(to bottom, ${hexToRgba(primaryColor, 0.3)}, ${hexToRgba(primaryColor, 0.05)}, transparent)`
                }} 
            />
          )}
      </div>
      
      <div className={`max-w-xl mx-auto px-8 pb-12 relative z-10 flex flex-col items-center w-full -mt-24 sm:-mt-28 flex-1`}>
        {/* Header / Identity */}
        <div className="flex flex-col items-center text-center mb-8 w-full">
          <div 
            className="w-32 h-32 rounded-full border-4 shadow-2xl overflow-hidden mb-4 relative z-10" 
            style={{ 
                borderColor: profile.coverImageUrl ? profile.backgroundColor : hexToRgba(primaryColor, 0.2),
                backgroundColor: isLightMode ? '#fff' : '#0f172a'
            }}
          >
            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: textColor }}>
            {profile.name}
          </h1>
          <p className="text-base font-medium mb-3" style={{ color: primaryColor }}>{profile.title}</p>
          <p className="text-sm max-w-sm leading-relaxed mb-6 mix-blend-screen" style={{ color: mutedTextColor }}>{profile.bio}</p>

          {/* Socials - Styled with Theme Color */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {profile.socials.map(social => (
                <a 
                    key={social.id} 
                    href={social.url} 
                    target="_blank" 
                    rel="noreferrer"
                    onMouseEnter={() => setHoveredSocial(social.id)}
                    onMouseLeave={() => setHoveredSocial(null)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border"
                    style={{
                        backgroundColor: hoveredSocial === social.id ? hexToRgba(primaryColor, 0.2) : cardBgBase,
                        borderColor: hoveredSocial === social.id ? primaryColor : cardBorderBase,
                        color: hoveredSocial === social.id ? primaryColor : iconBaseColor
                    }}
                >
                    {getSocialIcon(social.platform)}
                    <span className="text-sm font-medium capitalize">{social.platform}</span>
                </a>
            ))}
          </div>
        </div>

        {/* AI Vibe Check */}
        {aiAnalysis && (
            <div 
                className="w-full mb-8 p-4 rounded-xl border relative overflow-hidden group"
                style={{ 
                    background: `linear-gradient(135deg, ${hexToRgba(primaryColor, 0.1)}, ${cardBgBase})`,
                    borderColor: hexToRgba(primaryColor, 0.2)
                }}
            >
                <div className="flex items-start gap-3 relative z-10">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.2)' }}>
                        <Sparkles size={18} style={{ color: primaryColor }} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70" style={{ color: primaryColor }}>AI Vibe Check</h3>
                        <p className="text-sm italic" style={{ color: textColor }}>"{aiAnalysis}"</p>
                    </div>
                </div>
            </div>
        )}

        {/* Addresses / Cards */}
        <div className="w-full space-y-4">
            {profile.addresses.map((addr) => (
                <div 
                    key={addr.id}
                    onMouseEnter={() => setHoveredCard(addr.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className="relative rounded-2xl p-5 border transition-all duration-300 group overflow-hidden"
                    style={{
                        backgroundColor: hoveredCard === addr.id ? hexToRgba(primaryColor, 0.05) : cardBgBase,
                        borderColor: hoveredCard === addr.id ? hexToRgba(primaryColor, 0.4) : cardBorderBase,
                        transform: hoveredCard === addr.id ? 'translateY(-2px)' : 'none',
                        boxShadow: hoveredCard === addr.id ? `0 10px 30px -10px ${hexToRgba(primaryColor, 0.2)}` : 'none'
                    }}
                >
                    <div className="flex justify-between items-start mb-3 relative z-10">
                        <div>
                             {addr.label && addr.label.trim() !== "" && (
                                 <span 
                                    className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1"
                                    style={{ 
                                        backgroundColor: hexToRgba(primaryColor, 0.2), 
                                        color: primaryColor,
                                        border: `1px solid ${hexToRgba(primaryColor, 0.2)}`
                                    }}
                                 >
                                    {addr.label}
                                 </span>
                             )}
                             <h3 className="text-lg font-bold" style={{ color: textColor }}>{addr.network}</h3>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => setActiveQr(addr.id)}
                                className="p-2 rounded-lg transition-colors hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                                style={{ color: iconBaseColor }}
                             >
                                <QrCode size={18} />
                             </button>
                             <button 
                                onClick={() => copyAddress(addr.address, addr.id)}
                                className="p-2 rounded-lg transition-colors hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                                style={{ color: iconBaseColor }}
                             >
                                {copiedId === addr.id ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                             </button>
                        </div>
                    </div>
                    
                    <div 
                        className="font-mono text-xs sm:text-sm rounded-lg p-3 break-all relative z-10 border"
                        style={{ 
                            backgroundColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.3)',
                            color: isLightMode ? '#334155' : 'rgba(255,255,255,0.8)',
                            borderColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'
                        }}
                    >
                        {addr.address}
                    </div>

                    {/* Gradient overlay for cards */}
                    <div 
                        className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                        style={{
                            background: `radial-gradient(circle at top right, ${hexToRgba(primaryColor, 0.1)}, transparent 70%)`
                        }}
                    />
                </div>
            ))}
        </div>

        {/* FOOTER */}
        <div className="mt-12 text-center opacity-50 hover:opacity-100 transition-opacity">
            <a 
                href="https://phpcoin.net" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-medium flex items-center justify-center gap-1"
                style={{ color: mutedTextColor }}
            >
                <span>Built with PHPCoin DeFiFolio</span>
                <ExternalLink size={10} />
            </a>
        </div>
      </div>

        {/* QR Modal */}
        {activeQr && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setActiveQr(null)}>
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full relative" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => setActiveQr(null)}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                    
                    <h3 className="text-xl font-bold mb-6 text-center text-white">Scan to Pay</h3>
                    
                    <div className="flex justify-center mb-6">
                        <div className="bg-white p-4 rounded-xl">
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${profile.addresses.find(a => a.id === activeQr)?.address}`}
                                alt="QR Code"
                                className="w-48 h-48"
                            />
                        </div>
                    </div>
                    
                    <p className="text-center text-slate-400 font-mono text-xs break-all bg-slate-800 p-3 rounded">
                        {profile.addresses.find(a => a.id === activeQr)?.address}
                    </p>
                </div>
            </div>
        )}
    </div>
  );
};
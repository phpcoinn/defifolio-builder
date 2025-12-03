import React, { useState } from 'react';
import { UserProfile, CryptoAddress, SocialLink } from '../types';
import { BioGenerator } from './BioGenerator';
import { Plus, Trash2, Link as LinkIcon, QrCode, User, Twitter, Github, Globe, Send, Gamepad2, Upload, Palette, Image as ImageIcon, X } from 'lucide-react';

interface EditorProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

const PRESET_THEMES = [
  // Dark Themes
  { theme: '#818cf8', bg: '#0b1120' }, // Default Indigo
  { theme: '#34d399', bg: '#022c22' }, // Emerald Forest
  { theme: '#22d3ee', bg: '#083344' }, // Cyan Deep
  { theme: '#f472b6', bg: '#2e1065' }, // Pink/Violet
  { theme: '#fbbf24', bg: '#171717' }, // Amber Dark
  { theme: '#f87171', bg: '#18181b' }, // Red Zinc
  { theme: '#a78bfa', bg: '#0f172a' }, // Violet Slate
  { theme: '#c084fc', bg: '#000000' }, // Purple Black
  
  // Light Themes
  { theme: '#4f46e5', bg: '#f8fafc' }, // Light Indigo
  { theme: '#059669', bg: '#ecfdf5' }, // Light Mint
  { theme: '#be123c', bg: '#fff1f2' }, // Light Rose
  { theme: '#d97706', bg: '#fffbeb' }, // Light Amber
];

export const Editor: React.FC<EditorProps> = ({ profile, setProfile }) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'appearance' | 'addresses' | 'socials'>('identity');

  const updateField = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField('avatarUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateField('coverImageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAddress = () => {
    const newAddress: CryptoAddress = {
      id: Date.now().toString(),
      network: 'Ethereum',
      address: '',
      label: 'Main Wallet',
      color: '#627EEA'
    };
    setProfile(prev => ({ ...prev, addresses: [...prev.addresses, newAddress] }));
  };

  const removeAddress = (id: string) => {
    setProfile(prev => ({ ...prev, addresses: prev.addresses.filter(a => a.id !== id) }));
  };

  const updateAddress = (id: string, field: keyof CryptoAddress, value: any) => {
    setProfile(prev => ({
      ...prev,
      addresses: prev.addresses.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  const addSocial = () => {
    const newSocial: SocialLink = {
        id: Date.now().toString(),
        platform: 'website',
        url: ''
    };
    setProfile(prev => ({ ...prev, socials: [...prev.socials, newSocial] }));
  };

  const removeSocial = (id: string) => {
      setProfile(prev => ({...prev, socials: prev.socials.filter(s => s.id !== id)}));
  };

  const updateSocial = (id: string, field: keyof SocialLink, value: any) => {
      setProfile(prev => ({
          ...prev,
          socials: prev.socials.map(s => s.id === id ? { ...s, [field]: value } : s)
      }));
  };

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'twitter': return <Twitter size={14} />; // Kept for legacy support if needed
      case 'x': return <X size={14} />;
      case 'github': return <Github size={14} />;
      case 'telegram': return <Send size={14} />;
      case 'discord': return <Gamepad2 size={14} />;
      case 'website': return <Globe size={14} />;
      default: return <LinkIcon size={14} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-crypto-panel border-r border-slate-800 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('identity')}
          className={`flex-1 min-w-[80px] py-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-2 ${activeTab === 'identity' ? 'text-crypto-accent border-b-2 border-crypto-accent' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <User size={16} /> Identity
        </button>
        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex-1 min-w-[80px] py-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-2 ${activeTab === 'appearance' ? 'text-crypto-accent border-b-2 border-crypto-accent' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Palette size={16} /> Style
        </button>
        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex-1 min-w-[80px] py-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-2 ${activeTab === 'addresses' ? 'text-crypto-accent border-b-2 border-crypto-accent' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <QrCode size={16} /> Wallets
        </button>
        <button
          onClick={() => setActiveTab('socials')}
          className={`flex-1 min-w-[80px] py-4 text-xs sm:text-sm font-medium flex flex-col sm:flex-row items-center justify-center gap-2 ${activeTab === 'socials' ? 'text-crypto-accent border-b-2 border-crypto-accent' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <LinkIcon size={16} /> Socials
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-24 md:pb-6">
        {activeTab === 'identity' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:ring-2 focus:ring-crypto-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title / Tagline</label>
              <input
                type="text"
                value={profile.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:ring-2 focus:ring-crypto-accent focus:outline-none"
              />
            </div>
            
            <BioGenerator profile={profile} onBioGenerated={(bio) => updateField('bio', bio)} />

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Avatar Image</label>
              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                       {profile.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="text-slate-600" size={24} />
                          </div>
                       )}
                    </div>
                    <div className="flex-1">
                        <label className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs py-2.5 px-3 rounded border border-slate-700 cursor-pointer transition">
                            <Upload size={14} />
                            <span>Upload File</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/png, image/jpeg, image/gif, image/webp" 
                                onChange={handleAvatarUpload} 
                            />
                        </label>
                    </div>
                 </div>
                 
                 <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-crypto-panel px-2 text-[10px] text-slate-500 uppercase tracking-wide">Or use URL</span>
                    </div>
                 </div>

                 <input
                    type="text"
                    value={profile.avatarUrl}
                    onChange={(e) => updateField('avatarUrl', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:ring-2 focus:ring-crypto-accent focus:outline-none text-slate-300 placeholder:text-slate-600"
                  />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
           <div className="space-y-6">
                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Quick Presets</label>
                   <div className="grid grid-cols-4 gap-2">
                     {PRESET_THEMES.map((preset, idx) => (
                       <button
                         key={idx}
                         onClick={() => {
                            updateField('themeColor', preset.theme);
                            updateField('backgroundColor', preset.bg);
                         }}
                         className="h-10 rounded-lg border border-slate-700 hover:scale-105 transition-transform relative overflow-hidden ring-offset-2 ring-offset-slate-900 focus:ring-2 focus:ring-crypto-accent"
                         style={{ backgroundColor: preset.bg }}
                         title={`Theme: ${preset.theme}`}
                       >
                          <div 
                            className="absolute bottom-0 right-0 w-6 h-6 rounded-tl-xl shadow-lg" 
                            style={{ backgroundColor: preset.theme }}
                          />
                       </button>
                     ))}
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Cover Image</label>
                   <div className="space-y-3">
                       <div className="relative w-full h-24 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 group">
                           {profile.coverImageUrl ? (
                               <img src={profile.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-600">
                                   <ImageIcon size={24} />
                               </div>
                           )}
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <label className="cursor-pointer text-xs text-white bg-slate-800/80 px-3 py-1.5 rounded-full hover:bg-slate-700 flex items-center gap-1">
                                   <Upload size={12} /> Change
                                   <input 
                                       type="file" 
                                       className="hidden" 
                                       accept="image/png, image/jpeg, image/gif, image/webp" 
                                       onChange={handleCoverUpload} 
                                   />
                               </label>
                           </div>
                       </div>
                       <input
                           type="text"
                           value={profile.coverImageUrl || ''}
                           onChange={(e) => updateField('coverImageUrl', e.target.value)}
                           placeholder="Image URL..."
                           className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs focus:ring-2 focus:ring-crypto-accent focus:outline-none text-slate-300 placeholder:text-slate-600"
                       />
                   </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Accent Color</label>
                    <div className="flex items-center gap-3 bg-slate-900 p-3 rounded border border-slate-700">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-600 shadow-inner shrink-0">
                            <input
                                type="color"
                                value={profile.themeColor}
                                onChange={(e) => updateField('themeColor', e.target.value)}
                                className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer p-0 border-0" 
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase font-semibold">Primary Theme</span>
                            <span className="text-sm font-mono text-slate-300">{profile.themeColor}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Background Color</label>
                    <div className="flex items-center gap-3 bg-slate-900 p-3 rounded border border-slate-700">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-600 shadow-inner shrink-0">
                            <input
                                type="color"
                                value={profile.backgroundColor}
                                onChange={(e) => updateField('backgroundColor', e.target.value)}
                                className="absolute -top-2 -left-2 w-20 h-20 cursor-pointer p-0 border-0" 
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase font-semibold">Base Background</span>
                            <span className="text-sm font-mono text-slate-300">{profile.backgroundColor}</span>
                        </div>
                    </div>
                </div>
           </div>
        )}

        {activeTab === 'addresses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Your Wallets</span>
                <button 
                    onClick={addAddress}
                    className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 transition"
                >
                    <Plus size={12} /> Add New
                </button>
            </div>
            
            <div className="space-y-3">
                {profile.addresses.map((addr) => (
                    <div key={addr.id} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg group hover:border-slate-700 transition-colors">
                        <div className="flex items-start gap-2 mb-2">
                             <div className="flex-1 space-y-2">
                                 <input
                                    type="text"
                                    value={addr.network}
                                    onChange={(e) => updateAddress(addr.id, 'network', e.target.value)}
                                    placeholder="Network (e.g. Ethereum)"
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-crypto-accent focus:outline-none"
                                 />
                                 <input
                                    type="text"
                                    value={addr.label}
                                    onChange={(e) => updateAddress(addr.id, 'label', e.target.value)}
                                    placeholder="Label (e.g. Main Vault)"
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-crypto-accent focus:outline-none"
                                 />
                             </div>
                             <button onClick={() => removeAddress(addr.id)} className="text-slate-600 hover:text-red-400 p-1">
                                 <Trash2 size={14} />
                             </button>
                        </div>
                        <input
                            type="text"
                            value={addr.address}
                            onChange={(e) => updateAddress(addr.id, 'address', e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-400 focus:ring-1 focus:ring-crypto-accent focus:outline-none"
                        />
                    </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'socials' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Social Links</span>
                <button 
                    onClick={addSocial}
                    className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 transition"
                >
                    <Plus size={12} /> Add Link
                </button>
            </div>

            <div className="space-y-2">
                {profile.socials.map((social) => (
                    <div key={social.id} className="flex items-center gap-2 bg-slate-900/50 p-2 rounded border border-slate-800 hover:border-slate-700 transition">
                        <div className="text-slate-400">
                             {getSocialIcon(social.platform)}
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                             <select 
                                value={social.platform}
                                onChange={(e) => updateSocial(social.id, 'platform', e.target.value)}
                                className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none"
                             >
                                <option value="x">X (Twitter)</option>
                                <option value="github">GitHub</option>
                                <option value="telegram">Telegram</option>
                                <option value="discord">Discord</option>
                                <option value="website">Website</option>
                             </select>
                             <input
                                type="text"
                                value={social.url}
                                onChange={(e) => updateSocial(social.id, 'url', e.target.value)}
                                placeholder="https://..."
                                className="bg-transparent text-xs text-slate-400 w-full focus:outline-none placeholder:text-slate-600"
                             />
                        </div>
                        <button onClick={() => removeSocial(social.id)} className="text-slate-600 hover:text-red-400 p-1">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
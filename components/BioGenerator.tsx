import React, { useState } from 'react';
import { UserProfile } from '../types';
import { generateBio } from '../services/gemini';
import { Loader2, Sparkles } from 'lucide-react';

interface BioGeneratorProps {
  profile: UserProfile;
  onBioGenerated: (bio: string) => void;
}

export const BioGenerator: React.FC<BioGeneratorProps> = ({ profile, onBioGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const bio = await generateBio(profile);
      onBioGenerated(bio);
    } catch (e) {
      setError("Failed to generate bio. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-slate-400">Bio</label>
        <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs flex items-center gap-1 text-crypto-accent hover:text-white transition-colors disabled:opacity-50"
        >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? 'Generating...' : 'Auto-Generate with AI'}
        </button>
      </div>
      <textarea
        value={profile.bio}
        onChange={(e) => onBioGenerated(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm focus:ring-2 focus:ring-crypto-accent focus:outline-none transition-all h-24 resize-none"
        placeholder="Tell the world about your crypto journey..."
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
};
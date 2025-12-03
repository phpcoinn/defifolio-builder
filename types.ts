export interface SocialLink {
  id: string;
  platform: 'x' | 'github' | 'telegram' | 'discord' | 'website';
  url: string;
}

export interface CryptoAddress {
  id: string;
  network: string; // e.g., 'Ethereum', 'Bitcoin'
  address: string;
  label: string; // e.g., 'Main Vault', 'Donations'
  color: string;
}

export interface UserProfile {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  coverImageUrl?: string;
  themeColor: string;
  backgroundColor: string;
  socials: SocialLink[];
  addresses: CryptoAddress[];
}

export const INITIAL_PROFILE: UserProfile = {
  name: "Crypto Voyager",
  title: "DeFi Enthusiast & NFT Collector",
  bio: "Exploring the decentralized web, one block at a time. Send it.",
  // Using a stable, high-quality abstract 3D avatar from Unsplash instead of picsum
  avatarUrl: "https://images.unsplash.com/photo-1640951613773-54706e06851d?q=80&w=200&auto=format&fit=crop",
  coverImageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop",
  themeColor: "#818cf8",
  backgroundColor: "#0b1120",
  socials: [
    { id: '1', platform: 'x', url: 'https://x.com' },
    { id: '2', platform: 'github', url: 'https://github.com' }
  ],
  addresses: [
    { id: '1', network: 'Ethereum', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', label: 'Main Vault', color: '#627EEA' },
    { id: '2', network: 'Bitcoin', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', label: 'Cold Storage', color: '#F7931A' },
    { id: '3', network: 'Solana', address: 'Hv3J482kjs8283kjasd823298kjasd823', label: 'Minting', color: '#14F195' }
  ]
};
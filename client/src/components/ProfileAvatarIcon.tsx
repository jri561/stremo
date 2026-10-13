import React from 'react';
import {
  Film,
  Tv,
  Popcorn,
  Camera,
  Rocket,
  Flame,
  Compass,
  Zap,
  Sparkles,
  Smile,
  Heart,
  Cat,
  Gamepad2,
  Headphones,
  Bot,
  Glasses,
  User,
  Crown,
  Ghost,
  Coffee,
} from 'lucide-react';

interface Props {
  avatar?: string;
  className?: string;
}

export const ProfileAvatarIcon: React.FC<Props> = ({ avatar, className = 'w-6 h-6' }) => {
  switch (avatar) {
    case 'film':
      return <Film className={className} />;
    case 'tv':
      return <Tv className={className} />;
    case 'popcorn':
      return <Popcorn className={className} />;
    case 'camera':
      return <Camera className={className} />;
    case 'rocket':
      return <Rocket className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'smile':
      return <Smile className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'cat':
      return <Cat className={className} />;
    case 'gamepad':
      return <Gamepad2 className={className} />;
    case 'headphones':
      return <Headphones className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'glasses':
      return <Glasses className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'ghost':
      return <Ghost className={className} />;
    case 'coffee':
      return <Coffee className={className} />;
    case 'user':
    default:
      return <User className={className} />;
  }
};

import React, { useState } from 'react';
import {
  ChevronDown,
  LogOut,
  Pencil,
  Tv,
  Database,
  Radio,
  BarChart3,
  Sliders,
  Plus,
  Check,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { Profile } from '../api';
import { getProfileTheme } from '../profileCustomization';
import { ProfileAvatarIcon } from './ProfileAvatarIcon';
import { ProfileModal } from './ProfileModal';

interface Props {
  profiles: Profile[];
  activeProfile: Profile;
  onSelectProfile: (p: Profile) => void;
  onCreateProfile: (
    name: string,
    avatar: string,
    isKids: boolean,
    pin?: string,
    preferredAudioLanguage?: string,
    preferredSubtitleLanguage?: string,
    subtitleMode?: string,
    color?: string
  ) => Promise<void>;
  onUpdateProfile?: (
    id: string,
    updates: {
      name: string;
      avatar: string;
      color?: string;
      isKids: boolean;
      pin?: string | null;
      preferredAudioLanguage?: string;
      preferredSubtitleLanguage?: string;
      subtitleMode?: string;
    }
  ) => Promise<void>;
  onOpenSelector: () => void;
  onOpenSettings?: () => void;
  onOpenStats?: () => void;
  onOpenTrakt?: () => void;
  onOpenBackup?: () => void;
  onOpenDeviceSync?: () => void;
  onToggleTvMode?: () => void;
  isTvMode?: boolean;
}

export const ProfileMenu: React.FC<Props> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onOpenSelector,
  onOpenSettings,
  onOpenStats,
  onOpenTrakt,
  onOpenBackup,
  onOpenDeviceSync,
  onToggleTvMode,
  isTvMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);

  const activeTheme = getProfileTheme(activeProfile.color);

  const handleSaveModal = async (data: {
    name: string;
    avatar: string;
    color: string;
    isKids: boolean;
    pin?: string | null;
    preferredAudioLanguage?: string;
    preferredSubtitleLanguage?: string;
    subtitleMode?: string;
  }) => {
    if (modalMode === 'create') {
      await onCreateProfile(
        data.name,
        data.avatar,
        data.isKids,
        data.pin || undefined,
        data.preferredAudioLanguage,
        data.preferredSubtitleLanguage,
        data.subtitleMode,
        data.color
      );
    } else if (modalMode === 'edit' && onUpdateProfile) {
      await onUpdateProfile(activeProfile.id, {
        name: data.name,
        avatar: data.avatar,
        color: data.color,
        isKids: data.isKids,
        pin: data.pin,
        preferredAudioLanguage: data.preferredAudioLanguage,
        preferredSubtitleLanguage: data.preferredSubtitleLanguage,
        subtitleMode: data.subtitleMode,
      });
    }
    setModalMode(null);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition shadow-sm cursor-pointer"
        title={`Profil actif : ${activeProfile.name}`}
      >
        <div
          className={`w-7 h-7 rounded-xl bg-gradient-to-tr ${activeTheme.gradient} flex items-center justify-center text-white shadow-sm border border-white/20`}
        >
          <ProfileAvatarIcon avatar={activeProfile.avatar} className="w-4 h-4" />
        </div>
        <div className="text-left hidden sm:block">
          <span className="block text-[9px] uppercase font-bold text-slate-500 tracking-wider">Profil</span>
          <span className="block text-xs font-bold text-white truncate max-w-[100px]">{activeProfile.name}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#111622] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in space-y-1">
          <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Changer de profil
            </span>
            {onUpdateProfile && (
              <button
                onClick={() => {
                  setModalMode('edit');
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                title="Personnaliser le profil actif"
              >
                <Pencil className="w-3 h-3" />
                Personnaliser
              </button>
            )}
          </div>

          {profiles.map((p) => {
            const isCurrent = activeProfile.id === p.id;
            const theme = getProfileTheme(p.color);

            return (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProfile(p);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'hover:bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${theme.gradient} flex items-center justify-center text-white shadow-sm border border-white/20`}>
                    <ProfileAvatarIcon avatar={p.avatar} className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold block">{p.name}</span>
                      {p.pin && <Lock className="w-2.5 h-2.5 text-amber-400" />}
                    </div>
                    {p.isKids === 1 && (
                      <span className="text-[9px] uppercase font-bold text-pink-400 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        Kids
                      </span>
                    )}
                  </div>
                </div>
                {isCurrent && <Check className="w-4 h-4 text-indigo-400" />}
              </button>
            );
          })}

          <div className="pt-2 border-t border-white/5 space-y-1">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setIsOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold text-indigo-300 hover:text-white hover:bg-indigo-600/20 flex items-center gap-2 transition cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-indigo-400" />
                Paramètres de lecture
              </button>
            )}

            {onOpenTrakt && (
              <button
                onClick={() => {
                  onOpenTrakt();
                  setIsOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold text-red-300 hover:text-white hover:bg-red-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <Tv className="w-4 h-4 text-red-400" />
                Scrobble Trakt.tv
              </button>
            )}

            {onOpenStats && (
              <button
                onClick={() => {
                  onOpenStats();
                  setIsOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold text-emerald-300 hover:text-white hover:bg-emerald-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Mes Statistiques
              </button>
            )}

            {onOpenDeviceSync && (
              <button
                onClick={() => {
                  onOpenDeviceSync();
                  setIsOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold text-indigo-300 hover:text-white hover:bg-indigo-600/20 flex items-center gap-2 transition cursor-pointer"
              >
                <Radio className="w-4 h-4 text-indigo-400" />
                Lier Télé, PC & Mobile
              </button>
            )}

            {onToggleTvMode && (
              <button
                onClick={() => {
                  onToggleTvMode();
                  setIsOpen(false);
                }}
                className={`w-full p-2 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  isTvMode
                    ? 'text-indigo-300 bg-indigo-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Tv className="w-4 h-4 text-indigo-400" />
                {isTvMode ? 'Quitter le Mode TV' : 'Activer le Mode TV 10-pieds'}
              </button>
            )}

            {onOpenBackup && (
              <button
                onClick={() => {
                  onOpenBackup();
                  setIsOpen(false);
                }}
                className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
              >
                <Database className="w-4 h-4 text-indigo-400" />
                Sauvegarde & Restauration
              </button>
            )}

            <button
              onClick={() => {
                setModalMode('create');
                setIsOpen(false);
              }}
              className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              Nouveau profil
            </button>

            <button
              onClick={() => {
                onOpenSelector();
                setIsOpen(false);
              }}
              className="w-full p-2 rounded-xl text-left text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-white/5 flex items-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              Écran de sélection
            </button>
          </div>
        </div>
      )}

      {/* Modal Profile Création & Édition */}
      <ProfileModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        initialProfile={modalMode === 'edit' ? activeProfile : null}
        onSave={handleSaveModal}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Plus, Check, Pencil, Lock, Radio, Tv, Sparkles } from 'lucide-react';
import type { Profile } from '../api';
import { getProfileTheme } from '../profileCustomization';
import { ProfileAvatarIcon } from './ProfileAvatarIcon';
import { ProfileModal } from './ProfileModal';

interface Props {
  profiles: Profile[];
  activeProfile: Profile | null;
  onSelectProfile: (profile: Profile) => void;
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
  onDeleteProfile?: (id: string) => Promise<void>;
  onOpenDeviceSync?: () => void;
  onToggleTvMode?: () => void;
  isTvMode?: boolean;
}

export const ProfileSelector: React.FC<Props> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onOpenDeviceSync,
  onToggleTvMode,
  isTvMode,
}) => {
  const [isManaging, setIsManaging] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [selectedForEdit, setSelectedForEdit] = useState<Profile | null>(null);

  const handleStartEdit = (p: Profile, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForEdit(p);
    setModalMode('edit');
  };

  const handleStartCreate = () => {
    setSelectedForEdit(null);
    setModalMode('create');
  };

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
    } else if (modalMode === 'edit' && selectedForEdit && onUpdateProfile) {
      await onUpdateProfile(selectedForEdit.id, {
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
    setSelectedForEdit(null);
  };

  const handleDeleteModal = async (id: string) => {
    if (onDeleteProfile) {
      await onDeleteProfile(id);
      setModalMode(null);
      setSelectedForEdit(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in select-none">
      <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3 text-white text-center">
        {isManaging ? 'Gérer les profils' : 'Qui regarde ?'}
      </h1>
      <p className="text-slate-400 text-sm md:text-base mb-8 text-center max-w-md font-medium">
        {isManaging
          ? 'Personnalisez les avatars, couleurs, restrictions parentales et codes PIN.'
          : 'Chaque profil dispose de son historique de reprise, favoris et préférences isolés.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 max-w-4xl mb-10">
        {profiles.map((p) => {
          const isSelected = activeProfile?.id === p.id;
          const theme = getProfileTheme(p.color);

          return (
            <div key={p.id} className="relative flex flex-col items-center">
              <button
                onClick={(e) => {
                  if (isManaging) {
                    handleStartEdit(p, e);
                  } else {
                    onSelectProfile(p);
                  }
                }}
                className="group flex flex-col items-center p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div
                  className={`relative w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center bg-gradient-to-tr ${theme.gradient} border-2 transition-all duration-300 shadow-xl overflow-hidden ${
                    isSelected && !isManaging
                      ? 'border-white ring-4 ring-indigo-500/40 shadow-2xl scale-102'
                      : isManaging
                      ? 'border-amber-400/80 group-hover:border-amber-300 group-hover:shadow-amber-500/20'
                      : 'border-white/10 group-hover:border-white/40'
                  }`}
                  style={{
                    boxShadow: isSelected ? `0 12px 30px ${theme.glowColor}` : undefined,
                  }}
                >
                  {/* Subtle inner overlay */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition" />

                  {/* Icon */}
                  <div className="relative text-white drop-shadow-md transform group-hover:scale-110 transition duration-300">
                    <ProfileAvatarIcon avatar={p.avatar} className="w-12 h-12 md:w-16 md:h-16" />
                  </div>

                  {/* Mode édition overlay */}
                  {isManaging && (
                    <div className="absolute inset-0 bg-black/60 rounded-3xl flex items-center justify-center backdrop-blur-[2px]">
                      <div className="p-3 bg-amber-500 text-black rounded-2xl shadow-lg transform group-hover:scale-110 transition">
                        <Pencil className="w-5 h-5 stroke-[2.5]" />
                      </div>
                    </div>
                  )}

                  {/* Checkmark actif */}
                  {!isManaging && isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-white text-black p-1 rounded-full shadow-lg">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* PIN badge */}
                  {p.pin && (
                    <div
                      className="absolute top-2.5 left-2.5 bg-black/65 backdrop-blur-sm p-1 rounded-md text-amber-300 shadow"
                      title="Protégé par code PIN"
                    >
                      <Lock className="w-3 h-3" />
                    </div>
                  )}

                  {/* Kids badge */}
                  {p.isKids === 1 && (
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase bg-pink-500 text-white rounded-md shadow-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Kids
                    </span>
                  )}
                </div>
                <span className="mt-3.5 font-bold text-base md:text-lg text-slate-300 group-hover:text-white transition">
                  {p.name}
                </span>
              </button>
            </div>
          );
        })}

        {!isManaging && (
          <button
            onClick={handleStartCreate}
            className="group flex flex-col items-center p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center bg-[#111622]/60 border-2 border-dashed border-white/15 group-hover:border-indigo-400 group-hover:bg-[#111622] transition-all duration-300">
              <Plus className="w-9 h-9 text-slate-400 group-hover:text-indigo-400 transition" />
            </div>
            <span className="mt-3.5 font-bold text-base md:text-lg text-slate-400 group-hover:text-white transition">
              Ajouter un profil
            </span>
          </button>
        )}
      </div>

      {/* Boutons d'action bas */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onOpenDeviceSync && !isManaging && (
          <button
            onClick={onOpenDeviceSync}
            className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border-indigo-500/30 flex items-center gap-2 shadow-sm"
            title="Lier ce téléviseur, mobile ou PC avec un code d'appairage express"
          >
            <Radio className="w-4 h-4 text-indigo-400" />
            Lier cet écran (TV / PC / Mobile)
          </button>
        )}

        {onToggleTvMode && !isManaging && (
          <button
            onClick={onToggleTvMode}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border flex items-center gap-2 shadow-sm ${
              isTvMode
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-indigo-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Basculer le Mode TV / Salon 10-pieds"
          >
            <Tv className="w-4 h-4 text-indigo-400" />
            {isTvMode ? 'Mode TV (Actif)' : 'Mode TV'}
          </button>
        )}

        <button
          onClick={() => setIsManaging(!isManaging)}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer border ${
            isManaging
              ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow-lg'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
          }`}
        >
          {isManaging ? 'Terminé' : 'Gérer les profils'}
        </button>
      </div>

      {/* Modal Création & Édition unifiée */}
      <ProfileModal
        isOpen={modalMode !== null}
        onClose={() => {
          setModalMode(null);
          setSelectedForEdit(null);
        }}
        initialProfile={selectedForEdit}
        onSave={handleSaveModal}
        onDelete={handleDeleteModal}
        canDelete={profiles.length > 1}
      />
    </div>
  );
};

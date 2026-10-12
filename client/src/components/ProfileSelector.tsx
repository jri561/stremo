import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Sparkles, Film, Plus, Check, X, Pencil, Trash2, Lock, Radio, Tv } from 'lucide-react';
import type { Profile } from '../api';

interface Props {
  profiles: Profile[];
  activeProfile: Profile | null;
  onSelectProfile: (profile: Profile) => void;
  onCreateProfile: (name: string, avatar: string, isKids: boolean, pin?: string) => Promise<void>;
  onUpdateProfile?: (id: string, updates: { name: string; avatar: string; isKids: boolean; pin?: string | null }) => Promise<void>;
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Formulaire création
  const [newProfileName, setNewProfileName] = useState('');
  const [newAvatar, setNewAvatar] = useState('film');
  const [isKids, setIsKids] = useState(false);
  const [newPin, setNewPin] = useState('');

  // Formulaire édition
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('film');
  const [editIsKids, setEditIsKids] = useState(false);
  const [editPin, setEditPin] = useState('');

  const getAvatarIcon = (avatar: string) => {
    switch (avatar) {
      case 'sparkles':
        return <Sparkles className="w-10 h-10 text-pink-400" />;
      case 'film':
        return <Film className="w-10 h-10 text-indigo-400" />;
      default:
        return <User className="w-10 h-10 text-slate-300" />;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    await onCreateProfile(newProfileName.trim(), newAvatar, isKids, newPin.trim() || undefined);
    setNewProfileName('');
    setIsKids(false);
    setNewPin('');
    setShowCreateModal(false);
  };

  const handleStartEdit = (p: Profile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProfile(p);
    setEditName(p.name);
    setEditAvatar(p.avatar);
    setEditIsKids(p.isKids === 1);
    setEditPin(p.pin || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editName.trim() || !onUpdateProfile) return;
    await onUpdateProfile(editingProfile.id, {
      name: editName.trim(),
      avatar: editAvatar,
      isKids: editIsKids,
      pin: editPin.trim() ? editPin.trim() : null,
    });
    setEditingProfile(null);
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteProfile) return;
    if (confirm('Voulez-vous vraiment supprimer ce profil ? Tous ses favoris et son historique seront effacés.')) {
      await onDeleteProfile(id);
      setEditingProfile(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 animate-fade-in select-none">
      <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3 text-white text-center">
        {isManaging ? 'Gérer les profils' : 'Qui regarde ?'}
      </h1>
      <p className="text-slate-400 text-sm md:text-base mb-8 text-center max-w-md font-medium">
        {isManaging
          ? 'Modifiez les noms, avatars, restrictions parentales et codes PIN.'
          : 'Chaque profil dispose de son historique de reprise, favoris et préférences isolés.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 max-w-4xl mb-10">
        {profiles.map((p) => {
          const isSelected = activeProfile?.id === p.id;
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
                  className={`relative w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center bg-[#111622] border-2 transition-all duration-300 shadow-xl ${
                    isSelected && !isManaging
                      ? 'border-indigo-500 shadow-indigo-500/20'
                      : isManaging
                      ? 'border-amber-500/50 group-hover:border-amber-400'
                      : 'border-white/5 group-hover:border-indigo-500/50'
                  }`}
                >
                  {getAvatarIcon(p.avatar)}

                  {isManaging && (
                    <div className="absolute inset-0 bg-black/55 rounded-3xl flex items-center justify-center">
                      <div className="p-3 bg-amber-500 text-black rounded-2xl shadow-lg">
                        <Pencil className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {!isManaging && isSelected && (
                    <div className="absolute top-2.5 right-2.5 bg-indigo-600 text-white p-1 rounded-full shadow">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {p.pin && (
                    <div className="absolute top-2.5 left-2.5 bg-black/60 p-1 rounded-md text-amber-400" title="Verrouillé par code PIN">
                      <Lock className="w-3 h-3" />
                    </div>
                  )}

                  {p.isKids === 1 && (
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-pink-500/80 text-white rounded">
                      Kids
                    </span>
                  )}
                </div>
                <span className="mt-3.5 font-semibold text-base md:text-lg text-slate-300 group-hover:text-white transition">
                  {p.name}
                </span>
              </button>
            </div>
          );
        })}

        {!isManaging && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="group flex flex-col items-center p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl flex items-center justify-center bg-[#111622]/50 border-2 border-dashed border-white/10 group-hover:border-indigo-400 group-hover:bg-[#111622] transition-all duration-300">
              <Plus className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition" />
            </div>
            <span className="mt-3.5 font-semibold text-base md:text-lg text-slate-400 group-hover:text-white transition">
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

      {/* Modal Création Profil */}
      {showCreateModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateModal(false);
            }}
          >
            <div className="bg-[#0e121a] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xl md:text-2xl font-bold text-white">Créer un profil</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-xs md:text-sm mb-6">
                Personnalisez un nouvel espace de visionnage indépendant.
              </p>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Nom du profil
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Sophie, Salon, Enfants..."
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Avatar
                  </label>
                  <div className="flex gap-3">
                    {[
                      { id: 'film', label: 'Cinéphile', icon: <Film className="w-5 h-5 text-indigo-400" /> },
                      { id: 'user', label: 'Standard', icon: <User className="w-5 h-5 text-slate-300" /> },
                      { id: 'sparkles', label: 'Enfant', icon: <Sparkles className="w-5 h-5 text-pink-400" /> },
                    ].map((av) => (
                      <button
                        type="button"
                        key={av.id}
                        onClick={() => {
                          setNewAvatar(av.id);
                          if (av.id === 'sparkles') setIsKids(true);
                        }}
                        className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          newAvatar === av.id
                            ? 'border-indigo-500 bg-indigo-500/15 font-bold text-white'
                            : 'border-white/5 bg-white/5 hover:border-white/10 text-slate-400'
                        }`}
                      >
                        {av.icon}
                        <span className="text-xs font-semibold">{av.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="isKids"
                    checked={isKids}
                    onChange={(e) => {
                      setIsKids(e.target.checked);
                      if (e.target.checked && newAvatar !== 'sparkles') setNewAvatar('sparkles');
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white/5 border-white/10 cursor-pointer"
                  />
                  <label htmlFor="isKids" className="text-xs text-slate-300 cursor-pointer">
                    Profil Enfant (bloque automatiquement les contenus adultes)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Code PIN de sécurité (Optionnel, 4 chiffres)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Ex: 1234"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    Créer le profil
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Édition Profil */}
      {editingProfile &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingProfile(null);
            }}
          >
            <div className="bg-[#0e121a] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xl md:text-2xl font-bold text-white">Modifier le profil</h2>
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-400 text-xs md:text-sm mb-6">
                Personnalisez le nom, l'avatar et les règles de ce profil.
              </p>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Nom du profil
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Avatar
                  </label>
                  <div className="flex gap-3">
                    {[
                      { id: 'film', label: 'Cinéphile', icon: <Film className="w-5 h-5 text-indigo-400" /> },
                      { id: 'user', label: 'Standard', icon: <User className="w-5 h-5 text-slate-300" /> },
                      { id: 'sparkles', label: 'Enfant', icon: <Sparkles className="w-5 h-5 text-pink-400" /> },
                    ].map((av) => (
                      <button
                        type="button"
                        key={av.id}
                        onClick={() => {
                          setEditAvatar(av.id);
                          if (av.id === 'sparkles') setEditIsKids(true);
                        }}
                        className={`flex-1 p-3 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          editAvatar === av.id
                            ? 'border-indigo-500 bg-indigo-500/15 font-bold text-white'
                            : 'border-white/5 bg-white/5 hover:border-white/10 text-slate-400'
                        }`}
                      >
                        {av.icon}
                        <span className="text-xs font-semibold">{av.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="editIsKids"
                    checked={editIsKids}
                    onChange={(e) => {
                      setEditIsKids(e.target.checked);
                      if (e.target.checked && editAvatar !== 'sparkles') setEditAvatar('sparkles');
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white/5 border-white/10 cursor-pointer"
                  />
                  <label htmlFor="editIsKids" className="text-xs text-slate-300 cursor-pointer">
                    Profil Enfant (bloque automatiquement les contenus adultes)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Code PIN de sécurité (laisser vide pour désactiver)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="Laisser vide ou 4 chiffres"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  {profiles.length > 1 && onDeleteProfile ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingProfile.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProfile(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

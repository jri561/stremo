import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Sparkles, Film, Plus, Check, ChevronDown, LogOut, X, Pencil } from 'lucide-react';
import type { Profile } from '../api';

interface Props {
  profiles: Profile[];
  activeProfile: Profile;
  onSelectProfile: (p: Profile) => void;
  onCreateProfile: (name: string, avatar: string, isKids: boolean, pin?: string) => Promise<void>;
  onUpdateProfile?: (id: string, updates: { name: string; avatar: string; isKids: boolean; pin?: string | null }) => Promise<void>;
  onOpenSelector: () => void;
}

export const ProfileMenu: React.FC<Props> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onOpenSelector,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
        return <Sparkles className="w-4 h-4 text-pink-400" />;
      case 'film':
        return <Film className="w-4 h-4 text-blue-400" />;
      default:
        return <User className="w-4 h-4 text-indigo-400" />;
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
    setIsOpen(false);
  };

  const handleOpenEdit = () => {
    setEditName(activeProfile.name);
    setEditAvatar(activeProfile.avatar);
    setEditIsKids(activeProfile.isKids === 1);
    setEditPin(activeProfile.pin || '');
    setShowEditModal(true);
    setIsOpen(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !onUpdateProfile) return;
    await onUpdateProfile(activeProfile.id, {
      name: editName.trim(),
      avatar: editAvatar,
      isKids: editIsKids,
      pin: editPin.trim() ? editPin.trim() : null,
    });
    setShowEditModal(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition shadow-sm cursor-pointer"
      >
        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-xs font-black text-white shadow-sm">
          {activeProfile.name.charAt(0).toUpperCase()}
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
                onClick={handleOpenEdit}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                title="Modifier le profil actif"
              >
                <Pencil className="w-3 h-3" />
                Éditer
              </button>
            )}
          </div>

          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelectProfile(p);
                setIsOpen(false);
              }}
              className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer ${
                activeProfile.id === p.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'hover:bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center">
                  {getAvatarIcon(p.avatar)}
                </div>
                <div>
                  <span className="text-xs font-bold block">{p.name}</span>
                  {p.isKids === 1 && (
                    <span className="text-[9px] uppercase font-bold text-pink-400">Kids</span>
                  )}
                </div>
              </div>
              {activeProfile.id === p.id && <Check className="w-4 h-4 text-indigo-400" />}
            </button>
          ))}

          <div className="pt-2 border-t border-white/5 space-y-1">
            <button
              onClick={() => {
                setShowCreateModal(true);
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

      {/* Modal create profile - téléporté sur document.body pour éviter d'être tronqué par le header */}
      {showCreateModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreateModal(false);
            }}
          >
            <div className="bg-[#0e121a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Nouveau profil</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Chaque profil dispose de ses propres favoris et reprise de lecture.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Nom du profil
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Salon, Maman, Enfants..."
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Avatar
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
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
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          newAvatar === av.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white font-bold'
                            : 'border-white/5 bg-white/5 text-slate-400 hover:text-white hover:bg-white/8'
                        }`}
                      >
                        {av.icon}
                        <span className="text-xs">{av.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <div>
                      <label htmlFor="menuIsKids" className="text-xs font-bold text-white block cursor-pointer">
                        Profil Enfant
                      </label>
                      <span className="text-[11px] text-slate-400 block">
                        Filtre automatiquement les contenus adultes
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="menuIsKids"
                    checked={isKids}
                    onChange={(e) => {
                      setIsKids(e.target.checked);
                      if (e.target.checked && newAvatar !== 'sparkles') {
                        setNewAvatar('sparkles');
                      }
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white/5 border-white/10 cursor-pointer"
                  />
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
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    Créer le profil
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Modal edit profile */}
      {showEditModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEditModal(false);
            }}
          >
            <div className="bg-[#0e121a] border border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Modifier le profil</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Personnalisez votre profil et son code PIN de verrouillage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Avatar
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
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
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          editAvatar === av.id
                            ? 'border-indigo-500 bg-indigo-500/20 text-white font-bold'
                            : 'border-white/5 bg-white/5 text-slate-400 hover:text-white hover:bg-white/8'
                        }`}
                      >
                        {av.icon}
                        <span className="text-xs">{av.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    <div>
                      <label htmlFor="editMenuIsKids" className="text-xs font-bold text-white block cursor-pointer">
                        Profil Enfant
                      </label>
                      <span className="text-[11px] text-slate-400 block">
                        Filtre automatiquement les contenus adultes
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="editMenuIsKids"
                    checked={editIsKids}
                    onChange={(e) => {
                      setEditIsKids(e.target.checked);
                      if (e.target.checked && editAvatar !== 'sparkles') {
                        setEditAvatar('sparkles');
                      }
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white/5 border-white/10 cursor-pointer"
                  />
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

                <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

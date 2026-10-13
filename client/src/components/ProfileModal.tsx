import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Lock, Sparkles, Trash2, Palette, ShieldCheck, Film, Compass, Gamepad2, User as UserIcon } from 'lucide-react';
import type { Profile } from '../api';
import {
  PROFILE_THEMES,
  AVATAR_CATEGORIES,
  AVATAR_OPTIONS,
  getProfileTheme,
} from '../profileCustomization';
import { ProfileAvatarIcon } from './ProfileAvatarIcon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: Profile | null;
  onSave: (data: {
    name: string;
    avatar: string;
    color: string;
    isKids: boolean;
    pin?: string | null;
    preferredAudioLanguage?: string;
    preferredSubtitleLanguage?: string;
    subtitleMode?: string;
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

export const ProfileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialProfile,
  onSave,
  onDelete,
  canDelete = false,
}) => {
  const isEditing = !!initialProfile;

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('film');
  const [color, setColor] = useState('indigo');
  const [isKids, setIsKids] = useState(false);
  const [pin, setPin] = useState('');
  const [audioLang, setAudioLang] = useState('fra');
  const [subLang, setSubLang] = useState('fra');
  const [subMode, setSubMode] = useState('foreign_only');
  const [selectedCategory, setSelectedCategory] = useState<string>('cinema');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initialProfile) {
      setName(initialProfile.name || '');
      setAvatar(initialProfile.avatar || 'film');
      setColor(initialProfile.color || 'indigo');
      setIsKids(initialProfile.isKids === 1);
      setPin(initialProfile.pin || '');
      setAudioLang(initialProfile.preferredAudioLanguage || 'fra');
      setSubLang(initialProfile.preferredSubtitleLanguage || 'fra');
      setSubMode(initialProfile.subtitleMode || 'foreign_only');

      // Détecter la catégorie de l'avatar actuel
      const currentAv = AVATAR_OPTIONS.find((a) => a.id === initialProfile.avatar);
      if (currentAv) setSelectedCategory(currentAv.category);
    } else {
      setName('');
      setAvatar('film');
      setColor('indigo');
      setIsKids(false);
      setPin('');
      setAudioLang('fra');
      setSubLang('fra');
      setSubMode('foreign_only');
      setSelectedCategory('cinema');
    }
    setConfirmDelete(false);
  }, [initialProfile, isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const currentTheme = getProfileTheme(color);
  const filteredAvatars = AVATAR_OPTIONS.filter((a) => a.category === selectedCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        avatar,
        color,
        isKids,
        pin: pin.trim() ? pin.trim() : null,
        preferredAudioLanguage: audioLang,
        preferredSubtitleLanguage: subLang,
        subtitleMode: subMode,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialProfile || !onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await onDelete(initialProfile.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (catId: string) => {
    switch (catId) {
      case 'cinema':
        return <Film className="w-3.5 h-3.5" />;
      case 'adventure':
        return <Compass className="w-3.5 h-3.5" />;
      case 'family':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'geek':
        return <Gamepad2 className="w-3.5 h-3.5" />;
      default:
        return <UserIcon className="w-3.5 h-3.5" />;
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0e121a] border border-white/10 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-6 my-auto text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${currentTheme.gradient} flex items-center justify-center shadow-lg text-white border ${currentTheme.borderColor}`}>
              <ProfileAvatarIcon avatar={avatar} className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {isEditing ? 'Personnaliser le profil' : 'Créer un nouveau profil'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {isEditing ? 'Avatar, thème de couleur, contrôle parental et préférences' : 'Un espace sur-mesure pour chaque membre du foyer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nom du profil */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Nom du profil
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={24}
              placeholder="Ex: Alexandre, Cinéma Salon, Enfants..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#141923] border border-white/10 focus:border-indigo-500 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
            />
          </div>

          {/* Palette de thèmes et couleurs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                Thème & Couleur
              </label>
              <span className="text-[11px] font-semibold text-slate-400">
                {currentTheme.name}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {Object.values(PROFILE_THEMES).map((th) => {
                const isSelected = color === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setColor(th.id)}
                    title={th.name}
                    className={`relative group h-10 rounded-xl bg-gradient-to-tr ${th.gradient} flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-white scale-105 shadow-lg'
                        : 'opacity-80 hover:opacity-100 hover:scale-102 border border-white/10'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sélecteur d'avatar avec onglets de catégories */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Choisir un avatar
            </label>

            {/* Onglets Catégories */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {AVATAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                    selectedCategory === cat.id
                      ? 'bg-white/15 text-white border-white/20 shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/5'
                  }`}
                >
                  {getCategoryIcon(cat.id)}
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grille d'avatars de la catégorie */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
              {filteredAvatars.map((av) => {
                const isSelected = avatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      setAvatar(av.id);
                      if (av.id === 'sparkles') setIsKids(true);
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                      isSelected
                        ? `bg-gradient-to-b ${currentTheme.gradient} text-white border-white/40 shadow-lg scale-102`
                        : 'bg-[#141923] border-white/5 text-slate-400 hover:text-white hover:border-white/15 hover:bg-white/5'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-black/25">
                      <ProfileAvatarIcon avatar={av.id} className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold truncate max-w-full">{av.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profil Enfant */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#141923] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="modalIsKids" className="text-xs font-bold text-white block cursor-pointer">
                  Profil Enfant
                </label>
                <span className="text-[11px] text-slate-400 block font-medium">
                  Bloque automatiquement les médias matures et films d'horreur
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              id="modalIsKids"
              checked={isKids}
              onChange={(e) => {
                const val = e.target.checked;
                setIsKids(val);
                if (val && avatar !== 'sparkles') {
                  setAvatar('sparkles');
                  setColor('pink');
                }
              }}
              className="w-5 h-5 accent-pink-500 rounded cursor-pointer"
            />
          </div>

          {/* Préférences Langues Audio & Sous-titres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Piste audio par défaut
              </label>
              <select
                value={audioLang}
                onChange={(e) => setAudioLang(e.target.value)}
                className="w-full px-3 py-2 bg-[#141923] border border-white/10 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="fra">🇫🇷 Français (VF)</option>
                <option value="eng">🇬🇧 Anglais (VO)</option>
                <option value="jpn">🇯🇵 Japonais (Anime)</option>
                <option value="spa">🇪🇸 Espagnol</option>
                <option value="deu">🇩🇪 Allemand</option>
                <option value="ita">🇮🇹 Italien</option>
                <option value="kor">🇰🇷 Coréen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Règle sous-titres
              </label>
              <select
                value={subMode}
                onChange={(e) => setSubMode(e.target.value)}
                className="w-full px-3 py-2 bg-[#141923] border border-white/10 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="foreign_only">💬 VOSTFR (si audio étranger)</option>
                <option value="always">Toujours actifs</option>
                <option value="off">Désactivés</option>
              </select>
            </div>
          </div>

          {/* Code PIN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Code PIN de verrouillage (4 chiffres)
            </label>
            <input
              type="password"
              maxLength={4}
              placeholder={isEditing ? 'Laisser vide pour ne pas verrouiller' : 'Ex: 1234 (optionnel)'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2 bg-[#141923] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Actions bas */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            {isEditing && canDelete && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  confirmDelete
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {confirmDelete ? 'Confirmer suppression ?' : 'Supprimer'}
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer flex items-center gap-1.5 ${
                  !name.trim() || isSubmitting
                    ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                    : `bg-gradient-to-r ${currentTheme.gradient} hover:opacity-95 shadow-${color}-500/30`
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                {isEditing ? 'Enregistrer les modifications' : 'Créer le profil'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

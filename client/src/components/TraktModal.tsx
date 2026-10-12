import React, { useState, useEffect } from 'react';
import {
  Tv,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Activity,
  PlaySquare,
} from 'lucide-react';
import { api, type TraktAuthInfo } from '../api';

interface Props {
  profileId: string;
  profileName: string;
  onClose: () => void;
}

export const TraktModal: React.FC<Props> = ({ profileId, profileName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [traktAuth, setTraktAuth] = useState<TraktAuthInfo | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTraktAuth();
  }, [profileId]);

  const loadTraktAuth = async () => {
    try {
      setLoading(true);
      const auth = await api.getTraktAuth(profileId);
      setTraktAuth(auth);
      if (auth?.username) {
        setUsernameInput(auth.username);
      }
    } catch (err) {
      console.warn('Failed to get Trakt auth:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Veuillez renseigner votre token d’accès Trakt.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const auth = await api.saveTraktAuth(profileId, {
        accessToken: tokenInput.trim(),
        username: usernameInput.trim() || undefined,
      });
      setTraktAuth(auth);
      setSuccessMessage('Compte Trakt connecté avec succès ! Scrobble en direct activé.');
      setTokenInput('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion à Trakt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsSubmitting(true);
      await api.disconnectTrakt(profileId);
      setTraktAuth(null);
      setSuccessMessage('Compte Trakt déconnecté.');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la déconnexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#111622] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Scrobble Trakt.tv</h2>
              <p className="text-xs text-slate-400">
                Profil : <span className="font-bold text-white">{profileName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
            <span className="text-xs font-semibold">Vérification de la connexion Trakt...</span>
          </div>
        ) : traktAuth ? (
          /* Déjà connecté */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-red-400">
                    Connecté à Trakt
                  </div>
                  <div className="text-sm font-bold text-white">
                    {traktAuth.username ? `@${traktAuth.username}` : 'Compte actif'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Scrobble Actif
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-300 bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-2 text-white font-semibold mb-1">
                <Activity className="w-4 h-4 text-indigo-400" />
                Synchronisation automatique
              </div>
              <p className="text-[11px] text-slate-400">
                Lorsque vous lancez un film ou un épisode, Stremo envoie automatiquement les événements :
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
                <li><strong className="text-white">Début de lecture :</strong> notification « En train de regarder »</li>
                <li><strong className="text-white">Pause / Reprise :</strong> synchronisation de l'avancement</li>
                <li><strong className="text-white">Fin (&gt;80%) :</strong> marqué comme « Vu » dans votre historique Trakt</li>
              </ul>
            </div>

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleDisconnect}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-xs font-bold text-red-300 hover:text-red-200 transition flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Déconnecter Trakt
              </button>
            </div>
          </div>
        ) : (
          /* Non connecté - Formulaire de connexion */
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 space-y-2">
              <p>
                Connectez votre compte <strong className="text-white">Trakt.tv</strong> pour synchroniser automatiquement vos films et séries vus sur l'ensemble de vos appareils.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-indigo-400">
                <a
                  href="https://trakt.tv/oauth/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:underline font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Obtenir un token Trakt personnel
                </a>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nom d’utilisateur Trakt (optionnel)
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ex: cinephile92"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Access Token Trakt
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Collez votre token d'accès Trakt ici..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !tokenInput.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-red-600/20 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <PlaySquare className="w-4 h-4" />
                  Activer le scrobble Trakt
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Tv,
  Laptop,
  RefreshCw,
  LogOut,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { api, type Account, type AccountSession, type Profile } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAccountUpdated?: () => void;
}

export const AccountModal: React.FC<Props> = ({ isOpen, onClose, onAccountUpdated }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [deviceName, setDeviceName] = useState(() => {
    if (typeof window === 'undefined') return 'Stremo Web';
    const ua = navigator.userAgent;
    if (/Android.*TV|AFTT|BRAVIA/i.test(ua)) return 'Android TV';
    if (/Android/i.test(ua)) return 'Stremo Android';
    if (/iPhone|iPad/i.test(ua)) return 'Stremo iOS';
    if (/Linux/i.test(ua)) return 'Stremo Linux';
    if (/Macintosh/i.test(ua)) return 'Stremo macOS';
    if (/Windows/i.test(ua)) return 'Stremo Windows';
    return 'Stremo Web';
  });

  const loadAccount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.account.getMe();
      if (data) {
        setAccount(data.account);
        setSessions(data.sessions || []);
        setProfiles(data.profiles || []);
      } else {
        setAccount(null);
        setSessions([]);
        setProfiles([]);
      }
    } catch {
      setAccount(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccount();
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Veuillez renseigner votre identifiant et mot de passe.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.account.login(username.trim(), password, deviceName);
      setSuccessMessage('Connexion réussie !');
      setUsername('');
      setPassword('');
      await loadAccount();
      onAccountUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 3) {
      setError('Le nom d\'utilisateur doit comporter au moins 3 caractères.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await api.account.register(username.trim(), password, email.trim() || undefined, deviceName);
      setSuccessMessage('Compte créé avec succès !');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setEmail('');
      await loadAccount();
      onAccountUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await api.account.logout();
      setAccount(null);
      setSessions([]);
      setProfiles([]);
      setSuccessMessage('Déconnecté.');
      onAccountUpdated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimLocalData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.account.claimLocalData();
      setSuccessMessage(`${res.claimedProfiles} profil(s) rattaché(s) à votre compte avec succès !`);
      await loadAccount();
      onAccountUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Erreur de réclamation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!account) return;
    setIsSyncing(true);
    setError(null);
    try {
      await api.account.sync({});
      setSuccessMessage('Données synchronisées avec succès !');
      await loadAccount();
      onAccountUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Erreur de synchronisation.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getDeviceIcon = (devName?: string) => {
    const name = devName || '';
    if (/TV/i.test(name)) return <Tv className="w-4 h-4 text-amber-400" />;
    if (/Android|iOS|Mobile|iPhone/i.test(name)) return <Smartphone className="w-4 h-4 text-emerald-400" />;
    return <Laptop className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">
                {account ? 'Mon Compte Stremo' : 'Compte & Synchronisation'}
              </h2>
              <p className="text-xs text-slate-400">
                {account ? `Connecté sous @${account.username}` : 'Accédez à vos profils et historique sur tous vos appareils'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Feedback */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {account ? (
            /* Mode Connecté */
            <div className="space-y-6">
              {/* Carte Utilisateur */}
              <div className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                    {account.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
                      <span className="truncate">@{account.username}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        Synchronisé
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {account.email ? account.email : 'Aucun email associé'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Membre depuis le {new Date(account.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="p-2.5 text-slate-400 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"
                  title="Se déconnecter"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>

              {/* Synchronisation Cloud & Statut */}
              <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Synchronisation Multi-Écrans
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Reprise de lecture, profils et favoris répliqués instantanément.
                    </p>
                  </div>
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Synchronisation...' : 'Synchroniser'}</span>
                  </button>
                </div>

                {/* Option réclamation profils locaux */}
                <div className="pt-2 border-t border-slate-700/30 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Rattacher les profils locaux créés hors compte :</span>
                  <button
                    onClick={handleClaimLocalData}
                    disabled={isLoading}
                    className="text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer"
                  >
                    Rattacher
                  </button>
                </div>
              </div>

              {/* Profils du Compte */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Profils rattachés ({profiles.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-2 text-xs"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-[11px]">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-200 font-medium truncate">{p.name}</span>
                      {p.isKids === 1 && (
                        <span className="text-[9px] uppercase px-1 rounded bg-pink-500/20 text-pink-300 font-bold ml-auto">
                          Kids
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions & Appareils Connectés */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  Appareils actifs ({sessions.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sessions.map((sess, idx) => (
                    <div
                      key={sess.token || idx}
                      className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-slate-700/50">
                          {getDeviceIcon(sess.deviceName)}
                        </div>
                        <div>
                          <div className="text-slate-200 font-bold">
                            {sess.deviceName || 'Appareil Stremo'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Connecté le {new Date(sess.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        Actif
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Mode Non-Connecté : Formulaires Connexion / Inscription */
            <div className="space-y-5">
              {/* Sélecteur d'onglets */}
              <div className="grid grid-cols-2 p-1 bg-slate-800/60 rounded-2xl border border-slate-700/50">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError(null); }}
                  className={`py-2 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    activeTab === 'login'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setError(null); }}
                  className={`py-2 text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Créer un compte
                </button>
              </div>

              {activeTab === 'login' ? (
                /* Formulaire Connexion */
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nom d'utilisateur ou Email
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ex: toto"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nom de cet appareil
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="ex: Salon TV, PC Bureau..."
                      className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Se connecter</span>
                  </button>
                </form>
              ) : (
                /* Formulaire Inscription */
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nom d'utilisateur <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="ex: alex_stream"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Adresse email (optionnel)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Mot de passe <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 car."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Confirmation <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirmer"
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Nom de cet appareil
                    </label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="ex: Salon TV, PC Bureau..."
                      className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl leading-relaxed">
                    💡 Un compte Stremo vous permet de synchroniser vos favoris, profils et reprises de lecture entre votre Android TV, votre smartphone et votre PC.
                  </p>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>Créer mon compte</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

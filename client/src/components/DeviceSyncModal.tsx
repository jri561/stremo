import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Tv,
  Smartphone,
  QrCode,
  Check,
  Copy,
  RefreshCw,
  X,
  ArrowRight,
  ShieldCheck,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
} from 'lucide-react';
import { api } from '../api';

interface Props {
  initialPairCode?: string;
  onClose: () => void;
  onDataSynced: () => void;
}

export const DeviceSyncModal: React.FC<Props> = ({
  initialPairCode,
  onClose,
  onDataSynced,
}) => {
  const [activeTab, setActiveTab] = useState<'receive' | 'send' | 'continuous'>(
    initialPairCode ? 'send' : 'receive'
  );

  // Tab 1: Receive (TV / Nouvel écran)
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [pairingSuccess, setPairingSuccess] = useState(false);
  const pollTimerRef = useRef<any>(null);

  // Tab 2: Send (Depuis PC / Smartphone actif)
  const [inputCode, setInputCode] = useState(initialPairCode || '');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Tab 3: Continuous Family Sync Hub
  const [syncChannelId, setSyncChannelId] = useState<string>(() => {
    return localStorage.getItem('stremo_family_sync_key') || '';
  });
  const [continuousSyncEnabled, setContinuousSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('stremo_continuous_sync') === 'true';
  });
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);

  // Générer un code d'appairage pour cet écran
  const handleGeneratePairCode = async () => {
    try {
      setPairingSuccess(false);
      const res = await api.createPairSession(syncChannelId || undefined);
      setPairCode(res.code);
      setExpiresAt(res.expiresAt);

      // Générer l'URL QR Code : https://domaine/?pairCode=XXXXXX
      const targetUrl = `${window.location.origin}${window.location.pathname}?pairCode=${res.code}`;
      const qrData = await QRCode.toDataURL(targetUrl, {
        margin: 1.5,
        width: 220,
        color: {
          dark: '#07090eff',
          light: '#ffffffff',
        },
      });
      setQrCodeUrl(qrData);
    } catch (err) {
      console.error('Failed to generate pair code:', err);
    }
  };

  // Initialisation du code au montage de l'onglet Receive
  useEffect(() => {
    if (activeTab === 'receive' && !pairCode) {
      handleGeneratePairCode();
    }
  }, [activeTab]);

  // Décompte de validité du code
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setPairCode(null);
        setQrCodeUrl(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Polling automatique pour détecter quand le smartphone/PC valide le code
  useEffect(() => {
    if (activeTab !== 'receive' || !pairCode || pairingSuccess) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const session = await api.checkPairSession(pairCode);
        if (session.status === 'paired' && session.data) {
          clearInterval(pollTimerRef.current);
          setPairingSuccess(true);

          // Si un canal de synchronisation familial a été transmis, l'enregistrer
          if (session.channelId) {
            localStorage.setItem('stremo_family_sync_key', session.channelId);
            localStorage.setItem('stremo_continuous_sync', 'true');
          }

          // Importer les profils et l'historique reçus
          await api.importBackup(session.data);

          setTimeout(() => {
            onDataSynced();
            onClose();
          }, 1800);
        } else if (session.status === 'expired') {
          clearInterval(pollTimerRef.current);
          setPairCode(null);
        }
      } catch {
        // Ignorer les erreurs transitoires de polling
      }
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeTab, pairCode, pairingSuccess]);

  // Envoi / Autorisation du code depuis le PC ou Smartphone
  const handleAuthorizeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;

    try {
      setIsSending(true);
      setSendError(null);

      // Exporter l'état complet actuel (profils, addons, bibliothèque, historique)
      const dataToSync = await api.exportBackup();

      // Utiliser le canal existant ou en créer un nouveau pour le foyer
      let currentChannel = syncChannelId;
      if (!currentChannel) {
        currentChannel = 'FAMILLE-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        setSyncChannelId(currentChannel);
        localStorage.setItem('stremo_family_sync_key', currentChannel);
        localStorage.setItem('stremo_continuous_sync', 'true');
      }

      await api.authorizePairSession(clean, dataToSync, currentChannel);
      setSendSuccess(true);
      setTimeout(() => {
        setSendSuccess(false);
        setInputCode('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setSendError(err.message || "Impossible d'associer cet appareil. Vérifiez le code affiché.");
    } finally {
      setIsSending(false);
    }
  };

  // Synchronisation continue (Push / Pull)
  const handleToggleContinuousSync = () => {
    const nextVal = !continuousSyncEnabled;
    setContinuousSyncEnabled(nextVal);
    localStorage.setItem('stremo_continuous_sync', String(nextVal));

    if (nextVal && !syncChannelId) {
      const generated = 'FAMILLE-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      setSyncChannelId(generated);
      localStorage.setItem('stremo_family_sync_key', generated);
    }
  };

  const handleManualPushSync = async () => {
    if (!syncChannelId.trim()) return;
    try {
      setIsManualSyncing(true);
      const data = await api.exportBackup();
      await api.pushSyncChannel(syncChannelId.trim().toUpperCase(), data);
      localStorage.setItem('stremo_family_sync_key', syncChannelId.trim().toUpperCase());
      setSyncStatusMsg('Configuration envoyée au canal familial avec succès !');
      setTimeout(() => setSyncStatusMsg(null), 3000);
    } catch (err: any) {
      setSyncStatusMsg('Erreur: ' + err.message);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleManualPullSync = async () => {
    if (!syncChannelId.trim()) return;
    try {
      setIsManualSyncing(true);
      const channel = await api.pullSyncChannel(syncChannelId.trim().toUpperCase());
      if (channel && channel.data) {
        await api.importBackup(channel.data);
        localStorage.setItem('stremo_family_sync_key', syncChannelId.trim().toUpperCase());
        setSyncStatusMsg('Dernière version reçue et appliquée avec succès !');
        setTimeout(() => {
          setSyncStatusMsg(null);
          onDataSynced();
        }, 1200);
      } else {
        setSyncStatusMsg('Aucune donnée trouvée sur cette clé de synchronisation.');
      }
    } catch (err: any) {
      setSyncStatusMsg('Erreur: ' + err.message);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#111622] border border-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-white no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Radio className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Synchronisation Multi-Écrans</h2>
              <p className="text-xs text-slate-400">
                Liez votre téléviseur, votre ordinateur et votre téléphone en 5 secondes
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

        {/* 3 Onglets de navigation */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-xl text-xs font-bold text-center">
          <button
            onClick={() => setActiveTab('receive')}
            className={`py-2 px-1 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'receive'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4 shrink-0" />
            <span>Connecter TV</span>
          </button>

          <button
            onClick={() => setActiveTab('send')}
            className={`py-2 px-1 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'send'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Lier un écran</span>
          </button>

          <button
            onClick={() => setActiveTab('continuous')}
            className={`py-2 px-1 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'continuous'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Synchro Foyer</span>
          </button>
        </div>

        {/* ONGLET 1 : RECEVOIR SUR CET ÉCRAN (PARFAIT POUR TV) */}
        {activeTab === 'receive' && (
          <div className="space-y-5 text-center">
            {pairingSuccess ? (
              <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3 animate-fade-in">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 animate-bounce" />
                <h3 className="text-base font-black text-white">Téléviseur Connecté !</h3>
                <p className="text-xs text-slate-300">
                  Tous vos profils, favoris et add-ons ont été synchronisés instantanément.
                </p>
                <div className="text-[11px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Mise à jour en cours...
                </div>
              </div>
            ) : pairCode ? (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 text-slate-300 text-xs">
                  <p className="font-semibold text-white">
                    Pour lier ce téléviseur ou cet ordinateur en quelques secondes :
                  </p>
                  <p className="text-slate-400">
                    Ouvrez Stremo sur votre téléphone ou PC principal, allez dans{' '}
                    <strong className="text-indigo-300">« Lier un écran »</strong> et tapez le code ci-dessous, ou scannez le QR Code.
                  </p>
                </div>

                {/* Bloc Code 6 caractères géant & QR Code */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-black/40 border border-indigo-500/30">
                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div className="p-2.5 bg-white rounded-2xl shadow-xl flex flex-col items-center shrink-0">
                      <img
                        src={qrCodeUrl}
                        alt="Scannez avec votre smartphone"
                        className="w-36 h-36 rounded-lg"
                      />
                      <span className="text-[10px] font-bold text-black uppercase mt-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-black" />
                        Scan caméra mobile
                      </span>
                    </div>
                  )}

                  {/* Code Texte Géant */}
                  <div className="space-y-3 flex-1">
                    <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      Code d'appairage rapide
                    </div>
                    <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-indigo-400 bg-white/5 py-3 px-5 rounded-xl border border-white/10 select-all flex items-center justify-center gap-3">
                      <span>{pairCode.slice(0, 3)}-{pairCode.slice(3)}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pairCode);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Copier le code"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                      En attente de connexion... ({formatCountdown(timeLeft)})
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleGeneratePairCode}
                    className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Générer un nouveau code
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-4">
                <p className="text-xs text-slate-400">Le code a expiré ou n'a pas encore été généré.</p>
                <button
                  onClick={handleGeneratePairCode}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white transition cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  Obtenir un code de connexion
                </button>
              </div>
            )}
          </div>
        )}

        {/* ONGLET 2 : ENVOYER DEPUIS CET APPAREIL CONFIGURÉ */}
        {activeTab === 'send' && (
          <form onSubmit={handleAuthorizeCode} className="space-y-5">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-white">Transférer votre compte sur un nouvel écran</p>
              <p>
                Entrez le code à 6 caractères affiché sur votre téléviseur ou tablette pour lui transférer automatiquement vos profils, add-ons configurés et historique de lecture.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Code à 6 caractères affiché sur la Télévision
              </label>
              <input
                type="text"
                maxLength={7}
                placeholder="Ex: 849-215"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                className="w-full text-center text-2xl font-mono font-black tracking-widest py-3 px-4 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition uppercase"
                autoFocus
              />
            </div>

            {sendError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {sendSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Téléviseur synchronisé avec succès !</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSending || inputCode.trim().length < 5}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Synchronisation en cours...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Autoriser et Synchroniser cet écran
                </>
              )}
            </button>
          </form>
        )}

        {/* ONGLET 3 : SYNCHRONISATION CONTINUE DU FOYER */}
        {activeTab === 'continuous' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
              <div>
                <span className="text-xs font-bold text-white block">Synchronisation continue en direct</span>
                <span className="text-[11px] text-slate-400 block">
                  Met à jour automatiquement la reprise de lecture et les favoris entre vos appareils
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleContinuousSync}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  continuousSyncEnabled ? 'bg-indigo-600' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    continuousSyncEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Clé de synchronisation familiale
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={syncChannelId}
                  onChange={(e) => setSyncChannelId(e.target.value.toUpperCase())}
                  placeholder="Ex: FAMILLE-STREMO-842"
                  className="flex-1 py-2 px-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono font-bold text-indigo-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    const generated = 'FAMILLE-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                    setSyncChannelId(generated);
                    localStorage.setItem('stremo_family_sync_key', generated);
                  }}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Générer
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Tous les appareils ayant la même clé partagent automatiquement l'avancement des films et séries.
              </p>
            </div>

            {syncStatusMsg && (
              <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleManualPushSync}
                disabled={isManualSyncing || !syncChannelId.trim()}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                Envoyer au foyer
              </button>
              <button
                type="button"
                onClick={handleManualPullSync}
                disabled={isManualSyncing || !syncChannelId.trim()}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 shadow-lg shadow-indigo-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                Recevoir du foyer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

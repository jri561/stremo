import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Copy,
  Check,
  RefreshCw,
  X,
  Database,
  Smartphone,
  Tv,
  Monitor,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { api, type BackupData } from '../api';

interface Props {
  onClose: () => void;
  onDataRestored?: () => void;
}

export const BackupModal: React.FC<Props> = ({ onClose, onDataRestored }) => {
  const [loadingExport, setLoadingExport] = useState(false);
  const [exportData, setExportData] = useState<BackupData | null>(null);
  const [copied, setCopied] = useState(false);

  // Import state
  const [importJsonText, setImportJsonText] = useState('');
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Load preview export stats on mount
  useEffect(() => {
    loadExportData();
  }, []);

  const loadExportData = async () => {
    try {
      setLoadingExport(true);
      const data = await api.exportBackup();
      setExportData(data);
    } catch (err) {
      console.error('Failed to load backup data:', err);
    } finally {
      setLoadingExport(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const data = exportData || (await api.exportBackup());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `stremo_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Erreur lors de l'exportation: " + (err.message || err));
    }
  };

  const handleCopyClipboard = async () => {
    try {
      const data = exportData || (await api.exportBackup());
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text || '');
      setImportStatus(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importJsonText.trim()) {
      setImportStatus({ success: false, message: 'Veuillez coller un JSON ou choisir un fichier de sauvegarde.' });
      return;
    }

    try {
      setIsImporting(true);
      setImportStatus(null);

      let parsed: any;
      try {
        parsed = JSON.parse(importJsonText);
      } catch {
        throw new Error('Le format du texte n’est pas un JSON valide.');
      }

      const res = await api.importBackup({
        ...parsed,
        overwrite: importOverwrite,
      });

      setImportStatus({
        success: true,
        message: res.message || 'Sauvegarde restaurée avec succès !',
      });
      setImportJsonText('');

      // Refresh data
      await loadExportData();
      if (onDataRestored) {
        onDataRestored();
      }
    } catch (err: any) {
      setImportStatus({
        success: false,
        message: err.message || "Échec de l'importation de la sauvegarde.",
      });
    } finally {
      setIsImporting(false);
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
      <div className="bg-[#111622] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 text-white no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Sauvegarde & Synchronisation</h2>
              <p className="text-xs text-slate-400">
                Transférez vos profils, add-ons, favoris et progression sur tous vos appareils
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

        {/* Sync Across Devices Info Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 to-violet-950/40 border border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1">
              <span className="p-2 rounded-lg bg-black/30 border border-white/10 text-slate-300">
                <Monitor className="w-4 h-4" />
              </span>
              <span className="p-2 rounded-lg bg-black/30 border border-white/10 text-slate-300">
                <Smartphone className="w-4 h-4" />
              </span>
              <span className="p-2 rounded-lg bg-black/30 border border-white/10 text-slate-300">
                <Tv className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">Continuité multi-écrans</div>
              <p className="text-[11px] text-slate-400">
                Exportez vos données depuis votre PC et importez-les en un clin d’œil sur votre mobile ou votre TV.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 1: EXPORTATION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              1. Exporter vos données
            </h3>
            {loadingExport && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
          </div>

          {exportData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-black text-indigo-400">{exportData.profiles?.length || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Profils</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-black text-violet-400">{exportData.addons?.length || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Add-ons</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-black text-pink-400">{exportData.library?.length || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Favoris</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-black text-emerald-400">{exportData.progress?.length || 0}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Reprise</div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              onClick={handleDownloadBackup}
              className="w-full sm:w-auto flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Download className="w-4 h-4" />
              Télécharger la sauvegarde (.json)
            </button>
            <button
              onClick={handleCopyClipboard}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-xs text-slate-200 hover:text-white flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié dans le presse-papier !' : 'Copier le JSON'}
            </button>
          </div>
        </div>

        {/* SECTION 2: IMPORTATION */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Upload className="w-4 h-4 text-violet-400" />
            2. Importer ou Restaurer
          </h3>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 border-dashed text-xs text-slate-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Sélectionner un fichier .json</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Ou collez ici le contenu JSON complet de votre sauvegarde..."
              rows={4}
              className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>

          {/* Option Overwrite vs Merge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div>
              <span className="text-xs font-bold text-white block">Mode d'importation</span>
              <span className="text-[11px] text-slate-400 block">
                {importOverwrite
                  ? 'Écrasement complet : efface les données existantes avant de restaurer'
                  : 'Fusion intelligente : conserve les profils actuels et ajoute les nouveaux'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setImportOverwrite(!importOverwrite)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                importOverwrite
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {importOverwrite ? 'Mode Écrasement' : 'Mode Fusion'}
            </button>
          </div>

          {importStatus && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                importStatus.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {importStatus.success ? <FileCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{importStatus.message}</span>
            </div>
          )}

          <button
            onClick={handleExecuteImport}
            disabled={isImporting || !importJsonText.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-violet-600/20 active:scale-95"
          >
            {isImporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Restauration en cours...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Lancer la restauration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

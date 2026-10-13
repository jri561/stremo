import React, { useState, useEffect } from 'react';
import { Info, Star, Plus, Check, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import type { CatalogItem } from '../api';

interface HeroBannerProps {
  items: CatalogItem[];
  isInLib: (item: CatalogItem) => boolean;
  onPlay: (item: CatalogItem) => void;
  onOpenDetails: (item: CatalogItem) => void;
  onToggleLibrary: (item: CatalogItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  isInLib,
  onPlay,
  onOpenDetails,
  onToggleLibrary,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Rotation automatique toutes les 8 secondes (mise en pause au survol)
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [items.length, isPaused]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const bgImage = currentItem.background || currentItem.landscapePoster || currentItem.poster;
  const inLibrary = isInLib(currentItem);
  const ratingValid = currentItem.imdbRating && String(currentItem.imdbRating) !== 'N/A' && Number(currentItem.imdbRating) > 0;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full h-[380px] sm:h-[440px] md:h-[500px] lg:h-[540px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/10 group bg-[#0e1118]"
    >
      {/* Image de fond avec transition douce */}
      {bgImage && (
        <img
          key={currentItem.id}
          src={bgImage}
          alt={currentItem.name}
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.78] transition-all duration-700 ease-out animate-fade-in group-hover:scale-102"
        />
      )}

      {/* Dégradés d'ambiance harmonieux */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090e]/95 via-[#07090e]/60 to-transparent max-w-4xl" />

      {/* Flèches de navigation carrousel (visibles au survol sur desktop) */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            aria-label="Titre précédent"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center cursor-pointer border border-white/10 z-20"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            aria-label="Titre suivant"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white transition opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center cursor-pointer border border-white/10 z-20"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Contenu textuel et actions */}
      <div className="absolute inset-0 p-6 sm:p-10 md:p-12 lg:p-14 flex flex-col justify-end max-w-3xl space-y-3 z-10">
        {/* Badges d'information */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-white/15 text-white backdrop-blur-md border border-white/10">
            {currentItem.type === 'series' ? 'Série TV' : 'Film'}
          </span>

          {ratingValid && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 backdrop-blur-md">
              <Star className="w-3 h-3 fill-amber-300" />
              {currentItem.imdbRating}
            </span>
          )}

          {currentItem.year && (
            <span className="text-xs font-semibold text-slate-300">
              {currentItem.year}
            </span>
          )}

          {currentItem.genres && currentItem.genres.length > 0 && (
            <span className="text-xs font-normal text-slate-300 hidden sm:inline">
              • {currentItem.genres.slice(0, 3).join(' • ')}
            </span>
          )}
        </div>

        {/* Titre */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight line-clamp-2">
          {currentItem.name}
        </h1>

        {/* Synopsis court */}
        {currentItem.description && (
          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-2xl font-normal text-pretty">
            {currentItem.description}
          </p>
        )}

        {/* Boutons d'action et indicateurs de pagination */}
        <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onPlay(currentItem)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-xs sm:text-sm shadow-xl transition active:scale-95 cursor-pointer"
              title="Lecture instantanée du meilleur flux adapté à votre profil"
            >
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>Lecture rapide</span>
            </button>

            <button
              onClick={() => onOpenDetails(currentItem)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-md border border-white/10 transition cursor-pointer"
            >
              <Info className="w-4 h-4" />
              <span>Détails</span>
            </button>

            <button
              onClick={() => onToggleLibrary(currentItem)}
              className={`p-2.5 rounded-xl backdrop-blur-md border transition cursor-pointer ${
                inLibrary
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
              }`}
              title={inLibrary ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
            >
              {inLibrary ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          {/* Indicateurs de diaporama */}
          {items.length > 1 && (
            <div className="flex items-center gap-1.5">
              {items.map((it, idx) => (
                <button
                  key={it.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Afficher ${it.name}`}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    currentIndex === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default HeroBanner;

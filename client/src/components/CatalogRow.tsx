import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Star } from 'lucide-react';
import type { CatalogItem } from '../api';

interface Props {
  title: string;
  subtitle?: string;
  items: CatalogItem[];
  onSelectItem: (item: CatalogItem) => void;
  onQuickPlay?: (item: CatalogItem) => void;
  onSeeAll?: () => void;
}

export const CatalogRow: React.FC<Props> = ({
  title,
  subtitle,
  items,
  onSelectItem,
  onQuickPlay,
  onSeeAll,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -620 : 620;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, item: CatalogItem, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.shiftKey && onQuickPlay) {
        onQuickPlay(item);
      } else {
        onSelectItem(item);
      }
    } else if (e.key === 'ArrowRight') {
      const parent = e.currentTarget.parentElement;
      if (parent && index < items.length - 1) {
        const next = parent.children[index + 1] as HTMLElement;
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const parent = e.currentTarget.parentElement;
      if (parent && index > 0) {
        const prev = parent.children[index - 1] as HTMLElement;
        if (prev) {
          e.preventDefault();
          prev.focus();
          prev.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    } else if (e.key === 'ArrowDown') {
      const currentSection = e.currentTarget.closest('section');
      const nextSection = currentSection?.nextElementSibling;
      const targetCard = nextSection?.querySelector('[tabindex="0"]') as HTMLElement;
      if (targetCard) {
        e.preventDefault();
        targetCard.focus();
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (e.key === 'ArrowUp') {
      const currentSection = e.currentTarget.closest('section');
      const prevSection = currentSection?.previousElementSibling;
      const targetCard = prevSection?.querySelector('[tabindex="0"]') as HTMLElement;
      if (targetCard) {
        e.preventDefault();
        targetCard.focus();
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-3 group/row">
      {/* En-tête de la ligne de catalogue */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs font-normal text-slate-400 hidden sm:inline">
              {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-xs font-medium text-slate-400 hover:text-white transition px-2 py-0.5 rounded cursor-pointer"
            >
              Explorer tout
            </button>
          )}

          {/* Flèches de navigation */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer"
              title="Précédent"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition border border-white/5 cursor-pointer"
              title="Suivant"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Conteneur avec défilement fluide */}
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          aria-label="Défiler vers la gauche"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-16 bg-black/80 hover:bg-black/95 text-white backdrop-blur-md rounded-lg opacity-0 group-hover/row:opacity-100 transition duration-150 hidden md:flex items-center justify-center shadow-lg border border-white/10 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3.5 overflow-x-auto pb-2 pt-0.5 snap-x scrollbar-none no-scrollbar scroll-smooth"
        >
          {items.map((item, index) => {
            const hasValidRating =
              item.imdbRating &&
              String(item.imdbRating) !== 'N/A' &&
              Number(item.imdbRating) > 0;
            const hasValidProgress =
              typeof item.progressPercent === 'number' && item.progressPercent >= 2;
            const remainingMin =
              item.duration && item.currentTime && item.duration > item.currentTime
                ? Math.max(1, Math.round((item.duration - item.currentTime) / 60))
                : null;

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                onKeyDown={(e) => handleKeyDown(e, item, index)}
                tabIndex={0}
                role="button"
                className="flex-shrink-0 w-32 sm:w-38 md:w-44 group/card cursor-pointer space-y-1.5 snap-start focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090e] rounded-xl transition duration-150"
              >
                {/* Affiche */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#0e1118] border border-white/8 group-hover/card:border-indigo-500/40 transition-all duration-200 shadow-md group-hover/card:scale-[1.02]">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover/card:brightness-105 transition duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs text-center p-2">
                      Pas d'affiche
                    </div>
                  )}

                  {/* Badge À Suivre / Prochain épisode */}
                  {item.isNextEpisode && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur shadow flex items-center gap-1 border border-emerald-400/30 z-10">
                      <span>À suivre</span>
                    </div>
                  )}

                  {/* Note IMDb (uniquement si valide) */}
                  {hasValidRating && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-bold text-amber-300 flex items-center gap-1 border border-white/10 shadow z-10">
                      <Star className="w-2.5 h-2.5 fill-amber-300" />
                      {item.imdbRating}
                    </div>
                  )}

                  {/* Survol Nuvio-style : Bouton Lecture Centré */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onQuickPlay) onQuickPlay(item);
                        else onSelectItem(item);
                      }}
                      title={`Lecture rapide de ${item.name}`}
                      className="pointer-events-auto w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-black/50 transform scale-90 group-hover/card:scale-100 hover:scale-110 active:scale-95 transition duration-200 backdrop-blur-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-white"
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                    </button>
                  </div>

                  {/* Barre de progression de reprise (uniquement si >= 2%) */}
                  {hasValidProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.min(100, Math.max(5, item.progressPercent!))}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Métadonnées sous l'affiche */}
                <div className="space-y-0.5 px-0.5">
                  <h4 className="text-xs md:text-sm font-semibold text-slate-200 group-hover/card:text-white line-clamp-1 transition">
                    {item.name}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    {item.isNextEpisode ? (
                      <span className="text-[10px] text-emerald-400 font-medium truncate">
                        {item.season && item.episode ? `Saison ${item.season} • Ép. ${item.episode}` : 'Prochain épisode'}
                      </span>
                    ) : remainingMin ? (
                      <span className="text-[10px] text-indigo-300 font-medium truncate">
                        {item.season && item.episode ? `S${item.season}E${item.episode} • ` : ''}Reste {remainingMin}m
                      </span>
                    ) : item.year ? (
                      <span>{item.year}</span>
                    ) : null}
                    {hasValidProgress && (
                      <span className="text-[10px] text-indigo-400 font-bold ml-auto shrink-0">
                        {Math.round(item.progressPercent!)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => scroll('right')}
          aria-label="Défiler vers la droite"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-16 bg-black/80 hover:bg-black/95 text-white backdrop-blur-md rounded-lg opacity-0 group-hover/row:opacity-100 transition duration-150 hidden md:flex items-center justify-center shadow-lg border border-white/10 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
export default CatalogRow;

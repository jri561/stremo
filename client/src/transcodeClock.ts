/**
 * Flux transcodé = fMP4 en direct : `currentTime` repart de 0 à `startTime` et `duration` est infinie.
 * Ce module fait voir au reste du lecteur un temps ABSOLU et une durée connue (sonde ffprobe) :
 * - lecture de `currentTime` = temps natif + offset ;
 * - écriture de `currentTime` = seek natif si la cible est déjà dans le tampon, sinon rechargement
 *   du flux avec un nouveau `startTime` (callback `reload`).
 */

export interface TranscodeClock {
  setOffset: (offset: number) => void;
  setDuration: (duration: number) => void;
  dispose: () => void;
}

/** Vrai si `rel` (temps natif) est dans une plage déjà tamponnée de la vidéo. */
export function isTimeBuffered(ranges: { length: number; start(i: number): number; end(i: number): number }, rel: number): boolean {
  for (let i = 0; i < ranges.length; i++) {
    if (rel >= ranges.start(i) && rel <= ranges.end(i) - 0.5) return true;
  }
  return false;
}

export function installTranscodeClock(
  video: HTMLVideoElement,
  initial: { offset: number; duration: number },
  reload: (absoluteTime: number) => void
): TranscodeClock {
  const proto = HTMLMediaElement.prototype;
  const nativeTime = Object.getOwnPropertyDescriptor(proto, 'currentTime')!;
  const nativeDuration = Object.getOwnPropertyDescriptor(proto, 'duration')!;
  let offset = initial.offset;
  let knownDuration = initial.duration;

  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => (nativeTime.get!.call(video) as number) + offset,
    set: (value: number) => {
      const target = Math.max(0, Number(value) || 0);
      const rel = target - offset;
      if (rel >= 0 && isTimeBuffered(video.buffered, rel)) nativeTime.set!.call(video, rel);
      else reload(target);
    },
  });
  Object.defineProperty(video, 'duration', {
    configurable: true,
    get: () => {
      if (knownDuration > 0) return knownDuration;
      const native = nativeDuration.get!.call(video) as number;
      return Number.isFinite(native) ? native + offset : 0;
    },
  });

  return {
    setOffset: (value) => {
      offset = value;
    },
    setDuration: (value) => {
      knownDuration = value;
    },
    dispose: () => {
      delete (video as any).currentTime;
      delete (video as any).duration;
    },
  };
}

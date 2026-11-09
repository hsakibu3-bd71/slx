import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, RefreshCw } from 'lucide-react';

interface VoiceMessagePlayerProps {
  mediaUrl: string;
  isSelf: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ mediaUrl, isSelf }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Compute alternative URL (if .webm -> also offer .mp4, and vice versa)
  const alternativeUrl = useMemo(() => {
    if (!mediaUrl) return '';
    if (mediaUrl.endsWith('.webm')) {
      return mediaUrl.replace(/\.webm$/, '.mp4');
    }
    if (mediaUrl.endsWith('.mp4')) {
      return mediaUrl.replace(/\.mp4$/, '.webm');
    }
    return '';
  }, [mediaUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsPlaying(false);
    setCurrentTime(0);
    setLoadError(false);

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if ((!duration || !isFinite(duration)) && isFinite(audio.duration) && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setLoadError(false);
    };

    const handleError = () => {
      setLoadError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('error', handleError);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setLoadError(false);
      // Ensure media is loaded
      if (audio.readyState === 0) {
        audio.load();
      }

      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
            setLoadError(false);
          })
          .catch((err: any) => {
            setIsPlaying(false);
            // Ignore AbortError caused by pause() interrupting play()
            if (err?.name !== 'AbortError') {
              setLoadError(true);
            }
          });
      }
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const barProgress = index / waveformHeights.length;
    if (duration > 0 && isFinite(duration)) {
      const targetTime = barProgress * duration;
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
    }

    if (!isPlaying) {
      togglePlay();
    }
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 && isFinite(duration) ? (currentTime / duration) * 100 : 0;

  // Render dummy waveform bars for high aesthetic feel
  const waveformHeights = [20, 45, 70, 35, 90, 60, 40, 80, 50, 65, 30, 85, 45, 95, 40, 75, 55, 30, 60, 80, 50];

  return (
    <div className="flex items-center gap-3 py-1 min-w-[220px] max-w-[280px]">
      <audio ref={audioRef} preload="metadata" playsInline>
        <source src={mediaUrl} />
        {alternativeUrl && <source src={alternativeUrl} />}
      </audio>

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
          loadError
            ? 'bg-amber-500/80 text-white'
            : isSelf
            ? 'bg-white text-zinc-900 hover:bg-zinc-100'
            : 'bg-sky-500 text-white hover:bg-sky-400'
        }`}
        title={loadError ? 'Tap to retry playback' : isPlaying ? 'Pause' : 'Play voice note'}
      >
        {loadError ? (
          <RefreshCw className="w-4 h-4" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform and Progress */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-[3px] h-6 py-1 cursor-pointer" onClick={() => togglePlay()}>
          {waveformHeights.map((h, i) => {
            const barProgress = (i / waveformHeights.length) * 100;
            const isFilled = barProgress <= progressPercent;
            return (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeek(i);
                }}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-full transition-colors duration-100 ${
                  isFilled
                    ? isSelf ? 'bg-white' : 'bg-sky-400'
                    : isSelf ? 'bg-white/30' : 'bg-white/20'
                }`}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-zinc-300 font-mono mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span className="flex items-center gap-1">
            <Volume2 className="w-2.5 h-2.5 opacity-60" />
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

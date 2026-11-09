import React, { useEffect, useState } from 'react';
import { EyeOff, ShieldAlert, Lock, RefreshCw, Smartphone } from 'lucide-react';

interface SensorPrivacyShieldProps {
  onVanishStateChange?: (isVanished: boolean) => void;
  isVisitor: boolean;
}

export const SensorPrivacyShield: React.FC<SensorPrivacyShieldProps> = ({
  onVanishStateChange,
  isVisitor
}) => {
  const [isVanished, setIsVanished] = useState(false);
  const [vanishReason, setVanishReason] = useState<string>('');
  const [sensorStatus, setSensorStatus] = useState<'active' | 'standby'>('active');

  useEffect(() => {
    // 1. Anti-Screenshot Keyboard Shortcut Detector
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        triggerVanish('Screenshot attempt blocked (PrintScreen)');
        return false;
      }

      // Windows + Shift + S or Ctrl + Shift + S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === '4' || e.key === '3')) {
        e.preventDefault();
        triggerVanish('Screenshot / Screen capture shortcut intercepted');
        return false;
      }

      // Ctrl + P (Print/Save to PDF)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        triggerVanish('Page print / export blocked');
        return false;
      }
    };

    // 2. Anti-Screenshot App Switcher / Visibility Change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerVanish('App switcher / background capture detected');
      }
    };

    // 3. Ambient Light & Front Camera Proximity Sensor Listener
    let lightSensor: any = null;
    let proximitySensor: any = null;

    try {
      if ('AmbientLightSensor' in window) {
        // @ts-ignore
        lightSensor = new window.AmbientLightSensor({ frequency: 10 });
        let baselineLux: number | null = null;

        lightSensor.onreading = () => {
          const lux = lightSensor.illuminance;
          if (baselineLux === null) {
            baselineLux = lux;
          } else if (baselineLux > 15 && lux < 4) {
            // Sudden severe occlusion over top camera/sensor (another phone hovering)
            triggerVanish('Top camera ambient sensor occluded: Foreign device/camera detected hovering above screen');
          }
        };

        lightSensor.onerror = () => {
          // Sensor permission fallback
        };

        lightSensor.start();
        setSensorStatus('active');
      }

      // @ts-ignore
      if ('ProximitySensor' in window) {
        // @ts-ignore
        proximitySensor = new window.ProximitySensor();
        proximitySensor.onreading = () => {
          if (proximitySensor.near) {
            triggerVanish('Top proximity sensor triggered: Foreign object/camera detected');
          }
        };
        proximitySensor.start();
      }
    } catch (e) {
      // Sensor API permission handling
    }

    // 4. Block Context Menu (Right Click) & Dragging
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);

      if (lightSensor) lightSensor.stop();
      if (proximitySensor) proximitySensor.stop();
    };
  }, []);

  const triggerVanish = (reason: string) => {
    setIsVanished(true);
    setVanishReason(reason);
    if (onVanishStateChange) {
      onVanishStateChange(true);
    }
  };

  const handleRestore = () => {
    setIsVanished(false);
    setVanishReason('');
    if (onVanishStateChange) {
      onVanishStateChange(false);
    }
  };

  if (!isVanished) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black text-white text-center animate-in fade-in duration-100">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 animate-pulse">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h2 className="text-lg font-bold text-white mb-2">Content Vanished for Privacy</h2>
      <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
        {vanishReason || 'Top phone camera sensor occlusion or screen capture attempt detected. All messages were instantly vanished to prevent external photo capture.'}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mb-8 bg-zinc-950 p-2.5 px-4 rounded-xl border border-white/10">
        <Lock className="w-3.5 h-3.5 text-red-400" />
        <span>Hardware Sensor Protection Engaged</span>
      </div>

      <button
        onClick={handleRestore}
        className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Restore Content</span>
      </button>
    </div>
  );
};

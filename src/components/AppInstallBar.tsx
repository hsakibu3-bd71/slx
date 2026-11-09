import React, { useState, useEffect } from 'react';
import { Download, X, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const AppInstallBar: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  useEffect(() => {
    // Check if already running in standalone webview mode
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneMode);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleAndroidInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowAndroidModal(true);
    }
  };

  if (isStandalone) {
    return null; // Don't show if already opened inside installed Webview app
  }

  return (
    <>
      {/* Bottom Floating Bar */}
      <div className="w-full max-w-4xl mx-auto px-4 pb-3 pt-1">
        <div className="flex items-center justify-between gap-3 p-2.5 px-4 rounded-2xl bg-zinc-950/90 border border-white/10 backdrop-blur-md shadow-2xl">
          {/* Left: App Logo S (Black Background, White S) + Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-black border border-white/20 flex items-center justify-center font-bold text-white text-base shadow-inner shrink-0">
              S
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-white leading-none">Sakib Hasan App</div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Standalone Webview</div>
            </div>
          </div>

          {/* Right: Android & Apple 1-Click Install Buttons */}
          <div className="flex items-center gap-2">
            {/* Android Logo Button */}
            <button
              onClick={handleAndroidInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold transition-all active:scale-95"
              title="Install on Android"
            >
              {/* Android Robot SVG Icon */}
              <svg className="w-3.5 h-3.5 fill-emerald-400" viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.125 12 8.125s-3.5902.2866-5.1368.8247L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.77h24c-.3432-4.1111-2.6889-7.5833-6.1185-9.4486" />
              </svg>
              <span>Android</span>
            </button>

            {/* Apple Logo Button */}
            <button
              onClick={() => setShowIOSModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-semibold transition-all active:scale-95"
              title="Add to Home on Apple iOS"
            >
              {/* Apple SVG Icon */}
              <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 170 170">
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.59-7.71-11.66-14.02-6.09-9.44-10.86-20.06-14.3-31.84-3.44-11.78-5.16-23.01-5.16-33.69 0-14.77 3.58-27.14 10.74-37.11 7.16-9.98 16.48-15.08 27.97-15.31 5.33 0 11.22 1.45 17.68 4.36 6.45 2.91 10.51 4.41 12.16 4.51 1.54 0 5.86-1.55 12.98-4.66 7.12-3.11 13.31-4.47 18.57-4.08 14.12.99 25.13 6.07 33.02 15.25-12.44 7.54-18.55 17.65-18.33 30.34.22 9.87 4.02 18.17 11.4 24.91 7.38 6.74 16.14 10.59 26.28 11.55-2.23 6.76-4.8 13.58-7.72 20.46zM119.22 31.84c0-7.39 2.67-14.36 8.01-20.91 5.34-6.55 11.89-10.49 19.64-11.83.44 1.1.66 2.29.66 3.56 0 7.39-2.73 14.47-8.19 21.24-5.46 6.77-12.18 10.68-20.12 11.73-.22-1.21-.33-2.4-.33-3.57z" />
              </svg>
              <span>Apple</span>
            </button>
          </div>
        </div>
      </div>

      {/* Android Modal Guide */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm glossy-card rounded-2xl p-6 text-white border border-white/10 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-black border border-white/20 mx-auto flex items-center justify-center font-bold text-2xl text-white mb-3 shadow-lg">
              S
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Install on Android</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Tap the browser menu (⋮) in Chrome, then select <strong>Install App</strong> or <strong>Add to Home Screen</strong> to run full-screen without address bar.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400 mb-5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Secure Self-Hosted WebAPK</span>
            </div>
            <button
              onClick={() => setShowAndroidModal(false)}
              className="w-full py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* iOS Modal Guide */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm glossy-card rounded-2xl p-6 text-white border border-white/10 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-black border border-white/20 mx-auto flex items-center justify-center font-bold text-2xl text-white mb-3 shadow-lg">
              S
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Add to Home Screen (Apple iOS)</h3>
            <div className="text-xs text-zinc-300 text-left space-y-2.5 my-4 bg-black/60 p-3.5 rounded-xl border border-white/10">
              <div className="flex items-start gap-2">
                <span className="font-mono text-zinc-400">1.</span>
                <span>Tap the <strong>Share</strong> icon (square with arrow 📤) in Safari toolbar.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-zinc-400">2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong> (➕).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-zinc-400">3.</span>
                <span>The <strong>S</strong> app icon will appear on your iPhone/iPad and open in full native Webview mode!</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

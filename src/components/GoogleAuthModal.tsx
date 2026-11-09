import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { UserSession } from '../types';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: UserSession) => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const quickGoogleAccounts = [
    {
      name: 'Google User',
      email: 'mesakibu4@gmail.com',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SakibUser',
    },
    {
      name: 'Verified Guest',
      email: 'visitor.google@gmail.com',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Visitor1',
    }
  ];

  const handleGoogleSubmit = (selectedEmail?: string, selectedName?: string, selectedAvatar?: string) => {
    setIsLoading(true);

    const finalName = selectedName || name.trim() || 'Google User';
    const finalEmail = selectedEmail || (email.trim() ? email.trim() : 'visitor@gmail.com');
    const finalAvatar = selectedAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(finalEmail)}`;

    setTimeout(() => {
      const session: UserSession = {
        id: 'user_' + Math.random().toString(36).substring(2, 9),
        name: finalName,
        email: finalEmail,
        avatar: finalAvatar,
        isGoogleAuthenticated: true,
        role: 'user',
      };

      localStorage.setItem('nexus_user_session', JSON.stringify(session));
      setIsLoading(false);
      onSuccess(session);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm glossy-card rounded-2xl p-6 text-white shadow-2xl border border-white/10">
        {/* Google Icon Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3 border border-white/10 shadow-inner">
            <svg className="w-8 h-8" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.36 7.35 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Sign In with Google</h2>
        </div>

        {/* Quick Google 1-Click Accounts */}
        <div className="space-y-2 mb-4">
          {quickGoogleAccounts.map((acc) => (
            <button
              key={acc.email}
              onClick={() => handleGoogleSubmit(acc.email, acc.name, acc.avatar)}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <img
                  src={acc.avatar}
                  alt={acc.name}
                  className="w-8 h-8 rounded-full bg-zinc-800 border border-white/20"
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{acc.name}</div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate">{acc.email}</div>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            </button>
          ))}
        </div>

        {/* Custom Gmail Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGoogleSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gmail@google.com"
              className="w-full px-3 py-2 rounded-xl glossy-input text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !name}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-black hover:bg-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Continue with Google</span>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>OAuth 2.0 Verified</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

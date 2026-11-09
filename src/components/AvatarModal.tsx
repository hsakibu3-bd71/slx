import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X } from 'lucide-react';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string;
  userName: string;
  onSaveAvatar: (newAvatarUrl: string) => void;
}

export const AvatarModal: React.FC<AvatarModalProps> = ({
  isOpen,
  onClose,
  currentAvatar,
  userName,
  onSaveAvatar,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const presets = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=SakibUser',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sophia',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Michael',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Emma',
    'https://api.dicebear.com/7.x/bottts/svg?seed=David',
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          fileName: file.name,
          mimeType: file.type,
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.url) {
            setSelectedAvatar(res.url);
          }
        })
        .finally(() => {
          setIsUploading(false);
        });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    onSaveAvatar(selectedAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm glossy-card rounded-2xl p-6 text-white border border-white/10 shadow-2xl text-center">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-5">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Set Profile Photo</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Preview */}
        <div className="relative w-20 h-20 mx-auto mb-5">
          <img
            src={selectedAvatar}
            alt={userName}
            className="w-full h-full rounded-full border-2 border-white/30 object-cover bg-zinc-900 shadow-xl"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-white text-black hover:bg-zinc-200 transition-all shadow-md"
            title="Upload Photo"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 mb-4 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isUploading ? 'Uploading...' : 'Upload from Phone / PC'}</span>
        </button>

        {/* Presets Grid */}
        <div className="text-[11px] text-zinc-400 mb-2 text-left font-medium">Or choose avatar:</div>
        <div className="grid grid-cols-6 gap-2 mb-6">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedAvatar(preset)}
              className={`w-9 h-9 rounded-full overflow-hidden border transition-all ${
                selectedAvatar === preset ? 'border-white scale-110 shadow-lg' : 'border-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={preset} alt="preset" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

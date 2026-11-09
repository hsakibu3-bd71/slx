import React, { useState, useRef } from 'react';
import { Camera, Upload, Check, X, Sparkles, Wand2, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'standard' | 'gemini'>('standard');
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const geminiFileInputRef = useRef<HTMLInputElement | null>(null);

  // Gemini AI Photo Editor states
  const [geminiBaseImage, setGeminiBaseImage] = useState<string>(currentAvatar);
  const [geminiPrompt, setGeminiPrompt] = useState('Professional studio portrait, crisp bokeh lighting, sharp details, polished profile picture');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [geminiResultImage, setGeminiResultImage] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=SakibUser',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sophia',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Michael',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Emma',
    'https://api.dicebear.com/7.x/bottts/svg?seed=David',
  ];

  const aiStyles = [
    { label: '📸 Studio Portrait', prompt: 'Professional photography studio portrait, soft diffused lighting, sharp eye focus, shallow depth of field' },
    { label: '⚡ Cyberpunk Neon', prompt: 'Cyberpunk futuristic neon lights, glowing cyan and magenta backlight, dramatic night aesthetic' },
    { label: '🎨 Anime & Comic', prompt: 'Modern anime digital painting style, clean linework, vibrant expressive avatar art' },
    { label: '👔 Executive Headshot', prompt: 'High-end executive corporate headshot, dark tailored suit, sharp office studio lighting' },
    { label: '🌅 Golden Hour', prompt: 'Cinematic warm golden hour sunset lighting, soft outdoor glow, ultra-flattering natural shadows' },
    { label: '🕶️ Sunglasses & Style', prompt: 'Fashion magazine photoshoot with cool dark sunglasses, stylish modern urban outfit' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isForGemini = false) => {
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
            if (isForGemini) {
              setGeminiBaseImage(base64Data);
            } else {
              setSelectedAvatar(res.url);
            }
          }
        })
        .finally(() => {
          setIsUploading(false);
        });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiPhoto = async () => {
    if (!geminiBaseImage) {
      setGeminiError('Please choose or upload a photo to edit first.');
      return;
    }

    setIsGeneratingAi(true);
    setGeminiError(null);

    try {
      const res = await fetch('/api/gemini/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: geminiBaseImage,
          prompt: geminiPrompt,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await res.json();
      if (data.imageUrl) {
        setGeminiResultImage(data.imageUrl);
        setSelectedAvatar(data.imageUrl);
      } else {
        setGeminiError(data.error || 'Gemini could not generate edited image.');
      }
    } catch (err: any) {
      setGeminiError(err.message || 'AI generation failed. Please try again.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleConfirm = () => {
    onSaveAvatar(selectedAvatar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md glossy-card rounded-3xl p-5 sm:p-6 text-white border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">OGGy Photo Studio</h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
              OGGy AI
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Standard vs OGGy AI Magic */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-4 border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'standard' ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Presets & Upload
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gemini'
                ? 'bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>OGGy AI Magic</span>
          </button>
        </div>

        {/* TAB 1: STANDARD PRESETS & UPLOAD */}
        {activeTab === 'standard' && (
          <div className="space-y-4">
            {/* Current Preview */}
            <div className="relative w-24 h-24 mx-auto">
              <img
                src={selectedAvatar}
                alt={userName}
                className="w-full h-full rounded-full border-2 border-white/30 object-cover bg-zinc-900 shadow-xl"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-all shadow-md"
                title="Upload Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, false)}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Upload from Phone or PC'}</span>
            </button>

            {/* Presets Grid */}
            <div>
              <div className="text-[11px] text-zinc-400 mb-2 font-medium">Or choose quick avatar:</div>
              <div className="grid grid-cols-6 gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedAvatar(preset)}
                    className={`w-11 h-11 rounded-full overflow-hidden border transition-all ${
                      selectedAvatar === preset ? 'border-white scale-110 shadow-lg' : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={preset} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GEMINI AI PHOTO MAGIC EDITOR */}
        {activeTab === 'gemini' && (
          <div className="space-y-3.5">
            {/* Photos Comparison / Preview */}
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-zinc-400 mb-1">Base Photo</span>
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/20 bg-zinc-900 shadow-md">
                  <img src={geminiBaseImage} alt="base" className="w-full h-full object-cover" />
                  <button
                    onClick={() => geminiFileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                    title="Change base photo"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-zinc-500 mt-4" />

              <div className="flex flex-col items-center">
                <span className="text-[10px] text-amber-300 font-medium mb-1">OGGy AI Output</span>
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-500 bg-zinc-900 shadow-xl flex items-center justify-center">
                  {isGeneratingAi ? (
                    <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                  ) : geminiResultImage ? (
                    <img src={geminiResultImage} alt="OGGy Result" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-indigo-400 opacity-60" />
                  )}
                </div>
              </div>
            </div>

            <input
              ref={geminiFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, true)}
              className="hidden"
            />

            {geminiError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{geminiError}</span>
              </div>
            )}

            {/* AI Preset Chips */}
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1.5 font-medium">Choose OGGy Style:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {aiStyles.map((style) => (
                  <button
                    key={style.label}
                    onClick={() => setGeminiPrompt(style.prompt)}
                    className={`p-2 rounded-xl text-[11px] text-left font-medium transition-all border ${
                      geminiPrompt === style.prompt
                        ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt Input */}
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1 font-medium">OGGy Prompt:</label>
              <textarea
                value={geminiPrompt}
                onChange={(e) => setGeminiPrompt(e.target.value)}
                rows={2}
                placeholder="Describe how you want OGGy to edit this photo..."
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateAiPhoto}
              disabled={isGeneratingAi || !geminiPrompt.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>OGGy is crafting photo...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Transform with OGGy</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 mt-2 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Use Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

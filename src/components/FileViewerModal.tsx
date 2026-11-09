import React from 'react';
import { X, Download, FileText } from 'lucide-react';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  isImage: boolean;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileSize,
  isImage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden glossy-card border border-white/10 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-black/80 border-b border-white/10">
          <div className="flex items-center gap-2 truncate pr-4">
            <FileText className="w-5 h-5 text-white/80 shrink-0" />
            <span className="text-xs font-semibold truncate">{fileName}</span>
            {fileSize ? (
              <span className="text-[11px] text-zinc-400 font-mono">({Math.round(fileSize / 1024)} KB)</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Content */}
        <div className="p-4 flex items-center justify-center bg-black overflow-auto max-h-[75vh]">
          {isImage ? (
            <img
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-lg"
            />
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <FileText className="w-16 h-16 text-zinc-500 mb-4" />
              <p className="text-sm font-medium text-white mb-2">{fileName}</p>
              <p className="text-xs text-zinc-400 mb-6 max-w-sm">
                Click download to view or save this file.
              </p>
              <a
                href={fileUrl}
                download={fileName}
                className="px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs flex items-center gap-2 shadow-lg hover:bg-zinc-200 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

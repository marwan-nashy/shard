import React from "react";
import { FolderOpen, Plus, Folder, Clock, X, ArrowRight } from "lucide-react";

interface VaultSelectorModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canClose?: boolean;
  onOpenExisting: () => void;
  onCreateDefault: () => void;
  onSelectRecent: (path: string) => void;
  recentVaults: string[];
  defaultPath: string;
}

export const VaultSelectorModal: React.FC<VaultSelectorModalProps> = ({
  isOpen,
  onClose,
  canClose = true,
  onOpenExisting,
  onCreateDefault,
  onSelectRecent,
  recentVaults,
  defaultPath,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6 select-none"
      onClick={() => canClose && onClose && onClose()}
    >
      <div
        className="w-full max-w-xl bg-bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Shard Branding */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-bg-secondary/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-6 h-6 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                <polygon points="12,2 19,8 17,17 12,22 7,17 5,8" fill="#7b6cd9" stroke="#ffffff" strokeWidth="0.8" />
                <polygon points="12,2 12,22 17,17 19,8" fill="#5848c2" opacity="0.8" />
                <line x1="12" y1="2" x2="12" y2="22" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Welcome to Shard</h2>
              <p className="text-xs text-text-muted">Select or create a notes vault to get started</p>
            </div>
          </div>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Cards */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Quick Start: Create Shard Vault in Documents */}
            <div
              onClick={onCreateDefault}
              className="group p-4 rounded-xl bg-bg-secondary/70 hover:bg-bg-hover border border-border-subtle hover:border-accent-purple/80 cursor-pointer transition-all flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent-purple/15 text-accent-purple flex items-center justify-center group-hover:bg-accent-purple group-hover:text-white transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-primary">Quick Start (Documents)</h3>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Automatically initializes a new notes vault at <span className="font-mono text-accent-purple text-[10px] break-all">{defaultPath}</span>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-accent-purple font-medium mt-3 group-hover:translate-x-1 transition-transform">
                <span>Create & Open</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* 2. Open Existing Folder as Vault */}
            <div
              onClick={onOpenExisting}
              className="group p-4 rounded-xl bg-bg-secondary/70 hover:bg-bg-hover border border-border-subtle hover:border-accent-blue/80 cursor-pointer transition-all flex flex-col justify-between shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-lg bg-accent-blue/15 text-accent-blue flex items-center justify-center group-hover:bg-accent-blue group-hover:text-white transition-colors">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-text-primary">Open Existing Folder</h3>
                  <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Select any folder on your computer with existing Markdown notes to open as a vault.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-accent-blue font-medium mt-3 group-hover:translate-x-1 transition-transform">
                <span>Browse Folder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Recent Vaults Section */}
          {recentVaults.length > 0 && (
            <div className="pt-3 border-t border-border-subtle/60">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-faint uppercase tracking-wider mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>Recent Vaults</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {recentVaults.map((vault) => (
                  <div
                    key={vault}
                    onClick={() => onSelectRecent(vault)}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-bg-secondary/50 hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border-subtle transition-all"
                  >
                    <Folder className="w-4 h-4 text-accent-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">
                        {vault.split(/[\\/]/).pop()}
                      </div>
                      <div className="text-[10px] text-text-faint truncate font-mono">
                        {vault}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

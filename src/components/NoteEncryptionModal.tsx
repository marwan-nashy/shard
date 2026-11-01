import React, { useState } from "react";
import { Lock, Key, X, AlertTriangle, ShieldCheck } from "lucide-react";
import { encryptNote } from "../utils/noteEncryption";

interface NoteEncryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentContent: string;
  onEncrypted: (cipherText: string) => void;
}

export const NoteEncryptionModal: React.FC<NoteEncryptionModalProps> = ({
  isOpen,
  onClose,
  currentContent,
  onEncrypted,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passphrase || passphrase.length < 4) {
      setError("Passphrase must be at least 4 characters long.");
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError("Passphrases do not match.");
      return;
    }

    try {
      setLoading(true);
      const cipherText = await encryptNote(currentContent, passphrase);
      onEncrypted(cipherText);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to encrypt note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-card border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-bg-secondary/40 select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent-purple/15 text-accent-purple">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-text-primary">Encrypt Note (AES-256)</h2>
              <p className="text-[10px] text-text-muted">Client-side zero-knowledge encryption</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleEncrypt} className="p-5 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-text-secondary text-[11px] leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-semibold">Important:</strong> Shard does not store your passphrase anywhere. If you forget your passphrase, this note cannot be recovered.
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
              <Key className="w-3 h-3 text-accent-purple" />
              <span>Passphrase</span>
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter strong passphrase..."
              autoFocus
              className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs text-text-primary outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary">Confirm Passphrase</label>
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Re-enter passphrase..."
              className="w-full px-3 py-2 bg-bg-primary border border-border-subtle rounded-lg text-xs text-text-primary outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !passphrase}
              className="px-4 py-1.5 rounded-lg bg-accent-purple hover:bg-accent-purple-hover text-white font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{loading ? "Encrypting..." : "Lock & Encrypt"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

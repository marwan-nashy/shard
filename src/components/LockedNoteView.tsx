import React, { useState } from "react";
import { Lock, Unlock, AlertCircle, Shield } from "lucide-react";
import { decryptNote } from "../utils/noteEncryption";

interface LockedNoteViewProps {
  encryptedContent: string;
  onUnlocked: (plainText: string, passphrase: string) => void;
  noteTitle?: string;
}

export const LockedNoteView: React.FC<LockedNoteViewProps> = ({
  encryptedContent,
  onUnlocked,
  noteTitle,
}) => {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;

    try {
      setLoading(true);
      setError(null);
      const plain = await decryptNote(encryptedContent, passphrase);
      onUnlocked(plain, passphrase);
    } catch (err: any) {
      setError(err?.message || "Incorrect passphrase or corrupted note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-bg-primary/95 p-6 select-none">
      <div className="w-full max-w-sm bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center text-accent-purple shadow-inner">
          <Lock className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-text-primary">
            {noteTitle ? `${noteTitle} (Locked)` : "Protected Note"}
          </h2>
          <p className="text-xs text-text-muted">
            This note is encrypted with AES-256. Enter your passphrase to view and edit its contents.
          </p>
        </div>

        {error && (
          <div className="w-full p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="w-full space-y-3">
          <div className="relative">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter note passphrase..."
              autoFocus
              className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-subtle rounded-xl text-xs text-text-primary placeholder:text-text-faint outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !passphrase}
            className="w-full py-2.5 rounded-xl bg-accent-purple hover:bg-accent-purple-hover text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            <Unlock className="w-4 h-4" />
            <span>{loading ? "Decrypting..." : "Unlock Note"}</span>
          </button>
        </form>

        <div className="flex items-center gap-1.5 text-[10px] text-text-faint pt-2 border-t border-border-subtle/50 w-full justify-center">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>Zero-Knowledge • AES-GCM 256-bit</span>
        </div>
      </div>
    </div>
  );
};

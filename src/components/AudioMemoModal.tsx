import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Play, Pause, Save, X, Radio } from "lucide-react";
import { AudioRecorderService } from "../utils/audioRecorder";
import { saveAttachment } from "../utils/attachmentHandler";
import { Language } from "../i18n";

interface AudioMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultPath: string | null;
  onInsertAudio: (markdownLink: string) => void;
  language?: Language;
}

export const AudioMemoModal: React.FC<AudioMemoModalProps> = ({
  isOpen,
  onClose,
  vaultPath,
  onInsertAudio,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const recorderRef = useRef<AudioRecorderService | null>(null);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecordedBlob(null);
      setAudioUrl(null);
      setIsRecording(false);
      setElapsedSeconds(0);
    } else {
      if (recorderRef.current) recorderRef.current.cancel();
      clearInterval(timerRef.current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const rec = new AudioRecorderService();
      await rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      setElapsedSeconds(0);
      setRecordedBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(`Microphone access error: ${err?.message || "Permission denied"}`);
    }
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    if (!recorderRef.current) return;
    try {
      const blob = await recorderRef.current.stop();
      setIsRecording(false);
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  const handleSaveAndInsert = async () => {
    if (!recordedBlob) return;
    setIsSaving(true);
    try {
      const file = new File([recordedBlob], "audio-recording.webm", {
        type: "audio/webm",
      });
      const res = await saveAttachment(file, vaultPath);
      onInsertAudio(`\n${res.markdownLink}\n`);
      onClose();
    } catch (err) {
      alert(`Failed to save recording: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-2 border-b border-border-subtle select-none">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-accent-red animate-pulse" />
            <span className="font-semibold text-xs text-text-primary">Voice Memo Recorder</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Mic Button / Timer */}
        <div className="py-4 flex flex-col items-center space-y-3">
          <div className="relative">
            {isRecording && (
              <span className="absolute -inset-3 rounded-full bg-red-500/20 animate-ping" />
            )}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                isRecording
                  ? "bg-red-500 text-white hover:bg-red-600 ring-4 ring-red-500/30"
                  : "bg-accent-purple text-white hover:bg-accent-purple-hover ring-4 ring-accent-purple/20"
              }`}
            >
              {isRecording ? <Square className="w-8 h-8 fill-white" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <div className="font-mono text-2xl font-bold text-text-primary tracking-wider">
            {formatTime(elapsedSeconds)}
          </div>
          <div className="text-[11px] text-text-faint">
            {isRecording ? "Recording in progress... Click stop when done" : "Click mic to start recording"}
          </div>
        </div>

        {/* Audio Player Preview */}
        {audioUrl && !isRecording && (
          <div className="w-full p-3 rounded-xl bg-bg-secondary border border-border-subtle flex items-center justify-between gap-3">
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button
              onClick={() => {
                const player = audioPlayerRef.current;
                if (!player) return;
                if (isPlaying) {
                  player.pause();
                  setIsPlaying(false);
                } else {
                  player.play();
                  setIsPlaying(true);
                }
              }}
              className="p-2 rounded-full bg-bg-hover text-accent-purple hover:bg-bg-card transition-colors shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-accent-purple" />}
            </button>
            <div className="text-left flex-1 min-w-0 text-xs">
              <div className="font-medium text-text-primary truncate">Voice Memo Preview</div>
              <div className="text-[10px] text-text-faint font-mono">{formatTime(elapsedSeconds)} recorded</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          {recordedBlob && !isRecording && (
            <button
              onClick={handleSaveAndInsert}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-accent-purple hover:bg-accent-purple-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save & Insert"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

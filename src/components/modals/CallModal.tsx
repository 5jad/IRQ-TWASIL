import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, Signal } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

export interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isVideoCall?: boolean;
}

export function CallModal({ isOpen, onClose, user, isVideoCall = false }: CallModalProps) {
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaStatus, setMediaStatus] = useState<'ready' | 'unavailable'>('ready');

  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsVideoEnabled(isVideoCall);
  }, [isVideoCall, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCallStatus('connecting');
      setDuration(0);
      return;
    }

    const timeout = setTimeout(() => {
      setCallStatus('connected');
    }, 1500);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    const stopStream = () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (selfVideoRef.current) {
        selfVideoRef.current.srcObject = null;
      }
    };

    if (!isOpen) {
      stopStream();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMediaStatus('unavailable');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: isVideoEnabled ? { facingMode } : false,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        for (const track of stream.getAudioTracks()) {
          track.enabled = !isMuted;
        }
        if (selfVideoRef.current && isVideoEnabled) {
          selfVideoRef.current.srcObject = stream;
        }
        setMediaStatus('ready');
      })
      .catch(() => {
        if (active) setMediaStatus('unavailable');
      });

    return () => {
      active = false;
      stopStream();
    };
  }, [isOpen, isVideoEnabled, facingMode]);

  useEffect(() => {
    if (!streamRef.current) return;
    for (const track of streamRef.current.getAudioTracks()) {
      track.enabled = !isMuted;
    }
  }, [isMuted]);

  // Duration timer
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`مكالمة مع ${user.displayName}`}
      testId="tw-call-modal"
      className="p-0 bg-slate-950"
      overlayClassName="bg-slate-950"
      contentClassName="h-full flex flex-col justify-between p-6 max-w-lg"
    >
      <div className="flex flex-col justify-between h-full select-none">
        {/* Top Header */}
        <div className="flex items-center justify-between text-white z-10">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300">
              {mediaStatus === 'unavailable' ? 'تعذّر الوصول إلى الميكروفون أو الكاميرا' : 'جودة الاتصال ممتازة'}
            </span>
          </div>

          <span className="text-xs font-mono font-bold bg-white/10 px-2.5 py-1 rounded-full text-slate-200">
            {callStatus === 'connecting' ? 'جارٍ الاتصال...' : formatTimer(duration)}
          </span>
        </div>

        {/* Middle Remote User Tile */}
        <div className="flex flex-col items-center justify-center gap-4 my-auto z-10">
          <Avatar src={user.avatarUrl} name={user.displayName} size={120} className="ring-4 ring-white/20" />
          <h2 className="text-xl font-bold text-white">{user.displayName}</h2>
          <span className="text-xs text-slate-400">
            {callStatus === 'connecting' ? 'يرن هاتف المستخدم...' : 'مكالمة نشطة ومحمية أثناء النقل'}
          </span>
        </div>

        {/* Draggable Self View Tile (for video calls) */}
        {isVideoEnabled && (
          <div className="absolute top-16 end-6 w-28 h-40 rounded-2xl bg-slate-800 border-2 border-white/30 overflow-hidden shadow-2xl flex items-center justify-center z-20">
            {mediaStatus === 'ready' ? (
              <video
                ref={selfVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[11px] text-slate-300 text-center px-2">الكاميرا غير متاحة</span>
            )}
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="flex items-center justify-center gap-5 z-10 pb-6">
          {/* Mute button */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-[var(--danger)] text-[var(--danger-fg)]' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
            aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Video button */}
          <button
            type="button"
            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              !isVideoEnabled ? 'bg-white/20 text-white' : 'bg-white text-slate-900'
            }`}
            aria-label={isVideoEnabled ? 'إيقاف الفيديو' : 'تشغيل الفيديو'}
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>

          {/* Camera Flip */}
          {isVideoEnabled && (
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
              className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
              aria-label="تبديل الكاميرا"
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          )}

          {/* End Call Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-[var(--danger)] text-[var(--danger-fg)] flex items-center justify-center shadow-lg active:scale-95"
            aria-label="إنهاء المكالمة"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </Modal>
  );
}

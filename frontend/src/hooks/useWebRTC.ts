import { useEffect, useRef, useState, useCallback } from "react";
import * as api from "@/lib/api";

export interface TranscriptLine {
  speaker: string;
  text: string;
  translated_text: string;
  language: string;
  timestamp_sec: number;
  was_translated: boolean;
}
export interface ConflictAlert {
  conflict_detected: boolean;
  type: string;
  severity: string;
  description: string;
}
export interface AttentionData {
  score: number;
  status: "focused" | "distracted" | "confused";
}
interface Options {
  meetingId: string;
  userName: string;
  camOn: boolean;
  micOn: boolean;
  camId?: string;
  micId?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL;
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const WHISPER_CHUNK_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function isRedundant(newText: string, lastText: string): boolean {
  const a = newText.toLowerCase().trim().replace(/[.,!?]/g, "");
  const b = lastText.toLowerCase().trim().replace(/[.,!?]/g, "");
  if (!a || !b) return false;
  return b.includes(a) || a === b;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWebRTC({
  meetingId,
  userName,
  camOn: initCam,
  micOn: initMic,
  camId,
  micId,
}: Options) {
  const localVideoRef   = useRef<HTMLVideoElement>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const audioStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── WebRTC / signaling refs ──────────────────────────────────────────────
  const wsRef             = useRef<WebSocket | null>(null);
  const pcRef             = useRef<RTCPeerConnection | null>(null);
  const myRoleRef         = useRef<"host" | "participant" | null>(null);
  const userNameRef       = useRef(userName);

  // FIX 1 ─ Connection guard: prevents duplicate WebSocket connections when
  // React re-renders (StrictMode double-invocation, parent state changes, etc.)
  // Without this flag, every render that triggers the effect will open a new
  // WS connection, confusing the server about who is host vs participant.
  const isConnectedRef    = useRef(false);

  const msgQueueRef       = useRef<any[]>([]);
  const signalingReadyRef = useRef(false);

  // ── Other refs ───────────────────────────────────────────────────────────
  const coachIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const conflictIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef        = useRef<number>(Date.now());
  const recordingRef        = useRef<MediaRecorder | null>(null);
  const recordChunks        = useRef<Blob[]>([]);
  const conflictBuf         = useRef<string[]>([]);
  const whisperActiveRef    = useRef(false);
  const lastSentTextRef     = useRef<string>("");

  const [remoteStreams,  setRemoteStreams]  = useState<Map<string, MediaStream>>(new Map());
  const [transcript,    setTranscript]     = useState<TranscriptLine[]>([]);
  const [liveText,      setLiveText]       = useState("");
  const [insights,      setInsights]       = useState({ actions: [] as string[], ideas: [] as string[], coach: [] as string[] });
  const [conflictAlert, setConflictAlert]  = useState<ConflictAlert | null>(null);
  const [attention,     setAttention]      = useState<AttentionData>({ score: 100, status: "focused" });
  const [isMuted,       setIsMuted]        = useState(!initMic);
  const [isCamOff,      setIsCamOff]       = useState(!initCam);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording,   setIsRecording]    = useState(false);
  const [isTranscribing] = useState(false);
  const [elapsed,       setElapsed]        = useState(0);
  const [peerName,      setPeerName]       = useState<string>("Participant");

  // Keep userName ref in sync so async callbacks always read the latest value
  useEffect(() => { userNameRef.current = userName; }, [userName]);

  // ── WebSocket send helper ─────────────────────────────────────────────────
  const wsSend = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── Create RTCPeerConnection ──────────────────────────────────────────────
  const createPC = useCallback((stream: MediaStream): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) wsSend({ type: "ice", candidate: candidate.toJSON() });
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE state:", pc.iceConnectionState);
    };

    pc.ontrack = ({ streams }) => {
      const remoteStream = streams[0];
      if (!remoteStream) return;
      console.log("✅ Remote track received!");
      setRemoteStreams(new Map([["peer", remoteStream]]));
    };

    return pc;
  }, [wsSend]);

  // ── Handle one signaling message ─────────────────────────────────────────
  const handleSignalMsg = useCallback(async (msg: any) => {
    const pc = pcRef.current;

    switch (msg.type) {

      case "role":
        myRoleRef.current = msg.role;
        console.log("🎭 My role:", msg.role);
        // Send join only once, immediately after role assignment
        wsSend({ type: "join", userId: userNameRef.current, room: meetingId });
        break;

      case "peer_joined":
        setPeerName(msg.userId || "Participant");
        console.log("👥 Peer joined:", msg.userId);
        break;

      case "peer_left":
        console.log("👋 Peer left");
        setRemoteStreams(new Map());
        setPeerName("Participant");
        // FIX 2 ─ Fully reset the RTCPeerConnection on peer departure.
        // Previously, the old PC was closed but pcRef was not nulled before
        // createPC was called, which could leave dangling event listeners.
        // Now we null the ref first, then rebuild with a fresh PC.
        pcRef.current?.close();
        pcRef.current = null;
        if (localStreamRef.current) {
          pcRef.current = createPC(localStreamRef.current);
        }
        break;

      case "make_offer":
        if (!pc || myRoleRef.current !== "host") break;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          wsSend({ type: "offer", sdp: pc.localDescription });
          console.log("📤 Offer sent");
        } catch (e) {
          console.error("Offer error:", e);
        }
        break;

      case "offer":
        if (!pc) break;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsSend({ type: "answer", sdp: pc.localDescription });
        console.log("📤 Answer sent");
        break;

      case "answer":
        if (!pc) break;
        if (pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          console.log("✅ Answer accepted");
        }
        break;

      case "ice":
        if (!pc || !msg.candidate) break;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (e) {
          console.warn("ICE error:", e);
        }
        break;

      case "error":
        console.error("❌ Signaling error:", msg.message);
        break;
    }
  }, [wsSend, meetingId, createPC]);

  // ── Connect WebSocket signaling ───────────────────────────────────────────
  const connectSignaling = useCallback((stream: MediaStream) => {
    // FIX 3 ─ Guard against duplicate connections. React StrictMode mounts
    // components twice in development, and parent re-renders can retrigger
    // effects. Without this guard, each render opens a new WS connection.
    // The server sees the original host disconnect and re-join as a new user,
    // then incorrectly promotes the second user to host.
    if (isConnectedRef.current) {
      console.warn("⚠️ Signaling already connected — skipping duplicate connection.");
      return;
    }
    isConnectedRef.current = true;

    // FIX 4 ─ Always tear down any pre-existing PC before creating a new one.
    // Stale PCs from a previous effect run can hold open tracks and ICE agents,
    // causing ghost connections that the server still considers active.
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pcRef.current = createPC(stream);

    // FIX 5 ─ Reset signaling state so the message queue starts fresh for
    // this connection attempt. Without this, queued messages from a prior
    // (failed) connection could be replayed against a brand-new WS session.
    signalingReadyRef.current = false;
    msgQueueRef.current = [];

    const ws = new WebSocket(`${WS_URL}/ws/${meetingId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🔌 Signaling WebSocket connected");
      signalingReadyRef.current = true;
      // Flush messages that arrived before the socket finished opening
      const queue = msgQueueRef.current.splice(0);
      queue.forEach((msg) => handleSignalMsg(msg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("📨 Signal:", msg.type);
        if (!signalingReadyRef.current) {
          msgQueueRef.current.push(msg);
        } else {
          handleSignalMsg(msg);
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.onclose = (e) => {
      console.log("🔌 Signaling closed:", e.code, e.reason);
      // FIX 6 ─ Reset the connection guard when the socket closes so a
      // deliberate reconnect (e.g. network recovery) is allowed to proceed.
      // Without this, isConnectedRef stays true and every reconnect attempt
      // is silently dropped, leaving the user unable to re-enter the room.
      isConnectedRef.current = false;
    };

    ws.onerror = (e) => {
      console.error("🔌 Signaling error:", e);
    };
  }, [meetingId, createPC, handleSignalMsg]);

  // ── Whisper: send audio blob ──────────────────────────────────────────────
  const sendToWhisper = useCallback(async (blob: Blob) => {
    if (blob.size < 6000) return;

    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("user", userNameRef.current);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/transcription/${meetingId}/whisper`,
        { method: "POST", body: form, credentials: "include" }
      );
      if (!res.ok) return;

      const data = await res.json();
      if (!data.text || data.text.trim().length < 3) return;

      const cleanText = data.text.trim();
      if (isRedundant(cleanText, lastSentTextRef.current)) return;
      lastSentTextRef.current = cleanText;

      const ts = (Date.now() - startTimeRef.current) / 1000;

      setTranscript((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (
          last &&
          last.speaker === userNameRef.current &&
          ts - last.timestamp_sec < 12 &&
          !last.text.toLowerCase().includes(cleanText.toLowerCase().slice(0, 10))
        ) {
          updated[updated.length - 1] = {
            ...last,
            text: last.text + " " + cleanText,
            translated_text: last.translated_text + " " + cleanText,
          };
        } else {
          updated.push({
            speaker:         userNameRef.current,
            text:            data.original_text || cleanText,
            translated_text: data.text,
            language:        data.language || "en",
            timestamp_sec:   ts,
            was_translated:  data.was_translated || false,
          });
        }
        conflictBuf.current = updated.slice(-10).map((l) => `${l.speaker}: ${l.text}`);
        return updated;
      });

      setLiveText(cleanText);
      setTimeout(() => setLiveText(""), 4000);
    } catch (err) {
      console.error("Whisper fetch error:", err);
    }
  }, [meetingId]);

  // ── Whisper recording loop ────────────────────────────────────────────────
  const startWhisperLoop = useCallback((audioStream: MediaStream) => {
    audioStreamRef.current = audioStream;
    whisperActiveRef.current = true;

    const runCycle = () => {
      if (!whisperActiveRef.current || !audioStreamRef.current) return;

      const mimeType = getMimeType();
      const chunks: Blob[] = [];
      let recorder: MediaRecorder;

      try {
        recorder = mimeType
          ? new MediaRecorder(audioStream, { mimeType })
          : new MediaRecorder(audioStream);
      } catch (e) {
        console.error("MediaRecorder init failed:", e);
        if (whisperActiveRef.current) setTimeout(runCycle, 2000);
        return;
      }

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          await sendToWhisper(blob);
        }
        if (whisperActiveRef.current) runCycle();
      };

      recorder.onerror = () => {
        if (whisperActiveRef.current) setTimeout(runCycle, 1000);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, WHISPER_CHUNK_MS);
    };

    runCycle();
  }, [sendToWhisper]);

  const stopWhisperLoop = useCallback(() => {
    whisperActiveRef.current = false;
    audioStreamRef.current = null;
  }, []);

  // ── Camera / mic ──────────────────────────────────────────────────────────
  const startMedia = useCallback(async (): Promise<MediaStream | null> => {
    const tryGet = async (c: MediaStreamConstraints) => {
      try { return await navigator.mediaDevices.getUserMedia(c); } catch { return null; }
    };

    const stream =
      (await tryGet({
        video: initCam ? { deviceId: camId ? { exact: camId } : undefined } : false,
        audio: initMic ? { deviceId: micId ? { exact: micId } : undefined } : true,
      })) ||
      (await tryGet({ audio: true, video: false })) ||
      (await tryGet({ audio: true, video: true }));

    if (!stream) {
      alert("Microphone not found or permission denied ❌");
      return null;
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getAudioTracks().forEach((t) => { t.enabled = initMic; });
    stream.getVideoTracks().forEach((t) => { t.enabled = initCam; });

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      startWhisperLoop(new MediaStream(audioTracks));
      console.log("✅ Whisper loop started");
    }

    return stream;
  }, [initCam, initMic, camId, micId, startWhisperLoop]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  // ── AI Coach ──────────────────────────────────────────────────────────────
  const startCoach = useCallback(() => {
    coachIntervalRef.current = setInterval(async () => {
      try {
        const r = await api.getCoachFeedback(meetingId);
        if (r?.feedback?.length) setInsights((p) => ({ ...p, coach: r.feedback }));
      } catch {}
    }, 60_000);
  }, [meetingId]);

  // ── Conflict detection ────────────────────────────────────────────────────
  const startConflictDetection = useCallback(() => {
    // FIX 7 ─ Store the interval in a ref instead of relying on the caller to
    // capture the return value. The original code returned the interval ID and
    // expected the useEffect to hold it in a local variable, but this pattern
    // is fragile: if the effect re-runs before cleanup, the old ID is lost and
    // the previous interval keeps firing — double-polling the conflict endpoint.
    conflictIntervalRef.current = setInterval(async () => {
      if (conflictBuf.current.length < 2) return;
      try {
        const r = await api.checkConflict(meetingId, conflictBuf.current.join("\n"));
        if (r?.conflict_detected) {
          setConflictAlert(r);
          setTimeout(() => setConflictAlert(null), 10_000);
        }
      } catch {}
    }, 30_000);
  }, [meetingId]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((m) => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsCamOff((c) => !c);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      if (localVideoRef.current && localStreamRef.current)
        localVideoRef.current.srcObject = localStreamRef.current;
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screen;
        setIsScreenSharing(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        screen.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localVideoRef.current && localStreamRef.current)
            localVideoRef.current.srcObject = localStreamRef.current;
        };
      } catch (e) { console.error("Screen share:", e); }
    }
  }, [isScreenSharing]);

  const toggleRecording = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    if (isRecording) {
      recordingRef.current?.stop();
      setIsRecording(false);
    } else {
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9" : "video/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recordChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(recordChunks.current, { type: "video/webm" });
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        try {
          await fetch(`${import.meta.env.VITE_API_URL}/api/recordings/${meetingId}/upload`, {
            method: "POST", credentials: "include", body: form,
          });
        } catch {}
      };
      rec.start(1000);
      recordingRef.current = rec;
      setIsRecording(true);
    }
  }, [isRecording, meetingId]);

  const updateAttention = useCallback(async (score: number) => {
    const status: AttentionData["status"] =
      score >= 70 ? "focused" : score >= 40 ? "confused" : "distracted";
    setAttention({ score, status });
    try { await api.sendAttention(meetingId, userName, score); } catch {}
  }, [meetingId, userName]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopWhisperLoop();

    // FIX 8 ─ Close and null the WebSocket before closing the PC. Closing the
    // PC first can trigger oniceconnectionstatechange callbacks that attempt
    // wsSend, hitting a closing/closed socket and generating spurious errors.
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent the onclose handler from resetting
                                    // isConnectedRef prematurely during intentional teardown
      wsRef.current.close();
      wsRef.current = null;
    }

    pcRef.current?.close();
    pcRef.current = null;

    // FIX 9 ─ Reset the connection guard on full cleanup so the hook can
    // re-initialize cleanly if the component remounts (e.g. HMR, navigation).
    isConnectedRef.current = false;
    signalingReadyRef.current = false;
    msgQueueRef.current = [];

    if (coachIntervalRef.current)    clearInterval(coachIntervalRef.current);
    if (elapsedRef.current)          clearInterval(elapsedRef.current);
    if (conflictIntervalRef.current) clearInterval(conflictIntervalRef.current);

    try {
      if (recordingRef.current?.state !== "inactive") recordingRef.current?.stop();
    } catch {}

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current  = null;
    screenStreamRef.current = null;
  }, [stopWhisperLoop]);

  // ── Mount ─────────────────────────────────────────────────────────────────
  // FIX 10 ─ The original effect had an empty dependency array with an eslint
  // disable comment, which silently captured stale closures for meetingId and
  // userName. We now use a stable ref for userName (userNameRef) and keep
  // meetingId — which should never change mid-session — as the single dep.
  // If meetingId somehow changes (e.g. route param update), the effect will
  // cleanly tear down and re-initialize rather than operating on a stale room.
  useEffect(() => {
    (async () => {
      const stream = await startMedia();
      if (!stream) return;
      connectSignaling(stream);
      startTimer();
      startCoach();
      startConflictDetection();
    })();

    return () => { cleanup(); };
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    localVideoRef, remoteStreams, transcript, liveText,
    insights, conflictAlert, attention, peerName,
    isMuted, isCamOff, isScreenSharing, isRecording, isTranscribing, elapsed,
    toggleMic, toggleCamera, toggleScreenShare, toggleRecording, updateAttention,
  };
}
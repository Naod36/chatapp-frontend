import { useState, useRef, useEffect } from "react";

export default function VoicePlayer({ src, isSelf, themeColors }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [peaks, setPeaks] = useState(new Array(28).fill(20)); // default 20% height until loaded
    const audioRef = useRef(null);

    // Extract real audio peaks using Web Audio API
    useEffect(() => {
        if (!src) return;

        let isCancelled = false;
        fetch(src)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                return audioCtx.decodeAudioData(buffer);
            })
            .then(audioBuffer => {
                if (isCancelled) return;
                const rawData = audioBuffer.getChannelData(0); // Left channel audio samples
                const sampleCount = 28; // 28 waveform bars
                const blockSize = Math.floor(rawData.length / sampleCount);
                const extractedPeaks = [];

                for (let i = 0; i < sampleCount; i++) {
                    const start = i * blockSize;
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(rawData[start + j] || 0);
                    }
                    const avg = sum / blockSize;
                    // Scale peak height between 15% (silence/dots) and 100% (loud voice)
                    const heightPercent = Math.min(100, Math.max(15, Math.floor(avg * 400)));
                    extractedPeaks.push(heightPercent);
                }
                setPeaks(extractedPeaks);
            })
            .catch(() => {
                // Fallback to subtle default pattern if audio fails to decode
                if (!isCancelled) {
                    setPeaks([30, 50, 25, 75, 40, 85, 60, 35, 70, 50, 90, 65, 30, 80, 45, 30, 70, 50, 30, 60, 80, 40, 25, 55, 30, 45, 25, 35]);
                }
            });

        return () => { isCancelled = true; };
    }, [src]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoadedMetadata = () => {
            if (audio.duration && !isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("ended", onEnded);
        };
    }, [src]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play();
            setIsPlaying(true);
        }
    };

    const handleSeek = (index) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const newTime = (index / peaks.length) * duration;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (secs) => {
        if (!secs || isNaN(secs)) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const progressRatio = duration ? currentTime / duration : 0;
    const activeBarsCount = Math.floor(progressRatio * peaks.length);

    const btnBg = isSelf ? "rgba(255, 255, 255, 0.2)" : themeColors.accent;
    const btnColor = "#ffffff";
    const barActiveColor = isSelf ? "#ffffff" : themeColors.accent;
    const barInactiveColor = isSelf ? "rgba(255, 255, 255, 0.35)" : "rgba(120, 120, 120, 0.3)";
    const textColor = isSelf ? themeColors.bubbleSentText : themeColors.bubbleRecvText;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 230, padding: "4px 2px" }}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play / Pause Circular Button */}
            <button
                type="button"
                onClick={togglePlay}
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    border: "none",
                    background: btnBg,
                    color: btnColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "transform 0.15s ease, background 0.15s ease",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)"
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
                {isPlaying ? (
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </button>

            {/* Waveform Graphic + Timer */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 2, height: 24, cursor: "pointer" }}>
                    {peaks.map((h, i) => {
                        const isActive = i <= activeBarsCount;
                        return (
                            <div
                                key={i}
                                onClick={() => handleSeek(i)}
                                style={{
                                    flex: 1,
                                    height: `${h}%`,
                                    minHeight: 3,
                                    maxHeight: 22,
                                    borderRadius: 2,
                                    background: isActive ? barActiveColor : barInactiveColor,
                                    transition: "background 0.15s ease, height 0.15s ease"
                                }}
                            />
                        );
                    })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: textColor, opacity: 0.85, fontWeight: "500" }}>
                    <span>{formatTime(currentTime || duration)}</span>
                    <span style={{ fontSize: 10.5, opacity: 0.7 }}>Voice Message</span>
                </div>
            </div>
        </div>
    );
}

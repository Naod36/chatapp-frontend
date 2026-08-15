import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGoogleLogin } from "@react-oauth/google";
import { authService } from "../services/auth";

/**
 * AuthScreen
 * -----------
 * Fully matches the visual reference image:
 *  - No clipping boundary (halftone container sits over the card background smoothly)
 *  - Fully capsule shaped inputs/buttons (border-radius: 9999px)
 *  - Custom slanted double parallelogram logo
 *  - Canvas-based organic diagonal/halftone dot patterns matching the screenshot curves
 *  - Dark / light modes
 */

const THEME = {
    light: {
        pageBg: "radial-gradient(circle at 50% 50%, #f4f7fb 0%, #e2e8f0 100%)",
        cardBg: "rgba(255, 255, 255, 0.88)",
        cardBorder: "1.5px solid rgba(3, 52, 110, 0.12)",
        cardShadow: "0 25px 65px rgba(2, 21, 38, 0.08), 0 5px 15px rgba(2, 21, 38, 0.04)",
        text: "#021526",
        textMuted: "#64748b",
        inputBorder: "rgba(3, 52, 110, 0.15)",
        dotColor: "3,52,110", // #03346E in RGB
        buttonBg: "#03346E",
        buttonText: "#ffffff",
        accent: "#6EACDA",
    },
    dark: {
        pageBg: "radial-gradient(circle at 50% 50%, #031c33 0%, #021526 100%)",
        cardBg: "rgba(2, 21, 38, 0.85)",
        cardBorder: "1.5px solid rgba(110, 172, 218, 0.2)",
        cardShadow: "0 25px 65px rgba(0, 0, 0, 0.6)",
        text: "#e2e8f0",
        textMuted: "#94a3b8",
        inputBorder: "rgba(110, 172, 218, 0.2)",
        dotColor: "110,172,218", // #6EACDA in RGB
        buttonBg: "#03346E",
        buttonText: "#ffffff",
        accent: "#6EACDA",
    },
};

const SunIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" fill="none" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const MoonIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" />
    </svg>
);

// Inline colored Google G logo
const GoogleIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.08H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.92l2.85-2.22c-.87-2.6-2.87-4.6-6.19-4.6z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.08l3.66 2.84c.87-2.6 3.3-4.54 6.16-4.54z" fill="#EA4335" />
    </svg>
);

export default function AuthScreen({ onAuthSuccess }) {
    const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
    const [theme, setTheme] = useState("light");

    // Inputs & Submission State
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Google OAuth Handler
    const handleGoogleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setLoading(true);
            setError(null);
            try {
                const credential = tokenResponse.access_token || tokenResponse.credential;
                const authData = await authService.googleLogin(credential);
                onAuthSuccess(authData);
            } catch (err) {
                setError(err.message || "Google Sign In failed");
            } finally {
                setLoading(false);
            }
        },
        onError: () => setError("Google Sign In was cancelled or failed"),
    });

    const rootRef = useRef(null);
    const cardRef = useRef(null);
    const formWrapRef = useRef(null);
    const canvasRef = useRef(null);
    const panelWrapRef = useRef(null);
    const bgCanvasRef = useRef(null);

    const mouse = useRef({ x: -9999, y: -9999, active: false });
    const pageMouse = useRef({ x: -9999, y: -9999 });
    const ripples = useRef([]);
    const rafId = useRef(null);
    const t = THEME[theme];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let data;
            if (mode === "signin") {
                data = await authService.login(email, password);
            } else {
                data = await authService.signup(username, email, password);
            }

            if (onAuthSuccess) {
                onAuthSuccess({
                    userId: data.user_id,
                    username: data.username,
                    token: data.token
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ---------- interactive background waves ----------
    useEffect(() => {
        const canvas = bgCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let animationFrameId;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        const lines = [];
        const numLines = 8;
        for (let i = 0; i < numLines; i++) {
            lines.push({
                yRatio: 0.1 + (i * 0.8) / (numLines - 1),
                amplitude: 35 + Math.random() * 25,
                frequency: 0.0008 + Math.random() * 0.0012,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.008,
            });
        }

        function draw() {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            ctx.lineWidth = 2.6;
            ctx.strokeStyle = theme === "light" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.09)";

            const mx = pageMouse.current.x;
            const my = pageMouse.current.y;
            const now = performance.now();

            lines.forEach((line) => {
                ctx.beginPath();
                const centerY = h * line.yRatio;
                const linePhase = line.phase + now * 0.0003 * line.speed * 60;

                for (let x = 0; x <= w; x += 15) {
                    const baseOffsetY = centerY + Math.sin(x * line.frequency + linePhase) * line.amplitude;

                    let drawX = x;
                    let drawY = baseOffsetY;

                    const dx = x - mx;
                    const dy = baseOffsetY - my;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const warpRadius = 320;

                    if (dist < warpRadius) {
                        const force = (1 - dist / warpRadius);
                        // Repel/Push lines away from the cursor
                        drawY += (dy / (dist || 1)) * force * 80;
                        drawX += (dx / (dist || 1)) * force * 35;
                    }

                    if (x === 0) {
                        ctx.moveTo(drawX, drawY);
                    } else {
                        ctx.lineTo(drawX, drawY);
                    }
                }
                ctx.stroke();
            });

            animationFrameId = requestAnimationFrame(draw);
        }

        resize();
        window.addEventListener("resize", resize);
        animationFrameId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", resize);
        };
    }, [theme]);

    // ---------- entrance animation ----------
    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
            tl.from(rootRef.current, { opacity: 0, duration: 0.6 })
                .from(
                    cardRef.current,
                    { y: 35, opacity: 0, scale: 0.97, duration: 0.8, ease: "back.out(1.2)" },
                    "-=0.35"
                )
                .from(
                    formWrapRef.current.querySelectorAll(".fx-stagger"),
                    { y: 10, opacity: 0, duration: 0.45, stagger: 0.05 },
                    "-=0.4"
                );
        }, rootRef);
        return () => ctx.revert();
    }, []);

    // ---------- form switch transition ----------
    const switchMode = (next) => {
        if (next === mode) return;
        const el = formWrapRef.current;
        gsap.to(el, {
            opacity: 0,
            y: 6,
            duration: 0.16,
            onComplete: () => {
                setMode(next);
                gsap.fromTo(
                    el,
                    { opacity: 0, y: -6 },
                    { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }
                );
                gsap.fromTo(
                    el.querySelectorAll(".fx-stagger"),
                    { y: 8, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, delay: 0.04 }
                );
            },
        });
    };

    // ---------- halftone canvas drawing ----------
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx2d = canvas.getContext("2d");
        const wrap = panelWrapRef.current;

        function resize() {
            const rect = wrap.getBoundingClientRect();
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
        }

        function draw() {
            const w = canvas.width;
            const h = canvas.height;
            ctx2d.clearRect(0, 0, w, h);

            const spacing = 13; // grid density
            const rowHeight = spacing * 0.866; // aligns perfectly into diagonal grids
            const mx = mouse.current.x * 2;
            const my = mouse.current.y * 2;
            const now = performance.now();

            ripples.current = ripples.current.filter((r) => now - r.t0 < 1000);

            let r = 0;
            for (let y = spacing / 2; y < h; y += rowHeight) {
                const xOffset = (r % 2) * (spacing / 2);
                r++;

                for (let x = -spacing + xOffset; x < w + spacing; x += spacing) {
                    // Stable node seed to compute static jitter offsets per dot coordinate
                    const dotSeed = (x * 37 + y * 79);

                    // 1. Organic Grid Jitter (breaks strict grid linearity)
                    // Displaces coordinates to create natural local clusters vs sparse empty gaps
                    const jitterAmp = 3.6;
                    const baseJitterX = Math.sin(dotSeed * 0.035) * jitterAmp;
                    const baseJitterY = Math.cos(dotSeed * 0.045) * jitterAmp;

                    // Micro particle drifting over time to simulate suspension in air currents
                    const driftX = Math.sin(dotSeed * 0.007 + now * 0.0011) * 1.5;
                    const driftY = Math.cos(dotSeed * 0.009 + now * 0.0013) * 1.5;

                    let drawX = x + baseJitterX + driftX;
                    let drawY = y + baseJitterY + driftY;

                    // 2. Cursor repulsion / magnetic warp
                    if (mouse.current.active) {
                        const mdx = drawX - mx;
                        const mdy = drawY - my;
                        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                        const pushRadius = 220;
                        if (mdist < pushRadius) {
                            // Non-linear visual warp push force
                            const force = Math.pow(1 - mdist / pushRadius, 2.3);
                            // Draw dot pushed outward from cursor
                            drawX += (mdx / mdist) * force * 24;
                            drawY += (mdy / mdist) * force * 24;
                        }
                    }

                    // 3. Smoke Geometry: Narrow bottom source, wide dispersed top
                    const ny = drawY / h; // 0.0 (top) to 1.0 (bottom)

                    // Anchors the core column: far right (80%) at bottom, expanding leftwards to 32% at the top
                    const _smokeStart = w * (0.32 + ny * 0.48);

                    // Transition dispersion width: super wide (330px) at top, tight and crisp (110px) at bottom
                    const _dispersionWidth = 110 + (1 - ny) * 220;

                    // const distFactor = (drawX - smokeStart) / dispersionWidth;

                    // 4. Mathematical multi-octave 2D flow synthesis (Speeds reduced significantly)
                    const smokeScale = 0.0038;
                    const sX = drawX * smokeScale - now * - 0.00050;
                    const sY = drawY * smokeScale + now * 0.00035;

                    // Four wave octaves to generate chaotic plumes with zero repetition
                    const n1 = Math.sin(sX * 1.0 + sY * 0.8) * Math.cos(sY * 1.2 - sX * 0.4);
                    const n2 = Math.cos(sX * 2.3 - sY * 1.6) * Math.sin(sY * 1.9 + sX * 0.7);
                    const n3 = Math.sin(sX * 4.8 + sY * 3.2) * Math.cos(sY * 5.1 - sX * 2.8);
                    const n4 = Math.sin(sX * 10.5 - sY * 8.0) * Math.cos(sY * 9.2 + sX * 4.5);

                    const noiseFlow = n1 * 0.46 + n2 * 0.28 + n3 * 0.16 + n4 * 0.10;


                    const baseGradient = (drawX / w) * 1.7 - 0.42; // Combine geometry + chaotic noise
                    let intensity = baseGradient + noiseFlow * 0.75;

                    // Hover spotlight: grows dot intensity/size around cursor
                    if (mouse.current.active) {
                        const mdx = drawX - mx;
                        const mdy = drawY - my;
                        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                        const hoverRadius = 220;
                        if (mdist < hoverRadius) {
                            intensity = Math.min(1.4, intensity + (1 - mdist / hoverRadius) * 0.52);
                        }
                    }

                    // Click ripples animations
                    for (const rip of ripples.current) {
                        const age = now - rip.t0;
                        const ripRadius = (age / 1000) * 380;
                        const rdx = drawX - rip.x * 2;
                        const rdy = drawY - rip.y * 2;
                        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
                        const ringWidth = 45;
                        if (Math.abs(rdist - ripRadius) < ringWidth) {
                            const strength = (1 - age / 1000) * (1 - Math.abs(rdist - ripRadius) / ringWidth);
                            intensity = Math.min(1.4, intensity + strength * 0.75);
                        }
                    }

                    // Accentuate contrast using power curves (separates rich cores from thin outlines)
                    const dotVal = Math.pow(Math.max(0, Math.min(1.2, intensity)), 1.55);
                    const dotScale = dotVal * spacing * 0.88;

                    if (dotScale < 0.6) continue;

                    ctx2d.save();
                    ctx2d.translate(drawX, drawY);
                    ctx2d.rotate(Math.PI / 4); // Rotates into diamond shapes

                    // Opacity falloff makes small dots look like fine soot/smoke dust
                    ctx2d.fillStyle = `rgba(${t.dotColor}, ${Math.min(1.0, dotVal * 1.45)})`;
                    ctx2d.fillRect(-dotScale / 2, -dotScale / 2, dotScale, dotScale);
                    ctx2d.restore();
                }
            }

            rafId.current = requestAnimationFrame(draw);
        }

        function handleMove(e) {
            const rect = wrap.getBoundingClientRect();
            mouse.current.x = e.clientX - rect.left;
            mouse.current.y = e.clientY - rect.top;
            mouse.current.active = true;
        }

        function handleLeave() {
            mouse.current.active = false;
        }

        function handleClick(e) {
            const rect = wrap.getBoundingClientRect();
            ripples.current.push({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                t0: performance.now(),
            });
        }

        resize();
        draw();
        window.addEventListener("resize", resize);
        wrap.addEventListener("mousemove", handleMove);
        wrap.addEventListener("mouseleave", handleLeave);
        wrap.addEventListener("click", handleClick);

        return () => {
            cancelAnimationFrame(rafId.current);
            window.removeEventListener("resize", resize);
            wrap.removeEventListener("mousemove", handleMove);
            wrap.removeEventListener("mouseleave", handleLeave);
            wrap.removeEventListener("click", handleClick);
        };
    }, [theme, t.dotColor]);

    const handlePageMouseMove = (e) => {
        pageMouse.current.x = e.clientX;
        pageMouse.current.y = e.clientY;
    };

    return (
        <div
            ref={rootRef}
            onMouseMove={handlePageMouseMove}
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                background: t.pageBg,
                transition: "background 0.4s ease",
                position: "relative",
                overflow: "hidden",
                fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            {/* Interactive full-screen background vector waves */}
            <canvas
                ref={bgCanvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 1,
                    pointerEvents: "none",
                }}
            />

            <div
                ref={cardRef}
                className="auth-container-card"
                style={{
                    position: "relative",
                    background: t.cardBg,
                    borderRadius: 24,
                    border: t.cardBorder,
                    boxShadow: t.cardShadow,
                    overflow: "hidden",
                    transition: "background 0.4s ease, border 0.4s ease",
                    zIndex: 2,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    transform: "translateZ(0)", // Forces Webkit/Chrome to respect overflow: hidden with border-radius and backdrop-filter
                    isolation: "isolate", // Creates a new stacking context for strict clipping
                }}
            >
                {/* Theme Toggle Button (Circular Icon) */}
                <button
                    onClick={() => setTheme((cur) => (cur === "light" ? "dark" : "light"))}
                    style={{
                        position: "absolute",
                        top: 24,
                        right: 24,
                        border: `1.5px solid ${t.inputBorder}`,
                        background: t.cardBg,
                        color: t.text,
                        borderRadius: "50%",
                        width: 42,
                        height: 42,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        fontFamily: "inherit",
                        zIndex: 10,
                        backdropFilter: "blur(10px)",
                        WebkitBackdropFilter: "blur(10px)",
                        transition: "background 0.2s ease, border-color 0.2s ease, transform 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                    {theme === "light" ? <MoonIcon color={t.text} /> : <SunIcon color={t.text} />}
                </button>
                {/* Form area */}
                <form
                    onSubmit={handleSubmit}
                    ref={formWrapRef}
                    className="auth-form-side"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        position: "relative",
                        zIndex: 2,
                    }}
                >
                    {/* Brand Header (Icon + Animated FlowChat Shimmer & Active Beacon Dot) */}
                    <div className="fx-stagger flowchat-brand-wrapper">
                        <svg
                            className="flowchat-brand-icon"
                            width="34"
                            height="34"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ color: t.text }}
                        >
                            <path className="flowchat-icon-bar1" d="M5.5 17L9.5 7H13.5L9.5 17H5.5Z" fill="currentColor" />
                            <path className="flowchat-icon-bar2" d="M12.5 17L16.5 7H20.5L16.5 17H12.5Z" fill="currentColor" />
                        </svg>
                        <span className={`flowchat-brand-name ${theme}`}>
                            FlowChat
                        </span>
                    </div>

                    <h1
                        className="fx-stagger"
                        style={{
                            margin: "0 0 4px",
                            color: t.text,
                            fontSize: 22,
                            fontWeight: "700",
                            letterSpacing: "-0.3px",
                            opacity: 0.9
                        }}
                    >
                        {mode === "signin" ? "Sign In" : "Sign Up"}
                    </h1>
                    <p
                        className="fx-stagger"
                        style={{
                            color: t.textMuted,
                            margin: "0 0 1.5rem",
                            fontSize: 13,
                            fontWeight: "500",
                            letterSpacing: "0.2px"
                        }}
                    >
                        {mode === "signin"
                            ? "Continue to access your chats"
                            : "Create an account to start chatting"}
                    </p>

                    {/* Display authentication error messages */}
                    {error && (
                        <div
                            className="fx-stagger"
                            style={{
                                color: "#EA4335",
                                background: theme === "light" ? "rgba(234, 67, 53, 0.08)" : "rgba(234, 67, 53, 0.12)",
                                border: "1.5px solid rgba(234, 67, 53, 0.2)",
                                padding: "10px 14px",
                                borderRadius: "9999px",
                                fontSize: "11px",
                                fontWeight: "600",
                                textAlign: "center",
                                marginBottom: "1.25rem",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* OAuth Buttons */}
                    <button
                        type="button"
                        className="fx-stagger"
                        style={oAuthButtonStyle(t)}
                        onClick={() => handleGoogleLogin()}
                        disabled={loading}
                    >
                        <GoogleIcon />
                        {loading 
                            ? "Connecting to Google..." 
                            : mode === "signup" 
                            ? "Sign up with Google" 
                            : "Sign in with Google"}
                    </button>

                    <div
                        className="fx-stagger"
                        style={{ display: "flex", alignItems: "center", gap: 12, margin: "1rem 0" }}
                    >
                        <div style={{ flex: 1, height: 1, background: t.inputBorder }} />
                        <span style={{ fontSize: 11, fontWeight: "700", color: t.textMuted, letterSpacing: "0.5px" }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: t.inputBorder }} />
                    </div>

                    {/* Inputs */}
                    {mode === "signup" && (
                        <>
                            <label
                                className="fx-stagger"
                                style={labelStyle(t)}
                            >
                                Username
                            </label>
                            <input
                                className="fx-stagger"
                                type="text"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                style={inputStyle(t)}
                            />
                        </>
                    )}

                    <label
                        className="fx-stagger"
                        style={labelStyle(t)}
                    >
                        Email
                    </label>
                    <input
                        className="fx-stagger"
                        type="text"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={inputStyle(t)}
                    />

                    <div
                        className="fx-stagger"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                            padding: "0 4px",
                        }}
                    >
                        <label style={{ fontSize: 11, fontWeight: "700", color: t.text }}>Password</label>
                        {mode === "signin" && (
                            <span style={{ fontSize: 11, fontWeight: "700", color: t.text, textDecoration: "underline", cursor: "pointer" }}>
                                Forgot Password?
                            </span>
                        )}
                    </div>
                    <input
                        className="fx-stagger"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ ...inputStyle(t), marginBottom: "1.5rem" }}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="fx-stagger"
                        style={{
                            width: "100%",
                            background: t.buttonBg,
                            color: t.buttonText,
                            border: theme === "light"
                                ? "1.5px solid rgba(0, 0, 0, 0.15)"
                                : "1.5px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "9999px",
                            padding: "14px",
                            fontWeight: "700",
                            fontSize: 13,
                            cursor: loading ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                            transition: "opacity 0.2s ease",
                            opacity: loading ? 0.7 : 1
                        }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
                        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = "1"; }}
                    >
                        {loading ? "Authenticating..." : (mode === "signin" ? "Sign In" : "Sign Up")}
                    </button>

                    <p
                        className="fx-stagger"
                        style={{ textAlign: "center", fontSize: 12, color: t.textMuted, marginTop: "2rem" }}
                    >
                        {mode === "signin" ? (
                            <>
                                Don't have an account?{" "}
                                <span
                                    style={{ color: t.text, fontWeight: "700", textDecoration: "underline", cursor: "pointer" }}
                                    onClick={() => switchMode("signup")}
                                >
                                    Create an Account
                                </span>
                            </>
                        ) : (
                            <>
                                Already have an account?{" "}
                                <span
                                    style={{ color: t.text, fontWeight: "700", textDecoration: "underline", cursor: "pointer" }}
                                    onClick={() => switchMode("signin")}
                                >
                                    Sign In
                                </span>
                            </>
                        )}
                    </p>
                </form>

                {/* Halftone canvas decoration (54% width) */}
                <div
                    ref={panelWrapRef}
                    className="auth-panel-side"
                    style={{
                        position: "relative",
                        overflow: "hidden",
                        background: "transparent",
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    />
                    {/* Slogan overlay - Glassmorphic tech metadata widget */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: 32,
                            right: 32,
                            zIndex: 3,
                            pointerEvents: "none",
                            fontFamily: "Inter, system-ui, sans-serif"
                        }}
                    >
                        <div
                            style={{
                                background: theme === "light" ? "rgba(255, 255, 255, 0.42)" : "rgba(10, 10, 10, 0.42)",
                                border: theme === "light" ? "1.5px solid rgba(0, 0, 0, 0.08)" : "1.5px solid rgba(255, 255, 255, 0.08)",
                                padding: "18px 24px",
                                borderRadius: "20px",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                boxShadow: theme === "light" ? "0 10px 30px rgba(0,0,0,0.04)" : "0 10px 30px rgba(0,0,0,0.3)",
                                display: "inline-block",
                                textAlign: "left",
                                maxWidth: 300
                            }}
                        >
                            {/* Technical Cluster Status */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "#34A853",
                                        boxShadow: "0 0 8px #34A853",
                                        display: "inline-block"
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 9,
                                        fontWeight: "800",
                                        letterSpacing: "1.2px",
                                        textTransform: "uppercase",
                                        color: theme === "light" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)"
                                    }}
                                >
                                    FlowChat Engine
                                </span>
                            </div>

                            <h3
                                style={{
                                    margin: 0,
                                    color: theme === "light" ? "#161816" : "#ffffff",
                                    fontSize: 17,
                                    fontWeight: "900",
                                    lineHeight: "1.3",
                                    letterSpacing: "-0.4px"
                                }}
                            >
                                Seamless real-time conversations in smooth continuous flow.
                            </h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function oAuthButtonStyle(t) {
    return {
        width: "100%",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: "9999px",
        border: `1px solid ${t.inputBorder}`,
        background: t.cardBg,
        color: t.text,
        padding: "13px",
        fontSize: "12px",
        fontWeight: "700",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.2s ease",
    };
}

function labelStyle(t) {
    return {
        fontSize: 11,
        fontWeight: "700",
        color: t.text,
        display: "block",
        marginBottom: 8,
        padding: "0 4px",
    };
}

function inputStyle(t) {
    return {
        width: "100%",
        marginBottom: "1.25rem",
        borderRadius: "9999px",
        border: `1px solid ${t.inputBorder}`,
        padding: "13px 20px",
        fontSize: 13,
        fontWeight: "550",
        background: t.cardBg,
        color: t.text,
        outline: "none",
        fontFamily: "inherit",
        transition: "border-color 0.2s ease, background 0.4s ease, color 0.4s ease",
    };
}
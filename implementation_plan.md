# Implementation Plan: VocalScout Multilingual Video Voice Tutor Dashboard

Build a high-contrast, production-grade, single-screen interactive web dashboard for **VocalScout** — an AI-powered multilingual video voice tutor prototype tailored for hackathon stage demos.

## User Review Required

> [!IMPORTANT]
> **Demo Mode & Backend Fallback**: To ensure zero risk during live stage presentations (in case `http://localhost:8000` is down or unconfigured), VocalScout will feature an automatic fallback / toggle to pre-indexed mock responses (with realistic audio synthesis via Web Speech API or generated audio), while strictly targeting `http://localhost:8000/api/ask-voice` and `http://localhost:8000/api/ask-text` when online.

## Architecture & Design Aesthetic

### Visual System
- **Dark Theme Foundation**: `bg-slate-950` deep canvas, `bg-slate-900/80` glassmorphic cards with `border-slate-800/80` and subtle violet glow accents.
- **Accents & States**:
  - `IDLE`: Violet/Indigo neon (`#8b5cf6`, `#6366f1`) with soft breathing glow.
  - `LISTENING`: Crimson/Rose active ripple (`#f43f5e`) with multi-ring SVG pulse waves and dynamic audio frequency visualizer.
  - `THINKING`: Amber/Cyan animated shimmer skeleton with glowing orbital loader.
  - `SPEAKING`: Emerald/Teal wave visualizer (`#10b981`, `#06b6d4`) with live playing indicator.
  - `ERROR`: Crimson alert banner with quick retry and fail-safe text input drawer.
- **Layout (Single Screen Viewport)**:
  - **Header**: VocalScout branding, live status pill, target language selector (English, Hindi, Marathi, Bengali), and Backend Connection / Demo Mode toggle.
  - **Left Column (60-65% width)**:
    - Pre-indexed Video Switcher Pills ("Python Memory & Loops" [EN] vs "Deep Learning Fundamentals" [FR]).
    - Synchronized YouTube IFrame Player with active timestamp tracker and custom seek controls.
    - Quick Timeline Hotspots (key topics with one-click seek).
  - **Right Column (35-40% width)**:
    - Interactive Voice Assistant Hub.
    - Central Push-to-Talk (PTT) Mic Controller with hold-to-talk mouse/touch listeners and pulsing soundwave ripples.
    - Real-time FSM status badge (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `ERROR`).
    - Explanation Card with transcript citation quote, direct `[Jump to MM:SS]` button, answer playback controller, and speed toggle.
    - Expandable Stage Noise Fallback Drawer ("Can't speak? Type your query").

---

## Proposed Implementation Details

### 1. Project Initialization & Dependencies
- Scaffold lightweight Vite + React application in `c:\Hackathon`.
- Install dependencies:
  - `lucide-react` (high quality clean stroke icons)
  - `react-youtube` (robust YouTube player lifecycle wrapper with direct player reference)
  - Tailwind CSS & Autoprefixer (with custom animations and ripple utilities)

### 2. Core Modules & Components
- **`src/types.ts`**: TypeScript interfaces for FSM states (`InteractionState`), API request/response payloads, video metadata, and languages.
- **`src/services/api.ts`**: Handles `POST http://localhost:8000/api/ask-voice` (`multipart/form-data`) and `POST http://localhost:8000/api/ask-text` (`application/json`) with automatic failover to local high-fidelity mock data if the backend is unreachable.
- **`src/components/Header.tsx`**: VocalScout logo, status ping indicator, target language dropdown (Hindi, Marathi, Bengali, English), and Backend/Demo switch.
- **`src/components/VideoPlayerStage.tsx`**:
  - Video selector pills (Video A: `kqtD5dpn9C8` / `vid_py_01` & Video B: `aircAruvnKk` / `vid_fr_02`).
  - YouTube player component maintaining `playerRef` with methods `pauseVideo()`, `playVideo()`, and `seekTo(seconds, true)`.
  - Timestamp markers / jump pills.
- **`src/components/VoiceAssistantPanel.tsx`**:
  - Finite State Machine state visualization (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `ERROR`).
  - Push-To-Talk (PTT) interactive button with mouse down/up and touch start/end handlers.
  - Multi-ring CSS sound ripple animation & canvas audio visualizer during recording.
  - Shimmer loading state during `THINKING`.
  - Explanation Card with transcript quote badge, synthesized audio player, and `[Jump to MM:SS]` button.
  - Expandable text drawer with fail-safe submission for noisy auditoriums.
- **`src/hooks/useVoiceRecorder.ts`**:
  - Encapsulates `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, audio chunks collection, and clean stream track termination (`track.stop()`) to avoid persistent browser microphone lock.

---

## Verification Plan

### Automated / Build Verification
- Run `npm run build` to verify clean TypeScript compilation and zero lint/type errors.

### Interactive Functional Verification
- Test PTT button: Hold to record -> video pauses, ripple animations trigger.
- Release PTT: `THINKING` state with skeleton shimmer -> `SPEAKING` state.
- Player sync: YouTube player automatically navigates to `target_seconds` and updates timeline.
- Video switcher: Switch between Video A and Video B, confirming player switches video and resets explanation cards.
- Text fallback: Type query in stage noise drawer, verify `POST /api/ask-text` flow works seamlessly.
- Audio synthesis: Verify audio plays and gracefully returns to `IDLE` when finished.

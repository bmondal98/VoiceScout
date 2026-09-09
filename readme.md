# Voice Scout
### Maintained by Hustlers

---

# VocalScout 🎙️
### Interactive Multilingual Video Voice Tutor — Hackathon Prototype

VocalScout is a clean, high-contrast single-screen dashboard designed for hackathon stage demos. It allows users to watch educational videos (in English or French), select a target spoken language (Hindi, Marathi, Bengali, or English), and hold down a Push-to-Talk (PTT) microphone button to ask questions in their native language.

---

## Key Features

1. **Push-to-Talk (PTT) Finite State Machine**:
   - `IDLE`: Microphone button is active and ready.
   - `LISTENING`: Mouse down / touch start pauses video automatically, triggers concentric soundwave ripple pulses, and streams audio via `MediaRecorder`.
   - `THINKING`: Mouse up / touch end sends audio blob via `multipart/form-data` to `POST http://localhost:8000/api/ask-voice`, displaying animated shimmer skeleton loaders.
   - `SPEAKING`: Automatically seeks the YouTube player to `target_seconds`, plays the synthesized regional voice answer aloud, displays the verbatim video quote, and offers a `[Jump to MM:SS]` button. Returns to `IDLE` on audio completion.
   - `ERROR`: Clear dismissible error notification with quick fallback suggestions.

2. **Stage Noise Fallback Drawer**:
   - For noisy auditorium environments, an expandable drawer provides a direct keyboard query interface submitting to `POST http://localhost:8000/api/ask-text` with `{ video_id, query, target_language }`.
   - Includes quick one-click prompt pills tailored to each video.

3. **Pre-Indexed Video Switcher**:
   - **Video A**: "Python Memory & Loops" (EN) -> YouTube ID: `kqtD5dpn9C8` | `video_id`: `vid_py_01`
   - **Video B**: "Deep Learning Fundamentals" (FR) -> YouTube ID: `aircAruvnKk` | `video_id`: `vid_fr_02`
   - Switching videos updates the player and resets state without reloading the page.

4. **Synchronized YouTube IFrame Player**:
   - Maintains a direct instance reference to YouTube's player API for instant `player.seekTo(targetSeconds, true)`, `pauseVideo()`, and `playVideo()`.
   - Displays timeline hotspots (chapters) and animated jump badges.

5. **Stage-Safe Demo Mode**:
   - Toggle between **Live Backend** (`http://localhost:8000`) and **Demo Mode** (built-in multilingual mock responses with Web Speech API audio synthesis) in the header to ensure flawless stage presentations even if the backend service is offline.

6. **Hardware Stream Cleanup**:
   - Properly halts all microphone `MediaStreamTrack` instances on release or unmount to avoid persistent red browser recording icons.

---

## Tech Stack & Dependencies

- **Frontend Core**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), Custom CSS Keyframe animations (soundwave equalizer, concentric ripples, shimmer skeleton)
- **Icons**: `lucide-react`
- **Video Embed**: `react-youtube` (IFrame Player API)
- **Audio Capture**: HTML5 `MediaRecorder` + Web Audio `AudioContext`
- **Audio Output**: HTML5 `Audio` with Web Speech API fallback

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for Production
```bash
npm run build
```

---

## Backend API Specification

VocalScout connects with your Python/FastAPI backend at `http://localhost:8000`:

### `POST /api/ask-voice`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Audio blob (`query.webm`)
  - `video_id`: `"vid_py_01"` or `"vid_fr_02"`
  - `target_language`: `"hi"`, `"mr"`, `"bn"`, or `"en"`
- **Response**:
```json
{
  "transcribed_query": "Python में break और continue मेमोरी में कैसे काम करते हैं?",
  "answer_text": "Python में break स्टेटमेंट लूप को तुरंत समाप्त कर देता है...",
  "target_seconds": 152,
  "quote": "If you hit a break keyword, it completely breaks out of the loop...",
  "audio_url": "http://localhost:8000/audio/response_123.mp3"
}
```

### `POST /api/ask-text`
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "video_id": "vid_py_01",
  "query": "How does break differ from continue?",
  "target_language": "hi"
}
```

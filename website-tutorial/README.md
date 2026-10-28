# Workday Khmer user tutorial

An editable 2:40 tutorial for https://weekly-tau-bay.vercel.app/.
1920 x 1080, 30 fps, Khmer instructions with English UI labels, nine chapters.
Illustrations are labelled examples authored from the repository UI and
backend workflows, rather than live recordings. Deployment parity has not
been verified.

## Preview

From this folder, run:

```powershell
npm run dev
```

Open http://localhost:3100/Workday-Khmer-Guide. The viewer includes Khmer voice
controls, chapter navigation, and synchronized playback. Start playback with
the video controls or choose a chapter; browsers require this user interaction
before audio can play.

To open Remotion Studio separately, run `npm run studio` and visit
http://localhost:3101.

## Chapters

| Time | Topic |
| --- | --- |
| 00:00 | Welcome and workflow |
| 00:10 | Sign in and language |
| 00:26 | Accept and start assigned work |
| 00:46 | New daily report |
| 01:06 | Up to 15 work links; Digital / DGT quantity workflow |
| 01:26 | Save draft, attach evidence, submit |
| 01:44 | Manager review, approval, revisions |
| 02:04 | Task creation and separate task completion |
| 02:24 | Notifications, analytics, exports, sign out |

## Export when needed

Render the narrated MP4 into the viewer's public download path:

```powershell
npm run render
```

The viewer's **ទាញយកវីដេអូ** button downloads
`public/workday-khmer-guide.mp4`. Re-render it after changing the narration or
video scenes so the download stays current.

An existing narrated MP4 is included. After changing only the narration,
`npm run sync:download` replaces its audio while copying the original video
track. After changing video scenes, use `npm run render` instead.

## Khmer narration

The nine existing chapter scripts and timestamps are in `narration.json`.
Generated MP3s use Microsoft Edge TTS's `km-KH-SreymomNeural` female voice at
`+5%` rate. The spoken wording follows the existing steps and Khmer translations
in the application, without reading long phonetic English button names.
The viewer plays these bundled clips; it does not depend
on browser speech synthesis or silently substitute an English voice. No API key
is needed to play or regenerate the clips. Regeneration requires Internet
access and the Python package:

```powershell
python -m venv .voice-venv
.voice-venv/Scripts/python.exe -m pip install -r requirements-voice.txt
.voice-venv/Scripts/python.exe generate_voiceover.py
```

The generator caches clips by text, voice and rate. It retries transient service
errors, writes new files atomically, and preserves previous clips on failure.
`--force` regenerates cached clips. It verifies decoded audio and rejects clips
that exceed their scene's duration, then refreshes `src/audio-metadata.json`.
Voice generation uses an online service and can fail if that service changes;
playback uses local assets and needs no network TTS request or API credentials.

## Playback controls and synchronization

`src/viewer-main.tsx` is the React/Vite entry point; the existing
`/Workday-Khmer-Guide` route displays `src/Viewer.tsx` and Remotion's Player.
`src/Root.tsx` registers the same nine scenes for Player playback and Studio.
`narration.json` owns their original timestamps (0 to 160 seconds), Khmer
scripts, labels and audio URLs. No instructional steps were added.

Remotion owns the only playback clock. Pause, seek and 0.8x / 1.0x / 1.2x speed
apply to the picture and narration together. The native video controls remain
available. Chapter navigation respects mute and automatic-narration settings.
Listen/replay starts the current chapter and enables its audio. With automatic
narration disabled, an explicit listen stops at that chapter's end. Frame events
update the indicator, rather than starting speech repeatedly. Native mute/volume
controls and the Khmer panel share state.

Audio requires a user play/listen gesture. Missing or corrupt Khmer clips show
a Khmer message, disable that step's listen/replay controls, and leave video and
other chapters usable. The app never selects an English fallback voice.

## Verification

```powershell
npm run lint
npm run build
npm test
npm run check:audio
```

Browser tests cover real nonzero Web Audio output, silence when paused/muted,
resume, replay, chapter changes, isolated/automatic narration, native seeking,
speed changes, no browser Khmer voices, missing/corrupt MP3s and mobile layout.
Audio checks decode every MP3 and verify that it fits its chapter. Playwright
uses the Chrome Headless Shell installed by Remotion (Windows executable path
in `playwright.config.ts`); on other operating systems, update that path.
This verifies media playback programmatically; subjective Khmer pronunciation
and physical speaker output still benefit from review by a native listener.

## Files changed for narration

- `src/Viewer.tsx`, `src/viewer.css`: Khmer controls, playback status and error states.
- `src/Root.tsx`, `src/Shared.tsx`: existing compositions and scenes use the shared narration data and audio component.
- `src/useNarrationControls.ts`, `src/NarrationAudio.tsx`, `src/narration.ts`: player synchronization, audio lifecycle and timeline helpers.
- `narration.json`, `src/audio-metadata.json`: per-step Khmer scripts, original timestamps, audio URLs and verified clip metadata.
- `public/voiceover/*.mp3`, `public/voiceover/.generation-cache.json`, `public/workday-khmer-guide.mp4`: generated voice clips, generation cache and synchronized download.
- `generate_voiceover.py`, `verify_audio.py`, `sync_download.py`, `requirements-voice.txt`: reproducible generation, caching, verification and download audio updates.
- `tests/narration.spec.ts`, `playwright.config.ts`: browser coverage for normal playback, controls, fallback/error handling and mobile layout.
- `package.json`, `package-lock.json`, `.gitignore`, `README.md`: commands, test dependency, generated-file ignores and documentation.

Each chapter has its own TSX file and standalone composition. Shared typography,
cards and animations are in `src/Shared.tsx`. Fonts and licenses are in
`public/fonts`. All example names, links and quantities are fictional.

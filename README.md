# Speak & Learn

A tiny web app for learning languages by speaking. Type or say a phrase in
English, see the translation in your target language, and hear it spoken aloud.
Phrase pairs are saved to a local history you can click to replay.

## Run it

From this folder, start any static file server, e.g.:

```
npx serve .
```

Then open the printed URL (usually <http://localhost:3000>) in **Chrome or Edge**.

A local server is needed because the browser only allows microphone access on a
secure context (`localhost` counts). Typing + audio playback work in any modern
browser; the 🎤 speech input needs Chrome/Edge.

## Usage

1. Pick a target language from the dropdown (60+ languages, French by default).
2. Type an English phrase — or click 🎤, speak (pauses are fine), then click 🎤
   again to stop. The transcript stays in the box so you can edit it.
3. Press **Translate** (or Enter). The translation appears and is spoken aloud
   automatically; 🔊 replays it.
4. Under the translation, a word-by-word gloss shows what each word means in
   English (e.g. `je → I`, `pense → think`) — handy for learning the pieces.
5. Each phrase pair is saved to History with a language tag — click any entry
   to see, hear, and gloss it again. **Clear** empties it.

History is stored in your browser's `localStorage` — it survives refreshes and
never leaves your machine; it's cleared only if you clear site data or press
Clear.

Note: spoken audio depends on voices installed on your OS. If a language has no
voice (e.g. Yoruba on most systems), the app shows the text and tells you.

## How it works

- `translate.js` — language list + translation layer. Uses Google's free public
  `gtx` endpoint, with MyMemory as automatic fallback. To use a different
  provider (DeepL, Google Cloud, an LLM…), replace the functions in this file.
- `app.js` — speech recognition (English), text-to-speech, history.
- No build step, no API keys, no dependencies to install.

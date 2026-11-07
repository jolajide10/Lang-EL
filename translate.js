// Translation layer: English -> target language via free keyless APIs.
// To swap providers later, just replace these two functions (or add your own).
// `tts` overrides the language prefix used to pick a speech voice.

const LANGUAGES = [
  { code: "af", label: "Afrikaans" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "bg", label: "Bulgarian" },
  { code: "my", label: "Burmese" },
  { code: "ca", label: "Catalan" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "eo", label: "Esperanto" },
  { code: "tl", label: "Filipino", tts: "fil" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "ha", label: "Hausa" },
  { code: "iw", label: "Hebrew", tts: "he" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "ig", label: "Igbo" },
  { code: "id", label: "Indonesian" },
  { code: "ga", label: "Irish" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "km", label: "Khmer" },
  { code: "ko", label: "Korean" },
  { code: "lo", label: "Lao" },
  { code: "la", label: "Latin" },
  { code: "ms", label: "Malay" },
  { code: "zh-CN", label: "Mandarin (Simplified)" },
  { code: "zh-TW", label: "Mandarin (Traditional)", tts: "zh" },
  { code: "mi", label: "Maori" },
  { code: "mn", label: "Mongolian" },
  { code: "ne", label: "Nepali" },
  { code: "no", label: "Norwegian", tts: "nb" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "so", label: "Somali" },
  { code: "es", label: "Spanish" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
  { code: "cy", label: "Welsh" },
  { code: "xh", label: "Xhosa" },
  { code: "yo", label: "Yoruba" },
  { code: "zu", label: "Zulu" },
];

const GOOGLE_URL =
  "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&q=";
const MYMEMORY_URL = "https://api.mymemory.translated.net/get?q=";

async function translateViaGoogle(text, targetCode) {
  const res = await fetch(
    GOOGLE_URL + encodeURIComponent(text) + "&tl=" + encodeURIComponent(targetCode)
  );
  if (!res.ok) throw new Error("Google translate failed: " + res.status);
  const data = await res.json();
  // Response shape: [[["Translated segment","English segment",...], ...], ...]
  const translated = data[0].map((segment) => segment[0]).join("");
  if (!translated) throw new Error("Empty translation");
  return translated;
}

async function translateViaMyMemory(text, targetCode) {
  const langpair = "en|" + targetCode;
  const res = await fetch(
    MYMEMORY_URL + encodeURIComponent(text) + "&langpair=" + encodeURIComponent(langpair)
  );
  if (!res.ok) throw new Error("MyMemory translate failed: " + res.status);
  const data = await res.json();
  const translated = data.responseData && data.responseData.translatedText;
  if (!translated) throw new Error("Empty translation");
  return translated;
}

// Tries the primary provider, falls back automatically.
async function translateText(text, targetCode) {
  try {
    return await translateViaGoogle(text, targetCode);
  } catch (primaryErr) {
    console.warn("Primary translator failed, trying fallback:", primaryErr);
    return await translateViaMyMemory(text, targetCode);
  }
}

// ---------- Word-by-word gloss ----------

// Scripts without spaces between words get split per character instead.
const NO_SPACE_LANGS = new Set(["zh-CN", "zh-TW", "ja", "th", "km", "lo", "my"]);
const GLOSS_LIMIT = 15;
const glossCache = new Map(); // `${lang}:${word}` -> english

function glossTokens(text, langCode) {
  let tokens;
  if (NO_SPACE_LANGS.has(langCode)) {
    tokens = [...text].filter((c) => !/\s/.test(c) && /[\p{L}\p{N}]/u.test(c));
  } else {
    tokens = text
      .split(/\s+/)
      .map((t) => t.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
      .filter(Boolean);
  }
  return [...new Set(tokens)].slice(0, GLOSS_LIMIT);
}

// Sends the words newline-separated in ONE request — the API translates each
// line independently, giving a cheap word-for-word gloss.
async function glossWords(text, langCode) {
  const tokens = glossTokens(text, langCode);
  const missing = tokens.filter((t) => !glossCache.has(langCode + ":" + t));

  if (missing.length > 0) {
    const res = await fetch(
      GOOGLE_URL.replace("sl=en", "sl=" + encodeURIComponent(langCode)) +
        encodeURIComponent(missing.join("\n")) +
        "&tl=en"
    );
    if (!res.ok) throw new Error("Gloss failed: " + res.status);
    const data = await res.json();
    for (const segment of data[0]) {
      const src = (segment[1] || "").trim();
      const en = (segment[0] || "").trim();
      if (src && en) glossCache.set(langCode + ":" + src, en);
    }
  }

  return tokens
    .filter((t) => glossCache.has(langCode + ":" + t))
    .map((t) => ({ word: t, meaning: glossCache.get(langCode + ":" + t) }));
}

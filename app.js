const input = document.getElementById("phrase-input");
const langSelect = document.getElementById("lang-select");
const micBtn = document.getElementById("mic-btn");
const translateBtn = document.getElementById("translate-btn");
const micStatus = document.getElementById("mic-status");
const errorMsg = document.getElementById("error-msg");
const voiceNote = document.getElementById("voice-note");
const result = document.getElementById("result");
const englishText = document.getElementById("english-text");
const translatedText = document.getElementById("translated-text");
const replayBtn = document.getElementById("replay-btn");
const glossEl = document.getElementById("gloss");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const clearHistoryBtn = document.getElementById("clear-history");

const HISTORY_KEY = "speak-french-history";
const HISTORY_LIMIT = 50;

// ---------- Language dropdown ----------

for (const lang of LANGUAGES) {
  const option = document.createElement("option");
  option.value = lang.code;
  option.textContent = lang.label;
  langSelect.appendChild(option);
}
langSelect.value = "fr";

function currentLang() {
  return LANGUAGES.find((l) => l.code === langSelect.value);
}

let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
renderHistory();

// ---------- Text-to-speech ----------

function findVoice(langCode) {
  const prefix = langCode.split("-")[0];
  const normalized = (v) => v.lang && v.lang.replace("_", "-");
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => normalized(v) === langCode) ||
    voices.find((v) => normalized(v) && normalized(v).startsWith(prefix)) ||
    null
  );
}

function speak(text, lang) {
  speechSynthesis.cancel();
  const ttsPrefix = lang.tts || lang.code;
  const voice = findVoice(ttsPrefix);
  if (!voice) {
    voiceNote.textContent = `No ${lang.label} voice on this device — text only.`;
    voiceNote.hidden = false;
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.9; // slightly slower, easier to follow while learning
  speechSynthesis.speak(utterance);
}

// Chrome loads voices asynchronously; no-op call warms the list.
speechSynthesis.getVoices();
speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();

// ---------- Translation flow ----------

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = !message;
}

let currentTarget = null;

function showResult(en, translated, lang) {
  englishText.textContent = en;
  translatedText.textContent = translated;
  currentTarget = { text: translated, lang };
  result.hidden = false;
}

async function runTranslation() {
  const text = input.value.trim();
  if (!text) return;

  if (listening && recognition) recognition.stop();
  showError("");
  voiceNote.hidden = true;
  glossEl.hidden = true;
  translateBtn.disabled = true;
  translateBtn.textContent = "…";

  const lang = currentLang();
  try {
    const translated = await translateText(text, lang.code);
    showResult(text, translated, lang);
    speak(translated, lang);
    showGloss(translated, lang);
    addToHistory(text, translated, lang.code);
  } catch (err) {
    console.error(err);
    showError("Translation failed — check your internet connection and try again.");
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate";
  }
}

translateBtn.addEventListener("click", runTranslation);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runTranslation();
});
replayBtn.addEventListener("click", () => {
  if (currentTarget) speak(currentTarget.text, currentTarget.lang);
});

// ---------- Word-by-word gloss ----------

async function showGloss(translated, lang) {
  try {
    const pairs = await glossWords(translated, lang.code);
    glossEl.innerHTML = "";
    for (const p of pairs) {
      const chip = document.createElement("span");
      chip.className = "gloss-chip";
      chip.textContent = `${p.word} → ${p.meaning}`;
      glossEl.appendChild(chip);
    }
    glossEl.hidden = pairs.length === 0;
  } catch (err) {
    console.warn("Gloss failed:", err);
    glossEl.hidden = true;
  }
}

// ---------- Speech input (English) ----------

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let listening = false;
let committed = "";

if (!SpeechRecognition) {
  micBtn.disabled = true;
  micBtn.title = "Speech input needs Chrome or Edge — typing still works";
} else {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true; // keep listening through pauses until stopped
  recognition.interimResults = true; // show text live as you speak
  recognition.maxAlternatives = 1;

  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    showError("");
    committed = input.value.trim() ? input.value.trim() + " " : "";
    try {
      recognition.start();
    } catch {
      // start() throws if called while already starting
    }
  });

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add("listening");
    micStatus.hidden = false;
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove("listening");
    micStatus.hidden = true;
    input.value = committed.trim() || input.value;
  };

  recognition.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) committed += r[0].transcript.trim() + " ";
      else interim += r[0].transcript;
    }
    input.value = committed + interim;
  };

  recognition.onerror = (e) => {
    if (e.error === "not-allowed") {
      showError("Microphone access was blocked. Allow it in the browser and try again.");
    } else if (e.error === "no-speech") {
      // silence is fine with continuous mode — keep the transcript as-is
    } else if (e.error !== "aborted") {
      showError("Couldn't hear you — try again or type instead.");
    }
  };
}

// ---------- History ----------

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Clear all saved phrases?")) return;
  history = [];
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

function addToHistory(en, translated, langCode) {
  history.unshift({ en, tr: translated, lang: langCode });
  if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";
  historyEmpty.hidden = history.length > 0;

  for (const item of history) {
    const code = item.lang || "fr";
    const lang = LANGUAGES.find((l) => l.code === code) || currentLang();
    const translated = item.tr || item.fr;

    const li = document.createElement("li");
    const fr = document.createElement("div");
    const en = document.createElement("div");
    const tag = document.createElement("span");
    fr.className = "fr";
    en.className = "en";
    tag.className = "lang-tag";
    fr.textContent = translated;
    en.textContent = item.en;
    tag.textContent = lang.label;
    fr.appendChild(tag);
    li.append(fr, en);
    li.addEventListener("click", () => {
      showResult(item.en, translated, lang);
      speak(translated, lang);
      showGloss(translated, lang);
    });
    historyList.appendChild(li);
  }
}

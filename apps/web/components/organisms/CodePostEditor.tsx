"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { githubLight } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import {
  csharp as legacyCSharp,
  scala as legacyScala,
  kotlin as legacyKotlin,
  dart as legacyDart,
} from "@codemirror/legacy-modes/mode/clike";
import { go as legacyGo } from "@codemirror/legacy-modes/mode/go";
import { shell as legacyShell } from "@codemirror/legacy-modes/mode/shell";
import { ruby as legacyRuby } from "@codemirror/legacy-modes/mode/ruby";
import { swift as legacySwift } from "@codemirror/legacy-modes/mode/swift";
import { dockerFile as legacyDockerfile } from "@codemirror/legacy-modes/mode/dockerfile";
import hljs from "highlight.js";

/**
 * apps/web/components/organisms/CodePostEditor.tsx
 *
 * CODE post yaratish uchun syntax-highlight qilingan kod muharriri:
 * - CodeMirror 6 (@uiw/react-codemirror) — qator raqamlari, faol
 *   qatorni ajratish, tegishli tilga mos rang berish bilan.
 * - Til tanlash dropdown'i — foydalanuvchi ko'rmagan holatda,
 *   kodning o'zidan avtomatik aniqlangan til DEFAULT sifatida
 *   ko'rsatiladi. Foydalanuvchi dropdown'dan boshqa tilni tanlasa, bu
 *   tanlov ustunlik qiladi va shu paytdan boshlab avtomatik aniqlash
 *   bu maydonni endi qayta yozmaydi (xuddi backend'dagi
 *   `detectLanguage()`ning "foydalanuvchi tanlovi ustunlik qiladi"
 *   tamoyili bilan bir xil mantiq, faqat bu yerda brauzerda ishlaydi).
 *
 * MUHIM (dublikat mantiq haqida): avtomatik aniqlash uchun ishlatilgan
 * `CANDIDATE_LANGUAGES` ro'yxati apps/api/src/services/
 * language-detection.service.ts'dagi xuddi shu nomdagi ro'yxatning
 * ONALIK NUSXASI (mirror). apps/web va apps/api bir-biridan
 * to'g'ridan-to'g'ri import qila olmaydi (faqat @repo/shared orqali),
 * shuning uchun bu ikkala ro'yxat qo'lda sinxron ushlab turilishi
 * kerak — biriga til qo'shilsa, ikkinchisiga ham qo'shilsin.
 * highlight.js kutubxonasi shu maqsadda bu yerda ham (frontend'da)
 * alohida ishlatilmoqda — bu yakuniy natija emas, faqat dropdown'ni
 * oldindan to'ldirish uchun tezkor taxmin; yakuniy, saqlanadigan til
 * baribir backend'dagi `detectLanguage()`/`highlightCode()` orqali
 * post yaratilganda qat'iylashadi.
 */

/** Avtomatik aniqlash tugagach dropdown'ni yangilashdan oldin kutish vaqti. */
const AUTO_DETECT_DEBOUNCE_MS = 500;

/** Avtomatik aniqlash ishga tushishi uchun kod kamida shuncha belgidan iborat bo'lishi kerak (juda qisqa kod ishonchli aniqlanmaydi). */
const MIN_CODE_LENGTH_FOR_DETECTION = 12;

interface LanguageOption {
  value: string;
  label: string;
}

/**
 * Dropdown'da ko'rsatiladigan tillar ro'yxati HAM, avtomatik aniqlash
 * uchun nomzodlar ro'yxati HAM shu yerdan olinadi — ikkalasi bir xil
 * bo'lishi kerak, aks holda avtomatik aniqlash dropdown'da yo'q
 * qiymat tanlab qo'yishi mumkin edi.
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "dart", label: "Dart" },
  { value: "scala", label: "Scala" },
  { value: "html", label: "HTML" },
  { value: "xml", label: "XML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "plaintext", label: "Oddiy matn" },
];

const CANDIDATE_LANGUAGES = LANGUAGE_OPTIONS.map((option) => option.value).filter(
  (value) => value !== "plaintext",
);

/**
 * Tanlangan tilga mos CodeMirror kengaytmasini qaytaradi.
 *
 * Ba'zi tillar uchun rasmiy `@codemirror/lang-*` paketi mavjud emas
 * (masalan Go, C#, Ruby) — bunday hollarda CodeMirror 5'dan meros
 * qolgan `@codemirror/legacy-modes` orqali `StreamLanguage.define()`
 * bilan ishlatiladi. Bu rasmiy lezer-grammatikalarga qaraganda
 * soddaroq (faqat token-darajasida) ishlaydi, lekin syntax-highlight
 * uchun yetarli.
 *
 * "graphql" backend'ning nomzod ro'yxatida bor, lekin bu yerda uning
 * uchun CodeMirror kengaytmasi ro'yxatga olinmagan — shunday til
 * tanlansa, muharrir shunchaki rangsiz (lekin qator raqamlari va
 * tahrirlash imkoniyati bilan) ishlayveradi.
 */
export function getLanguageExtension(language: string): Extension | null {
  switch (language) {
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ jsx: true, typescript: true });
    case "python":
      return python();
    case "java":
      return java();
    case "c":
    case "cpp":
      return cpp();
    case "rust":
      return rust();
    case "php":
      return php();
    case "html":
      return html();
    case "xml":
      return xml();
    case "css":
    case "scss":
      return css();
    case "json":
      return json();
    case "yaml":
      return yaml();
    case "markdown":
      return markdown();
    case "sql":
      return sql();
    case "csharp":
      return StreamLanguage.define(legacyCSharp);
    case "scala":
      return StreamLanguage.define(legacyScala);
    case "kotlin":
      return StreamLanguage.define(legacyKotlin);
    case "dart":
      return StreamLanguage.define(legacyDart);
    case "go":
      return StreamLanguage.define(legacyGo);
    case "bash":
      return StreamLanguage.define(legacyShell);
    case "ruby":
      return StreamLanguage.define(legacyRuby);
    case "swift":
      return StreamLanguage.define(legacySwift);
    case "dockerfile":
      return StreamLanguage.define(legacyDockerfile);
    default:
      return null;
  }
}

/**
 * Muharrirning tashqi ko'rinishi (chrome) — bordur, gutter foni,
 * shrift. Ilovaning qolgan qismidagi sokin, oq-qora minimal
 * uslubiga mos: syntax ranglari (githubLight) o'qish qulayligi
 * uchun zarur bo'lgan funksional tanlov, lekin atrofdagi ramka hech
 * qanday ortiqcha bezakka ega emas.
 */
const editorChromeTheme = EditorView.theme({
  "&": {
    fontSize: "13.5px",
  },
  ".cm-content": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    padding: "12px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#FAFAFA",
    borderRight: "1px solid #E5E5E5",
    color: "#9CA3AF",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#F0F0F0",
  },
  ".cm-activeLine": {
    backgroundColor: "#FAFAFA",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export interface CodePostEditorProps {
  /** Kod matnining o'zi (controlled — manba parent komponentda). */
  code: string;
  /** Kod o'zgarganda chaqiriladi. */
  onCodeChange: (code: string) => void;
  /** Hozir tanlangan til (controlled — manba parent komponentda). */
  language: string;
  /**
   * Til o'zgarganda chaqiriladi — bu ham foydalanuvchi dropdown'dan
   * qo'lda tanlaganda, ham (foydalanuvchi hali hech narsa tanlamagan
   * bo'lsa) avtomatik aniqlash yangi taxmin topganda ishga tushadi.
   */
  onLanguageChange: (language: string) => void;
  placeholder?: string;
  className?: string;
}

export function CodePostEditor({
  code,
  onCodeChange,
  language,
  onLanguageChange,
  placeholder = "Kodingizni shu yerga joylashtiring...",
  className,
}: CodePostEditorProps) {
  // Foydalanuvchi dropdown'dan qo'lda til tanlaganini kuzatib
  // turamiz — shundan keyin avtomatik aniqlash bu tanlovni endi
  // bosib o'tmaydi (backend'dagi "foydalanuvchi tanlovi ustunlik
  // qiladi" tamoyili bilan bir xil).
  const hasUserSelectedLanguage = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (hasUserSelectedLanguage.current) return;
    if (code.trim().length < MIN_CODE_LENGTH_FOR_DETECTION) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      setIsDetecting(true);
      try {
        const result = hljs.highlightAuto(code, CANDIDATE_LANGUAGES);
        if (result.language && result.language !== language) {
          onLanguageChange(result.language);
        }
      } finally {
        setIsDetecting(false);
      }
    }, AUTO_DETECT_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // `language` va `onLanguageChange` ataylab dependency ro'yxatidan
    // tashqarida qoldirildi — ular har render'da yangi identifikatorga
    // ega bo'lishi mumkin va bu debounce'ni keraksiz qayta ishga
    // tushirib yuborardi. Bizga faqat `code` o'zgarganda qayta ishlash
    // kerak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function handleLanguageSelect(nextLanguage: string) {
    hasUserSelectedLanguage.current = true;
    onLanguageChange(nextLanguage);
  }

  const extensions = useMemo(() => {
    const languageExtension = getLanguageExtension(language);
    return [
      editorChromeTheme,
      EditorView.lineWrapping,
      ...(languageExtension ? [languageExtension] : []),
    ];
  }, [language]);

  return (
    <div
      className={`overflow-hidden rounded-md border border-gray-300 bg-white ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="text-xs font-medium text-gray-500">
          {isDetecting ? "Til aniqlanmoqda..." : "Kod"}
        </span>

        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Dasturlash tilini tanlang</span>
          <select
            value={language}
            onChange={(event) => handleLanguageSelect(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CodeMirror
        value={code}
        onChange={onCodeChange}
        placeholder={placeholder}
        theme={githubLight}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: false,
          autocompletion: false,
        }}
        minHeight="240px"
        maxHeight="600px"
      />
    </div>
  );
}
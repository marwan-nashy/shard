import { FeatureFlags } from "../types";

export type { FeatureFlags };

export const DEFAULT_FEATURES: FeatureFlags = {
  graphView: true,
  canvasView: true,
  dailyNotes: true,
  vaultStats: true,

  sidebarSearch: true,
  sidebarTags: true,
  sidebarCalendar: true,
  sidebarTasks: true,
  sidebarBookmarks: true,

  formattingToolbar: true,
  voiceDictation: true,
  templates: true,
  versionHistory: true,
  mermaidDiagrams: true,
  mathLatex: true,
  documentExport: true,
  statusBar: true,
};

export interface FeatureMeta {
  key: keyof FeatureFlags;
  category: "views" | "sidebar" | "editor" | "tools";
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
}

export const FEATURE_METADATA: FeatureMeta[] = [
  // Views
  {
    key: "graphView",
    category: "views",
    name: "2D Graph View",
    nameAr: "عرض الشبكة ثنائي الأبعاد",
    description: "Force-directed visual network of connections and wikilinks across your notes.",
    descriptionAr: "شبكة مرئية تفاعلية للروابط والعلاقات بين جميع ملاحظاتك.",
  },
  {
    key: "canvasView",
    category: "views",
    name: "Infinite Visual Canvas",
    nameAr: "لوحة العمل اللانهائية (Canvas)",
    description: "Infinite 2D spatial canvas with movable cards, text blocks, and directional arrows.",
    descriptionAr: "مساحة بيضاء لانهائية لترتيب البطاقات والأفكار مع أسهم توجيهية.",
  },
  {
    key: "dailyNotes",
    category: "views",
    name: "Daily Notes & Journaling",
    nameAr: "الملاحظات اليومية وتدوين اليوميات",
    description: "Quick 1-click creation and opening of today's dated journal note.",
    descriptionAr: "إنشاء وفتح ملاحظة اليوم المؤرخة بنقرة واحدة لكتابة اليوميات والمذكرات.",
  },
  {
    key: "vaultStats",
    category: "views",
    name: "Vault Heatmap & Analytics",
    nameAr: "الخريطة الحرارية وإحصائيات المستودع",
    description: "52-week contribution heatmap, hub note detection, orphan note tracking, and word counts.",
    descriptionAr: "خريطة نشاط سنوية على مدار 52 أسبوعاً مع تحليل الملاحظات المحورية والأيتام.",
  },

  // Sidebar
  {
    key: "sidebarSearch",
    category: "sidebar",
    name: "Vault Search Tab",
    nameAr: "تبويب البحث في المستودع",
    description: "Full-text fuzzy search across all Markdown notes and content snippets.",
    descriptionAr: "بحث نصي شامل مع معاينة فورية داخل محتوى الملاحظات.",
  },
  {
    key: "sidebarTags",
    category: "sidebar",
    name: "Tags Explorer Tab",
    nameAr: "تبويب استعراض الوسوم (#Tags)",
    description: "Hierarchical tag explorer grouping notes by #tags and frequency count.",
    descriptionAr: "مستكشف لتنظيم وتصفح الملاحظات بحسب الوسوم وعدد تكرارها.",
  },
  {
    key: "sidebarCalendar",
    category: "sidebar",
    name: "Calendar Navigator Tab",
    nameAr: "تبويب تقويم الملاحظات",
    description: "Monthly calendar view to jump to any past or upcoming daily note.",
    descriptionAr: "تقويم شهري تفاعلي للانتقال الفوري إلى ملاحظة أي يوم.",
  },
  {
    key: "sidebarTasks",
    category: "sidebar",
    name: "Tasks Aggregator Tab",
    nameAr: "تبويب مجمّع المهام",
    description: "Vault-wide scanning and interactive toggling of all checklist items (- [ ] / - [x]).",
    descriptionAr: "فحص لجميع مهام المستودع وإمكانية إنجازها مباشرة من مكان واحد.",
  },
  {
    key: "sidebarBookmarks",
    category: "sidebar",
    name: "Bookmarks & Pinned Tab",
    nameAr: "تبويب الإشارات المرجعية والمثبتات",
    description: "Pinned quick-access list for your most important notes and canvases.",
    descriptionAr: "قائمة سريعة للوصول إلى أهم الملاحظات واللوحات المثبتة بمستودعك.",
  },

  // Editor & Formatting
  {
    key: "formattingToolbar",
    category: "editor",
    name: "Formatting Toolbar",
    nameAr: "شريط التنسيق العلوي",
    description: "Floating / top toolbar for bold, headers, callouts, and shortcuts. Hide for pure typewriter mode.",
    descriptionAr: "شريط أدوات للتنسيقات والعناوين والتنبيهات. يمكن إخفاؤه لتجربة كتابة خالية تماماً من المشتتات.",
  },
  {
    key: "mermaidDiagrams",
    category: "editor",
    name: "Mermaid.js Diagrams",
    nameAr: "مخططات Mermaid التفاعلية",
    description: "Live rendering of flowcharts, sequence diagrams, and class diagrams in Live Preview.",
    descriptionAr: "معاينة حية فورية للخرائط الانسيابية والمخططات داخل المحرر مباشرة.",
  },
  {
    key: "mathLatex",
    category: "editor",
    name: "KaTeX Math Equations",
    nameAr: "معادلات KaTeX الرياضية والعلمية",
    description: "Real-time client-side rendering for inline and block scientific LaTeX math equations.",
    descriptionAr: "معاينة فائقة السرعة للمعادلات والرموز الرياضية والعلمية بدقة عالية.",
  },
  {
    key: "statusBar",
    category: "editor",
    name: "Status Bar & Stats",
    nameAr: "شريط الحالة وإحصائيات القراءة",
    description: "Bottom bar showing word counts, character counts, reading time, and text direction.",
    descriptionAr: "شريط أسفل الشاشة يعرض عدد الكلمات والحروف وزمن القراءة التقريبي.",
  },

  // Power Tools
  {
    key: "voiceDictation",
    category: "tools",
    name: "Voice Dictation (Speech-to-Text)",
    nameAr: "الإملاء الصوتي (تحويل الصوت لكتابة)",
    description: "Microphone button to speak notes in Arabic or English with zero cloud bloat.",
    descriptionAr: "زر الميكروفون للكتابة بالصوت باللغتين العربية والإنجليزية محلياً بدون خوادم خارجية.",
  },
  {
    key: "templates",
    category: "tools",
    name: "Smart Templates Engine",
    nameAr: "محرك القوالب الذكية",
    description: "Dynamic note templates with auto-expanding date, time, and title variables.",
    descriptionAr: "قوالب ديناميكية جاهزة ومخصصة مع تعويض تلقائي للتاريخ والوقت والعناوين.",
  },
  {
    key: "versionHistory",
    category: "tools",
    name: "Note Revision History",
    nameAr: "سجل مراجعات الملاحظة",
    description: "Throttled automatic snapshots on edit with 1-click restore to any past version.",
    descriptionAr: "حفظ لقطات تلقائية أثناء التعديل مع إمكانية استعادة أي نسخة سابقة بنقرة واحدة.",
  },
  {
    key: "documentExport",
    category: "tools",
    name: "PDF & Standalone HTML Export",
    nameAr: "تصدير PDF و HTML المستقل",
    description: "Export clean print-ready documents or self-contained offline HTML with math styles.",
    descriptionAr: "تصدير مستندات مطبوعة نظيفة أو ملفات HTML مستقلة وقابلة للمشاركة.",
  },
];

const STORAGE_KEY = "shard_feature_flags";

export function loadFeatureFlags(): FeatureFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEATURES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FEATURES, ...parsed };
  } catch {
    return DEFAULT_FEATURES;
  }
}

export function saveFeatureFlags(flags: FeatureFlags): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch (err) {
    console.error("Failed to save feature flags:", err);
  }
}

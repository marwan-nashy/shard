export type Language = "en" | "ar";
export type TextDirection = "auto" | "rtl" | "ltr";

export interface Translations {
  ribbon: {
    brand: string;
    editor: string;
    quickSwitcher: string;
    graph: string;
    canvas: string;
    dailyNote: string;
    openVault: string;
    settings: string;
    directionToggle: string;
  };
  sidebar: {
    files: string;
    search: string;
    tags: string;
    outline: string;
    backlinks: string;
    newNote: string;
    newFolder: string;
    newCanvas: string;
    collapseAll: string;
    rename: string;
    delete: string;
    searchPlaceholder: string;
    filterTagsPlaceholder: string;
    noNotes: string;
    noResults: string;
    noTags: string;
    noHeadings: string;
    linkedMentions: string;
    unlinkedMentions: string;
    noBacklinks: string;
    notesCount: (count: number) => string;
  };
  quickSwitcher: {
    notesPlaceholder: string;
    commandsPlaceholder: string;
    noNotesFound: string;
    noCommandsFound: string;
    escHint: string;
    enterHint: string;
    navigateHint: string;
  };
  commands: {
    newNote: string;
    newFolder: string;
    newCanvas: string;
    dailyNote: string;
    toggleLivePreview: string;
    toggleSplit: string;
    openGraph: string;
    openCanvas: string;
    openSettings: string;
    switchVault: string;
    setDirAuto: string;
    setDirRTL: string;
    setDirLTR: string;
    switchLanguage: string;
  };
  statusBar: {
    ready: string;
    saved: string;
    saving: string;
    word: string;
    words: string;
    characters: string;
  };
  canvas: {
    addCard: string;
    addNote: string;
    save: string;
    reset: string;
    zoomIn: string;
    zoomOut: string;
    placeholder: string;
    deleteCard: string;
    changeColor: string;
    openFullNote: string;
    doubleClickHint: string;
  };
  graph: {
    searchPlaceholder: string;
    allTags: string;
    hideOrphans: string;
    reset: string;
    zoomIn: string;
    zoomOut: string;
  };
  settings: {
    title: string;
    general: string;
    appearance: string;
    language: string;
    plugins: string;
    features: string;
    featuresDesc: string;
    updates: string;
    checkForUpdates: string;
    checkingUpdates: string;
    upToDate: string;
    updateAvailable: string;
    downloadUpdate: string;
    autoCheckUpdates: string;
    resetFeatures: string;
    hotkeys: string;
    about: string;
    appLanguage: string;
    textDirection: string;
    dirAuto: string;
    dirRTL: string;
    dirLTR: string;
    autoSaveDesc: string;
    themeTitle: string;
    themeDesc: string;
    shortcutsTitle: string;
    shortcutsDesc: string;
    aboutDesc: string;
    aboutVersion: string;
    fontHint: string;
  };
  dialogs: {
    renameTitle: string;
    renamePrompt: string;
    confirm: string;
    cancel: string;
    deletePrompt: (name: string) => string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    ribbon: {
      brand: "Shard",
      editor: "Document Editor",
      quickSwitcher: "Quick Switcher (Ctrl+O / Ctrl+P)",
      graph: "Graph View (Ctrl+G)",
      canvas: "Visual Canvas",
      dailyNote: "Today's Daily Note",
      openVault: "Open Vault Folder",
      settings: "Settings (Ctrl+,)",
      directionToggle: "Text Direction (Auto / RTL / LTR)",
    },
    sidebar: {
      files: "Files",
      search: "Search",
      tags: "Tags",
      outline: "Outline",
      backlinks: "Backlinks",
      newNote: "New note",
      newFolder: "New folder",
      newCanvas: "New canvas",
      collapseAll: "Collapse all",
      rename: "Rename",
      delete: "Delete",
      searchPlaceholder: "Search notes...",
      filterTagsPlaceholder: "Filter tags...",
      noNotes: "No notes yet",
      noResults: "No results found",
      noTags: "No tags found in vault",
      noHeadings: "No headings found in this note",
      linkedMentions: "Linked Mentions",
      unlinkedMentions: "Unlinked Mentions",
      noBacklinks: "No backlinks found",
      notesCount: (count) => `${count} ${count === 1 ? "note" : "notes"}`,
    },
    quickSwitcher: {
      notesPlaceholder: "Type a note title to jump to...",
      commandsPlaceholder: "Type a command or search...",
      noNotesFound: "No matching notes found",
      noCommandsFound: "No matching commands found",
      escHint: "to dismiss",
      enterHint: "to select",
      navigateHint: "to navigate",
    },
    commands: {
      newNote: "Create new note",
      newFolder: "Create new folder",
      newCanvas: "Create new canvas",
      dailyNote: "Open today's daily note",
      toggleLivePreview: "Toggle Live Preview / Source mode",
      toggleSplit: "Toggle split view",
      openGraph: "Open 2D Graph View",
      openCanvas: "Open Visual Canvas",
      openSettings: "Open Settings",
      switchVault: "Switch or create vault",
      setDirAuto: "Text Direction: Auto (per-line detection)",
      setDirRTL: "Text Direction: Right to Left (RTL)",
      setDirLTR: "Text Direction: Left to Right (LTR)",
      switchLanguage: "Switch Language / تبديل اللغة (العربية)",
    },
    statusBar: {
      ready: "Ready",
      saved: "Saved",
      saving: "Saving...",
      word: "word",
      words: "words",
      characters: "characters",
    },
    canvas: {
      addCard: "Add Card",
      addNote: "Add Note",
      save: "Save Canvas",
      reset: "Reset View",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      placeholder: "Write note or ideas...",
      deleteCard: "Delete card",
      changeColor: "Change color",
      openFullNote: "Open full note",
      doubleClickHint: "Double-click anywhere to add a card",
    },
    graph: {
      searchPlaceholder: "Search nodes...",
      allTags: "All Tags",
      hideOrphans: "Hide Orphans",
      reset: "Reset View",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
    },
    settings: {
      title: "Settings",
      general: "General",
      appearance: "Appearance",
      language: "Language & Direction",
      plugins: "Core plugins",
      features: "Features & Modules",
      featuresDesc: "Customize Shard to your liking. Disable or hide any features you don't use for zero bloat.",
      updates: "Check for Updates",
      checkForUpdates: "Check for Updates",
      checkingUpdates: "Checking for updates...",
      upToDate: "You're on the latest version",
      updateAvailable: "New update available!",
      downloadUpdate: "Download Update",
      autoCheckUpdates: "Automatically check for updates on startup",
      resetFeatures: "Enable All Features",
      hotkeys: "Hotkeys",
      about: "About",
      appLanguage: "Application Language",
      textDirection: "Default Text Direction",
      dirAuto: "Auto (Detect per line from text)",
      dirRTL: "Right-to-Left (RTL - Arabic, Hebrew)",
      dirLTR: "Left-to-Right (LTR - English, Latin)",
      autoSaveDesc: "Notes are automatically saved on edit and debounced safely to local disk.",
      themeTitle: "Base Color Theme",
      themeDesc: "High-contrast dark charcoal theme with zero glare.",
      shortcutsTitle: "Keyboard Shortcuts",
      shortcutsDesc: "Modifiers strictly appear before letters.",
      aboutDesc: "Shard is a high-performance, zero-bloat local knowledge base and visual canvas designed for maximum speed and simplicity.",
      aboutVersion: "v0.1.0 (Native Release)",
      fontHint: "Arabic text renders with optimal Cairo, Segoe UI, and Tahoma typography.",
    },
    dialogs: {
      renameTitle: "Rename Note",
      renamePrompt: "Enter new note title:",
      confirm: "Rename",
      cancel: "Cancel",
      deletePrompt: (name) => `Are you sure you want to delete "${name}"?`,
    },
  },

  ar: {
    ribbon: {
      brand: "شارد",
      editor: "محرر المستندات",
      quickSwitcher: "التنقل السريع (Ctrl+O / Ctrl+P)",
      graph: "عرض الرسم البياني (Ctrl+G)",
      canvas: "اللوحة المرئية (الكانفاس)",
      dailyNote: "ملاحظة اليوم اليومية",
      openVault: "فتح مجلد الخزانة",
      settings: "الإعدادات (Ctrl+,)",
      directionToggle: "اتجاه النص (تلقائي / يمين / يسار)",
    },
    sidebar: {
      files: "الملفات",
      search: "البحث",
      tags: "الوسوم",
      outline: "المخطط",
      backlinks: "الروابط الخلفية",
      newNote: "ملاحظة جديدة",
      newFolder: "مجلد جديد",
      newCanvas: "كانفاس جديد",
      collapseAll: "طي الكل",
      rename: "إعادة تسمية",
      delete: "حذف",
      searchPlaceholder: "ابحث في الملاحظات...",
      filterTagsPlaceholder: "تصفية الوسوم...",
      noNotes: "لا توجد ملاحظات بعد",
      noResults: "لم يتم العثور على نتائج",
      noTags: "لا توجد وسوم في الخزانة",
      noHeadings: "لا توجد عناوين في هذه الملاحظة",
      linkedMentions: "إشارات مرتبطة",
      unlinkedMentions: "إشارات غير مرتبطة",
      noBacklinks: "لا توجد روابط خلفية",
      notesCount: (count) => `${count} ${count === 1 ? "ملاحظة" : "ملاحظات"}`,
    },
    quickSwitcher: {
      notesPlaceholder: "اكتب عنوان ملاحظة للانتقال إليها...",
      commandsPlaceholder: "اكتب أمرًا أو ابحث...",
      noNotesFound: "لم يتم العثور على ملاحظات مطابقة",
      noCommandsFound: "لم يتم العثور على أوامر مطابقة",
      escHint: "للإغلاق",
      enterHint: "للاختيار",
      navigateHint: "للتنقل",
    },
    commands: {
      newNote: "إنشاء ملاحظة جديدة",
      newFolder: "إنشاء مجلد جديد",
      newCanvas: "إنشاء كانفاس جديد",
      dailyNote: "فتح ملاحظة اليوم اليومية",
      toggleLivePreview: "تبديل المعاينة الحية / المصدر",
      toggleSplit: "تبديل العرض المزدوج",
      openGraph: "فتح عرض الرسم البياني 2D",
      openCanvas: "فتح الكانفاس المرئي",
      openSettings: "فتح الإعدادات",
      switchVault: "تبديل أو إنشاء خزانة",
      setDirAuto: "اتجاه النص: تلقائي (حسب كل سطر)",
      setDirRTL: "اتجاه النص: من اليمين لليسار (RTL)",
      setDirLTR: "اتجاه النص: من اليسار لليمين (LTR)",
      switchLanguage: "Switch Language / تبديل اللغة (English)",
    },
    statusBar: {
      ready: "جاهز",
      saved: "تم الحفظ",
      saving: "جارٍ الحفظ...",
      word: "كلمة",
      words: "كلمات",
      characters: "أحرف",
    },
    canvas: {
      addCard: "إضافة بطاقة",
      addNote: "إضافة ملاحظة",
      save: "حفظ الكانفاس",
      reset: "إعادة ضبط العرض",
      zoomIn: "تكبير",
      zoomOut: "تصغير",
      placeholder: "اكتب ملاحظات أو أفكار...",
      deleteCard: "حذف البطاقة",
      changeColor: "تغيير اللون",
      openFullNote: "فتح الملاحظة كاملة",
      doubleClickHint: "انقر مرتين في أي مكان لإضافة بطاقة",
    },
    graph: {
      searchPlaceholder: "ابحث في العقد...",
      allTags: "كافة الوسوم",
      hideOrphans: "إخفاء العقد المنعزلة",
      reset: "إعادة ضبط",
      zoomIn: "تكبير",
      zoomOut: "تصغير",
    },
    settings: {
      title: "الإعدادات",
      general: "عام",
      appearance: "المظهر",
      language: "اللغة والاتجاه",
      plugins: "الملحقات الأساسية",
      features: "الميزات والوحدات",
      featuresDesc: "خصص شارد وفقاً لأسلوبك. يمكنك إخفاء أو تعطيل أي ميزة لا تحتاجها للحصول على تجربة نقية بدون أي زيادة.",
      updates: "التحقق من التحديثات",
      checkForUpdates: "التحقق من التحديثات الآن",
      checkingUpdates: "جارٍ التحقق من التحديثات...",
      upToDate: "أنت تستخدم أحدث إصدار متوفر",
      updateAvailable: "يوجد إصدار أحدث متاح للتحميل!",
      downloadUpdate: "تنزيل التحديث",
      autoCheckUpdates: "التحقق التلقائي من التحديثات عند بدء التشغيل",
      resetFeatures: "تفعيل كافة الميزات",
      hotkeys: "اختصارات المفاتيح",
      about: "حول شارد",
      appLanguage: "لغة التطبيق",
      textDirection: "اتجاه النص الافتراضي للمحرر",
      dirAuto: "تلقائي (اكتشاف ذكي لاتجاه كل سطر)",
      dirRTL: "من اليمين إلى اليسار (RTL - العربية والعبرية)",
      dirLTR: "من اليسار إلى اليمين (LTR - الإنجليزية واللاتينية)",
      autoSaveDesc: "تُحفظ الملاحظات تلقائيًا وبسرعة فائقة على القرص المحلي بدون انقطاع.",
      themeTitle: "سمة الألوان الأساسية",
      themeDesc: "سمة الفحم الداكن عالية التباين ومريحة للعين.",
      shortcutsTitle: "اختصارات لوحة المفاتيح",
      shortcutsDesc: "المفاتيح التعديلية تسبق الحروف دائمًا.",
      aboutDesc: "شارد (Shard) قاعدة معرفية شخصية فائقة الخفة والسرعة تعمل محليًا وبدون استهلاك متصفحات إلكترون.",
      aboutVersion: "الإصدار 0.1.0 (إصدار محلي)",
      fontHint: "تُعرض النصوص العربية بأعلى وضوح باستخدام خطوط Cairo و Segoe UI و Tahoma.",
    },
    dialogs: {
      renameTitle: "إعادة تسمية الملاحظة",
      renamePrompt: "أدخل الاسم الجديد للملاحظة:",
      confirm: "إعادة تسمية",
      cancel: "إلغاء",
      deletePrompt: (name) => `هل أنت متأكد من رغبتك في حذف "${name}"؟`,
    },
  },
};

/** Tailwind class maps for the worker mobile dashboard. */
export const workerStyles = {
  root: "min-h-screen bg-muted/40 flex flex-col items-center font-sans",
  shell: "w-full max-w-md min-h-screen flex flex-col bg-muted/40",
  header:
    "sticky top-0 z-50 bg-gradient-to-br from-slate-800 to-emerald-900 px-4 shadow-md",
  headerInner: "flex items-center justify-between py-3.5",
  logo: "flex items-center gap-2.5",
  logoIcon:
    "flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/15",
  logoName: "font-serif text-lg text-white tracking-tight",
  logoAccent: "text-emerald-300",
  logoutBtn:
    "flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20",
  main: "flex flex-1 flex-col gap-5 px-4 py-5 pb-10",
  summaryGrid: "grid grid-cols-2 gap-2.5",
  summaryTile: "rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm",
  summaryValue:
    "font-serif text-2xl text-emerald-800 dark:text-emerald-300 min-h-7",
  summaryLabel: "text-xs text-muted-foreground",
  sectionHead: "mb-3 flex items-center gap-2",
  sectionTitle: "font-serif text-lg text-foreground",
  sectionCount:
    "inline-flex min-h-5 items-center justify-center rounded-full bg-emerald-800 px-2 text-[11px] font-bold text-emerald-100",
  orderGroup: "space-y-2.5",
  orderGroupHeader:
    "sticky top-[60px] z-10 rounded-lg border border-border/80 bg-card/95 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm",
  orderGroupMeta: "text-xs font-normal text-muted-foreground",
  taskList: "flex flex-col gap-3",
  taskCard:
    "rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
  taskCardUnlocked: "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20",
  taskCardHeader: "mb-3 flex items-start justify-between gap-3",
  taskCardBody: "min-w-0 flex-1",
  stepBadge:
    "mb-1.5 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
  taskName: "text-[15px] font-semibold text-foreground leading-snug",
  taskOrder: "mt-0.5 text-xs text-muted-foreground",
  startBtn:
    "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  formCard:
    "overflow-hidden rounded-2xl border-2 border-emerald-500 bg-card shadow-lg",
  formHeader: "bg-gradient-to-br from-slate-800 to-emerald-900 px-4 py-4",
  backBtn:
    "mb-2 flex items-center gap-1 text-sm text-white/80 transition-colors hover:text-white",
  formTitle: "font-serif text-lg text-white",
  formOrder: "mt-0.5 text-xs text-white/60",
  timerPill:
    "mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5",
  timerValue: "font-serif text-base text-white tabular-nums",
  timerHint: "text-[11px] text-white/50",
  formBody: "flex flex-col gap-3.5 p-4",
  formField: "flex flex-col gap-1.5",
  formLabel: "text-xs font-semibold uppercase tracking-wide text-foreground/80",
  formInput:
    "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
  formSelect:
    "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
  formTextarea:
    "w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
  readonlyInput:
    "h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3.5 text-sm font-semibold text-muted-foreground",
  twoCol: "grid grid-cols-2 gap-2.5",
  hintText: "text-xs text-muted-foreground",
  rollBanner:
    "rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  unlockBanner:
    "rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  secondaryBtn:
    "flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/50 text-sm text-muted-foreground hover:border-emerald-500 hover:bg-emerald-50/50",
  submitBtn:
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
  loadingBox:
    "flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground",
  fieldError: "text-xs text-destructive",
  inputError:
    "border-destructive focus:border-destructive focus:ring-destructive/20",
  uploadBox:
    "rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 transition hover:border-emerald-500 hover:bg-emerald-50/50",

  uploadButton:
    "flex w-full flex-col items-center justify-center gap-2 rounded-xl py-6 text-center cursor-pointer",

  uploadIcon:
    "flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl",

  uploadTitle: "text-sm font-semibold text-foreground",

  uploadHint: "text-xs text-muted-foreground",

  uploadPreview:
    "relative mt-3 overflow-hidden rounded-xl border bg-background",

  uploadImage: "h-48 w-full object-cover",

  uploadBadge:
    "absolute right-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white",

  replaceUploadBtn:
    "mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background text-sm font-medium hover:border-emerald-500",
};

export const statusBadgeStyles = {
  READY:
    "inline-flex min-h-6 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2.5 text-[11px] font-semibold leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_PROGRESS:
    "inline-flex min-h-6 shrink-0 items-center justify-center rounded-full bg-blue-100 px-2.5 text-[11px] font-semibold leading-none text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  UNLOCKED:
    "inline-flex min-h-6 shrink-0 items-center justify-center rounded-full bg-amber-100 px-2.5 text-[11px] font-semibold leading-none text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export const STATUS_LABELS = {
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  UNLOCKED: "Unlocked",
};

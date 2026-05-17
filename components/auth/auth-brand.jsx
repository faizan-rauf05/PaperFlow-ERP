import { Factory, Leaf } from "lucide-react";

export function AuthBrand({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl auth-logo-glow"
          aria-hidden
        />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/35 ring-1 ring-white/25 sm:h-14 sm:w-14">
          <Factory className="h-7 w-7 text-primary-foreground sm:h-8 sm:w-8" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary sm:text-xs">
          <Leaf className="h-3 w-3" aria-hidden />
          Paper bag manufacturing
        </p>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function AuthBackground() {
  return (
    <>
      <div
        className="auth-blob pointer-events-none absolute -left-20 top-8 h-48 w-48 rounded-full bg-primary/25 blur-3xl sm:h-64 sm:w-64"
        aria-hidden
      />
      <div
        className="auth-blob auth-blob-delayed pointer-events-none absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-primary/20 blur-3xl sm:h-72 sm:w-72"
        aria-hidden
      />
      <div
        className="auth-blob auth-blob-slow pointer-events-none absolute left-1/2 top-[38%] h-36 w-36 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl"
        aria-hidden
      />
    </>
  );
}

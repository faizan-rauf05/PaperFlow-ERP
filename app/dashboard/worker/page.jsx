"use client";

import { useRouter } from "next/navigation";
import { LogOut, Factory } from "lucide-react";
import { workerStyles } from "./worker-dashboard.styles";

/**
 * Worker stage recording is deferred — stages are recorded from Admin production detail.
 */
export default function WorkerMobileDashboard() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className={workerStyles.page}>
      <header className={workerStyles.header}>
        <div className="flex items-center gap-2">
          <Factory size={17} className="text-white" />
          <span className="font-semibold text-white">PaperFlow Worker</span>
        </div>
        <button type="button" onClick={handleLogout} className={workerStyles.logoutBtn}>
          <LogOut size={15} />
          Sign out
        </button>
      </header>
      <main className="p-4 space-y-3">
        <h1 className="text-xl font-bold">Stage recording moved</h1>
        <p className={workerStyles.hintText}>
          Production stages are recorded from the Admin panel (Record input / Preview).
          Worker mobile recording will return in a later update.
        </p>
      </main>
    </div>
  );
}

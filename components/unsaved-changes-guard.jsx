"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Leave-page guard for a form page with unsaved changes. Covers the
 * browser's own reload/close (native prompt) and in-app <a>/<Link> clicks
 * such as the sidebar — intercepted in the capture phase, before Next's
 * Link handler runs, and routed through a confirm dialog instead.
 *
 * Returns:
 * - `leaveTo(href)`: navigate without asking (e.g. after a successful save)
 * - `requestLeave(href)`: navigate, confirming first if there are changes (e.g. Cancel)
 * - `dialog`: the confirm dialog element — render it once in the page
 *
 * Not covered: the browser Back button (the App Router has no way to block it).
 */
export function useUnsavedChangesGuard(isDirty, { noun = "this form" } = {}) {
  const router = useRouter();
  const allowLeaveRef = useRef(false);
  const [pendingHref, setPendingHref] = useState(null);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e) {
      if (allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function handleClickCapture(e) {
      if (allowLeaveRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // opens a new tab/window
      const anchor = e.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [isDirty]);

  const leaveTo = useCallback(
    (href) => {
      allowLeaveRef.current = true;
      router.push(href);
    },
    [router],
  );

  const requestLeave = useCallback(
    (href) => (isDirty ? setPendingHref(href) : leaveTo(href)),
    [isDirty, leaveTo],
  );

  const dialog = (
    <AlertDialog open={!!pendingHref} onOpenChange={(open) => !open && setPendingHref(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have changes on {noun} that haven&apos;t been saved. Leaving now will lose them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => leaveTo(pendingHref)}
            className="bg-destructive text-destructive-foreground"
          >
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { leaveTo, requestLeave, dialog };
}

/** Brings the topmost field with an error inside `container` into view — FieldError renders role="alert". */
export function scrollToFirstError(container) {
  requestAnimationFrame(() => {
    const field = container?.querySelector('[role="alert"]')?.parentElement;
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field
      .querySelector("input:not([type=hidden]), textarea, button[role=combobox]")
      ?.focus({ preventScroll: true });
  });
}

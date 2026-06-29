"use client";

import { Toast } from "@base-ui/react/toast";
import { Check, TriangleAlert, Info, X } from "lucide-react";
import { AgentAvatar } from "@/components/identity";
import { cn } from "@/lib/utils";
import { wovenToasts } from "@/lib/notifications";

// The lead glyph: the agent's squircle when the agent acted, otherwise a quiet status mark.
function Lead({ type }: { type?: string }) {
  if (type === "agent") return <AgentAvatar size="md" />;
  const map = {
    success: { icon: <Check className="size-4" />, cls: "bg-primary/10 text-primary" },
    error: { icon: <TriangleAlert className="size-3.5" />, cls: "bg-destructive/10 text-destructive" },
    info: { icon: <Info className="size-3.5" />, cls: "bg-muted text-muted-foreground" },
  } as const;
  const v = map[type as keyof typeof map] ?? map.info;
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", v.cls)}>
      {v.icon}
    </span>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root
      key={t.id}
      toast={t}
      className={cn(
        // width hugs the content (no fixed 360px → no dead space); icon + actions vertically centered
        "group flex w-auto max-w-[min(380px,calc(100vw-2rem))] select-none items-center gap-3",
        "rounded-xl border bg-popover bg-clip-padding py-3 pr-2.5 pl-3.5 text-popover-foreground shadow-lg",
        "transition-all duration-300 ease-out",
        "data-starting-style:translate-x-full data-starting-style:opacity-0",
        "data-ending-style:translate-x-full data-ending-style:opacity-0",
      )}
    >
      <Lead type={t.type} />
      <div className="min-w-0">
        <Toast.Title className="text-sm font-medium leading-snug">{t.title}</Toast.Title>
        {t.description ? (
          <Toast.Description
            className={cn(
              "mt-0.5 leading-snug text-muted-foreground",
              t.type === "agent" ? "font-mono text-[11px]" : "text-[12px]",
            )}
          >
            {t.description}
          </Toast.Description>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {t.actionProps ? (
          <Toast.Action className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10" />
        ) : null}
        <Toast.Close
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </Toast.Close>
      </div>
    </Toast.Root>
  ));
}

// Mount once near the app root. Self-contained: provider (bound to the global manager) + a
// portaled bottom-right viewport. Calm by default — 3 max, slide in from the right.
export function WovenToaster() {
  return (
    <Toast.Provider toastManager={wovenToasts} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2.5 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

import Link from "next/link";
import { ArrowLeft, FileQuestion, Lock, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WovenMark } from "@/components/woven-mark";
import { PAGE_FRAME } from "@/lib/frame";
import { cn } from "@/lib/utils";

type SystemStateVariant = "not-found" | "no-access" | "error";
type SystemStateScope = "app" | "reader" | "public";
type SystemStateAction =
  | { href: string; label: string }
  | { onClick: () => void; label: string };

const CONTENT = {
  "not-found": {
    icon: FileQuestion,
    title: "Not found",
    body: "This page is not available at this link.",
  },
  "no-access": {
    icon: Lock,
    title: "Restricted",
    body: "You don’t have access to this content.",
  },
  error: {
    icon: TriangleAlert,
    title: "This page could not load",
    body: "Try again to reload this page.",
  },
} as const;

// One grammar for absence, access and failure. This lifts the reader's existing MissingArtifact
// treatment rather than inventing a new failure-page brand. The surrounding route still owns its
// chrome: app states sit INSIDE SidebarInset's <main>; reader and public states supply their own.
// Public states never name a private object or distinguish its absence from restricted access.
// Navigation and retry do not ratify anything, so both stay neutral. The public mark stays in the
// quiet footer, following the current public register; the old forest-disc header was retired.
export function SystemState({
  variant,
  scope = "app",
  title,
  body,
  action,
}: {
  variant: SystemStateVariant;
  scope?: SystemStateScope;
  title?: string;
  body?: string;
  action: SystemStateAction;
}) {
  const content = CONTENT[variant];
  const Icon = content.icon;
  const Container = scope === "app" ? "section" : "main";

  return (
    <Container
      aria-labelledby="system-state-title"
      data-system-state={variant}
      className={cn("flex flex-1 flex-col bg-background", scope !== "app" && "min-h-svh")}
    >
      <div className={cn(PAGE_FRAME.focused, "flex min-h-[70vh] flex-1 items-center justify-center")}>
        <div className="w-full max-w-md text-center">
          <span aria-hidden="true" className="mx-auto flex size-10 items-center justify-center rounded-md bg-tint-1 text-muted-foreground">
            <Icon className="size-5" />
          </span>
          <h1 id="system-state-title" className="mt-4 text-2xl font-medium">{title ?? content.title}</h1>
          <p className="mt-2 text-base text-muted-foreground">{body ?? content.body}</p>
          <div className="mt-5">
            {"href" in action ? (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11 whitespace-normal md:min-h-0"
                nativeButton={false}
                render={<Link href={action.href} />}
              >
                <ArrowLeft className="size-4" aria-hidden="true" /> {action.label}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" className="min-h-11 whitespace-normal md:min-h-0" onClick={action.onClick}>
                {action.label}
              </Button>
            )}
          </div>
        </div>
      </div>
      {scope === "public" ? (
        <footer className={cn(PAGE_FRAME.focused, "pt-0 md:pt-0")}>
          <span className="flex items-center gap-1.5 border-t pt-6 text-xs text-muted-foreground">
            <WovenMark className="h-2.5 w-auto" /> Woven
          </span>
        </footer>
      ) : null}
    </Container>
  );
}

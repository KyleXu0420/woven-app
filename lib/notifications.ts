"use client";

// The toast system, in two layers:
//   • this file — the manager + the app's *toast vocabulary*. When a new interaction needs a
//     toast, add ONE named entry to `toasts` below; callers stay one-liners and the copy lives here.
//   • components/ui/toast.tsx — the visual rendering (WovenToaster + the Woven-styled toast).

import * as React from "react";
import { Toast } from "@base-ui/react/toast";

// One global manager so any client island can raise a toast without prop-drilling.
export const wovenToasts = Toast.createToastManager();

type Variant = "success" | "agent" | "error" | "info";
type Action = { label: string; onClick: () => void };
type Opts = {
  description?: React.ReactNode;
  action?: Action;
  duration?: number; // ms; 0 = stays until dismissed
  id?: string;
};

function raise(type: Variant, title: React.ReactNode, opts: Opts = {}) {
  // undo-able toasts linger a little longer so there's time to reach for Undo
  const timeout = opts.duration ?? (opts.action ? 6000 : 4500);
  return wovenToasts.add({
    title,
    type,
    description: opts.description,
    timeout,
    id: opts.id,
    actionProps: opts.action
      ? { children: opts.action.label, onClick: opts.action.onClick }
      : undefined,
  });
}

// The general API — a forest check for user-driven success, the agent squircle for agent-done work.
export const notify = {
  success: (title: React.ReactNode, opts?: Opts) => raise("success", title, opts),
  agent: (title: React.ReactNode, opts?: Opts) => raise("agent", title, opts),
  error: (title: React.ReactNode, opts?: Opts) => raise("error", title, opts),
  info: (title: React.ReactNode, opts?: Opts) => raise("info", title, opts),
  dismiss: (id?: string) => wovenToasts.close(id),
};

// ——————————————————————————————————————————— the app's toast vocabulary
// One named entry per action that earns a toast. Add here as new operations land.

export const toasts = {
  // trust valve (Inbox + artifact structure rail)
  linkConfirmed: (desc?: string, undo?: Action) =>
    notify.success("Link confirmed", { description: desc, action: undo }),
  proposalDismissed: (desc?: string, undo?: Action) =>
    notify.info("Proposal dismissed", { description: desc, action: undo }),
  linksConfirmed: (n: number, undo?: Action) =>
    notify.success(`${n} link${n > 1 ? "s" : ""} confirmed`, { action: undo }),
  reviewResolved: (action: string, title: string, undo?: Action) =>
    notify.success(action, { description: title, action: undo }),

  // conversational edit
  editApplied: (heading?: string) => notify.success("Edit applied", { description: heading }),
  editDismissed: () => notify.info("Proposal dismissed"),

  // agent-completed work — the agent variant (squircle + mono voice)
  wovenIn: (title: string, open?: Action) =>
    notify.agent("Woven in", { description: title, action: open }),

  // publish
  published: (url: string, view?: Action) =>
    notify.success("Published", { description: url, action: view }),
};

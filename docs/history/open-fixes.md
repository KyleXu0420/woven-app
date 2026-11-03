# Open fixes

> What this is: two implementation lists that are still partly open, the P0 fix plan of 2026-08-14 and the fix backlog of 2026-09-04, merged into one file, plus a short list found on 2026-11-03. `docs/roadmap.md` holds their place in the order. The older text is the original Chinese.
> Status: live reference. Step 1 (Fixes 1–3) completed on 2026-11-03; remaining backlog retains its dated audit. Line numbers in historical text are not current locations.

## Step 1 resolution (2026-11-03)

| Item | Status | Current implementation |
|---|---|---|
| Fix 1: Decision record availability | complete | `decisionRecord` projects activation observations separately. An absent or inaccessible exact proof no longer hides the whole Decision. Inaccessible ref IDs are removed from the returned view; `decisionTruth` uses that same projection. Canonical evidence and verification state stay unchanged. All five seed Decisions render. |
| Fix 2: collection route resolution | complete | `findCollectionBySlug` resolves exactly and checks the viewer. The page waits for browser-local hydration before declaring a slug missing. Unknown slugs show Collection not found inside the shell; newly created local collections survive direct reload. |
| Fix 3: shared system states | complete | `SystemState` serves not-found, no-access and error in app, reader and public scopes. Each state has a real return or retry action. Root, app, Decision and Artifact boundaries share it; the global boundary supplies its own document. |

Verification is recorded in [Step 1 verification](2026-11-03-step-1-verification.md).
These are bug priorities, separate from action IDs P0.1–P0.7 in the roadmap.

### Corrections to the historical proposal below

The August plan below is a **closed historical record**, not an implementation recipe or a set of pending approvals. Current code and the reference docs take precedence:

- The internal collection missing state is **HTTP 200 after client hydration**, not HTTP 404. The server cannot distinguish an unknown slug from a valid browser-local collection. An immediate server/render-time `notFound()` would reject valid local collections on reload. The strict accessor guards the route; the old fallback helper signature and the separate sidebar shim remain deferred debt.
- The reader retains the existing **Version not found** wording. Restricted is an internal reader state with no artifact metadata. Public pages keep restricted and missing indistinguishable; `/c` retains its existing not-published state.
- Shared states use the current type rungs, radius tokens, neutral shared Button and `PAGE_FRAME`. The public mark is the current quiet footer; the proposed forest-disc header was superseded by the locked brand direction.
- Every state requires a functioning action. No placeholder Request access action was introduced. Retry must issue a new server request as well as recover client failures; clearing an error alone is insufficient.
- Loading standardization, EmptyState, the fallback-helper refactor, broader authorization and lifecycle work remain outside Step 1.

## Found by the hand-off test (2026-11-03)

These came out of the cold-agent test of `AGENTS.md`. They are read from the code at `84a4bb8` and were not reproduced in a browser. They belong with step 6 of the open list in `docs/roadmap.md`.

- **The Library's "Recent" sort sorts nothing.** `app/(app)/library/page.tsx:528-530` has branches for "Name" and "Most linked" only, so "Recent", the default, shows seed order. Sort by a real signal, or rename it.
- **Relative-time labels have no one reader.** `Artifact.updated` holds `now`, `just now` and forms from `17m` to `2mo`.
  - `agoMinutes` (`lib/api.ts:2590`) reads `now`, `m`, `h` and `d`. Anything else returns `Number.MAX_SAFE_INTEGER`, so `just now`, `3w` and `2mo` all sort as oldest.
  - `daysAgo` (`app/(app)/library/page.tsx:80`) reads `just now`, `m`, `h`, `d`, `w`, `mo` and `y`, and folds `m` and `h` to 0 days. It does not read `now`, which falls to 9999, so a fresh capture drops out of the This week, This month and This quarter facets.
  - `ageOf` (`app/c/[slug]/page.tsx:51`) wraps `agoMinutes` to catch `just now`.
  - Make one helper in `lib/text.ts` with minute precision over the whole vocabulary, and move all three onto it. `viewerRecents` and `recentEpisodes` sort on `agoMinutes`, so their order can change. Re-run `scripts/home.test.mjs`.
- **A stale keycap comment.** The comment at `components/artifact-graph-overlay.tsx:227` says every other `<kbd>` is mono. They are sans. The owner's keycap call decides what happens to the line below it.

## Historical P0 fix plan (2026-08-14, closed)

- 性质:已关闭的历史实施提案。代码块为当时拟案；当前落地事实及差异见上方 Step 1 resolution，不可直接照抄。
- 来源:2026-08-14 产品审查的三个 P0,当时已对真实代码逐行核实。
- 范围:仅 P0。
- 落地方式建议:三个 change 各自一个 commit。全程 `npx tsc --noEmit` 必须绿,再按文末验证清单逐条过。

## 0. 为什么是这三条 + 落地顺序

三个 P0 都不是「样式不好看」,而是**主连续性旅程被打断 / 违反「当下为真」契约**:

| P0 | 一句话 | 断在哪 | 契约违反 |
|---|---|---|---|
| **P0-1** | 5 个 Decision 态有 2 个 404 | `lib/api.ts:905` 整记录硬失败 | 主旅程 2/5 不可达 |
| **P0-2** | 乱写 collection slug 静默渲染 Q4 Roadmap | `lib/api.ts:145` `?? collections[0]` | 「当下为真」被伪造 |
| **P0-3** | 系统/失败态碎片化,「不存在/无权/出错」三义合一且半数掉出外壳 | 全仓无 `not-found.tsx`/`error.tsx` | 无统一系统态语法 |

**落地顺序(有依赖关系,勿颠倒)**:

1. **先建共享原语** `components/system-state.tsx`(P0-3 的地基)——P0-2 的路由守卫和 P0-3 的 decision 页拆分都要用它。
2. **P0-1**:`decisionRecord()` 逐项降级(纯 lib 改,零 UI,零依赖)。可与第 1 步并行。
3. **P0-2**:内部 collection 路由加守卫(依赖第 1 步的 `app/(app)/not-found.tsx`)。
4. **P0-3 其余**:各路由组的边界文件 + 调用点接入 + decision 页三义拆分。

---

## Change 1 · P0-1 — Decision 记录逐项降级,消灭 de_sms / de_cadence 的 404

### 根因(已坐实)
`decisionRecord()`(`lib/api.ts:898–918`)在 line 905 有一条**整记录**硬失败门:

```ts
const decisionActivation = activationEvidence.filter((item) => item.decision_id === decisionId);
if (decisionActivation.some((item) => !activationEvidenceRefIsVisible(item, viewer))) return undefined;
```

而 `activationEvidenceRefIsVisible`(`lib/api.ts:851–855`)第一行 `if (!item.evidence_ref_id) return false;`——凡是「只有 external_id、没有快照 ref」的 connector 观测都会让它返回 false。seed 里 `ae_sms_merge`(de_sms)、`ae_cadence_merge`/`ae_cadence_production`(de_cadence)**都没有 `evidence_ref_id`**(`lib/data.ts:296–374`),于是 `.some()` 为真 → 整记录 undefined → `app/decision/[id]/page.tsx:11` `notFound()` → 裸 404。

对照:`de_embargo` 的 `ae_embargo_publish` 是唯一带 `evidence_ref_id` 的行,所以它能渲染;`de_digest`/`de_sms_v1` 没有 activation 行,也能渲染。**line 905 是唯一挡住这两个态的东西。**

关键点:下游 `decisionTruth()`(`api.ts:984–999`)和 `components/decision-detail.tsx`(66–73、192–199、240–248、255–272)**本来就完整实现了「exact activation proof unavailable / 按 unverified 处理」的逐项降级路径**。也就是说展示层早就会优雅处理「快照不可用」,只有记录构造器在过严地硬失败。

### 改动 — `lib/api.ts`,`decisionRecord()` 内

**Before(904–905):**
```ts
const decisionActivation = activationEvidence.filter((item) => item.decision_id === decisionId);
if (decisionActivation.some((item) => !activationEvidenceRefIsVisible(item, viewer))) return undefined;
```

**After:**
```ts
// Fail closed PER OBSERVATION, never on the whole record: an activation observation with no
// viewer-visible snapshot ref (connector evidence located only by external_id, or a ref into a
// restricted space) keeps its identity but has its locator stripped, so no restricted href leaks.
// The truth layer + decision-detail already render this as "exact activation proof unavailable".
// Do NOT reinstate a whole-record `return undefined` guard here — that 404s de_sms / de_cadence.
const decisionActivation = activationEvidence
  .filter((item) => item.decision_id === decisionId)
  .map((item) =>
    item.evidence_ref_id && !activationEvidenceRefIsVisible(item, viewer)
      ? { ...item, evidence_ref_id: undefined }
      : item,
  );
```

### 影响面 / 安全性
- **仅一处调用**:`activationEvidenceRefIsVisible` 只在 line 905 被调用(grep 确认),call-site 改动不会波及其它消费者。函数本身**不改**。
- **安全posture 不变**:真正不可见的 ref(如指向受限 `a_comp` 的)在离开 `decisionRecord` 前就被剥掉 `evidence_ref_id`,不会泄露受限快照 href;该观测只显示为「proof unavailable」。
- **状态正确性不变**:`decisionState()`(875–896)读的是模块级原始 `activationEvidence` 数组、且经 `activationEvidenceRefIsExact()` 判定,ref-less/redacted 项本就按「未确认」处理——与今日一致。de_sms 仍 `waiting_activation`,de_cadence 仍 `needs_revalidation`。
- **无需改动**:`page.tsx`、`decision-detail.tsx`、`decisionState`、`decisionTruth` 都已能处理降级项。`listDecisionRecords`/`generateStaticParams` 现在会自动包含这两个 id,静态预渲染也覆盖。
- **零 UI / 零新卡片 / 零新路由**——符合 minimize-cards 与 forest=chrome-only 教条。

---

## Change 2 · P0-2 — 内部 collection 路由 fail-closed(乱写 slug 不再伪造 Q4 Roadmap)

### 根因(已坐实)
`lib/api.ts:144–146`:
```ts
export function collectionBySlug(slug: string): Collection {
  return collections.find((c) => c.slug === slug) ?? collections[0];   // ← 掩盖:未知 slug 返回第一个集合
}
```
`app/(app)/collection/[slug]/page.tsx:261` `const meta = collectionBySlug(slug);` → 乱写 slug 静默渲染 `collections[0]`(Q4 Roadmap),HTTP 200。

### 收窄结论(重要)
- 公开路由 `app/c/[slug]/page.tsx:27–40` **已经 fail-closed**(`listCollections().find(...)` + `if (!meta || !meta.public)`)——P0-2 **不影响公开面**。
- 因此 P0-2 只需修**内部 `/collection/[slug]` 这一个用户可从 URL 直达的面**。
- `collectionBySlug` 的其余内部调用点(`api.ts:307/2391/2432/2447/2452/2802`)**都只被已解析出的合法 `meta.slug` 调用**,不吃原始 URL。故守住这两个路由后,掩盖 helper 在实践中不再被坏 slug 命中。→ **本 pass 不改 helper 签名,避免 7 处波及。**

### 改动 — `app/(app)/collection/[slug]/page.tsx`(客户端组件)

**加 import:**
```ts
import { notFound } from "next/navigation";
// listCollections 已在该文件的 "@/lib/api" import 块中?若无则加入
```

**Before(259–261):**
```ts
export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const meta = collectionBySlug(slug);
```

**After:**
```ts
export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  // Fail closed: an unknown slug is a not-found, never a silent fallback to collections[0].
  // Mirrors the public /c/[slug] route's strict resolution. notFound() here resolves to
  // app/(app)/not-found.tsx (Change 3), so it renders inside app chrome at HTTP 404.
  const meta = listCollections().find((c) => c.slug === slug);
  if (!meta) notFound();
```

> `notFound()` 在客户端组件的 render 期调用是 Next App Router 支持的(抛 `NEXT_NOT_FOUND`,由最近的 `not-found` 边界捕获)。下方 `meta.slug` / `meta.id` 等在 `if (!meta) notFound()` 后类型收窄为非空,`collectionContents(meta.slug)` 等内部调用收到合法 slug,行为正确。

### 明确排除本 pass(记为 P1 硬化,勿在 P0 里做)
- 将 `collectionBySlug` 改为返回 `Collection | undefined` 并守卫 7 个调用点——结构上更正确(去掉 landmine),但属独立较大改动,不进 P0。
- `lib/collections.ts:16` 的第二个 `collectionBySlug`(sidebar shim,`?? COLLECTIONS[0]`)只驱动侧栏已知集合列表,不吃 URL,无害,不动。

---

## Change 3 · P0-3 — 一套共享系统态语法(NotFound / NoAccess / Error),让三义分离且不掉出外壳

### 根因(已坐实)
「不存在」「无权」「出错」三义被压成一两条无差别路径,且半数掉出 Woven 外壳:

| 路由 | 缺失/受限时现状 | HTTP | 外壳 |
|---|---|---|---|
| `/decision/[id]` | `notFound()` → 裸 Next 默认 404 | 404 | 仅 root layout,无侧栏 |
| `/a/[slug]` 公开 artifact | `notFound()` → 裸 404 | 404 | 无 |
| `/artifact/[id]` 内部 | `MissingArtifact` 软态,restricted `a_comp` 与 missing **同文案** | 200 | reader |
| `/artifact/[id]/version/[label]` | 同上「Snapshot not found」 | 200 | reader |
| `/collection/[slug]` | fail-open(见 P0-2) | 200 | app |
| `/c/[slug]` 公开集合 | 「isn't published」软态(存在与否不泄露 ✅) | 200 | 极简 |

- 2026-08-14 时全仓无 `not-found.tsx` / `error.tsx` / `global-error.tsx` / `loading.tsx`。现在 `app/(app)/` 下已有 `not-found.tsx` 和 `error.tsx`,其余路由组仍无。
- **restricted 无独立态**:`canView('a_comp','pe_maya') === false`(a_comp 属 `sp_leadership`,成员仅 pe_theo;VIEWER=pe_maya),但 `components/artifact-page-client.tsx` 在 `!canView`(142)、`!getArtifact`(145)、`!version`(162)三处返回**同一个** `MissingArtifact`——「无权」= 「不存在」。
- 已有的搜索面**恰好有 NoAccess 词汇可镜像**:`searchEntities` 对受限项返回 `{ restricted:true, label: 'Restricted {kind}' }`,`search.tsx:430–431` 渲染「Restricted {kind}」+ request-access 附件。NoAccess 变体应对齐这套措辞。

### 可复用原语(已存在,直接提升,勿新造风格)
- `lib/frame.ts` `PAGE_FRAME.focused` = `"mx-auto w-full max-w-[1040px] px-5 py-6 md:px-8 md:py-10"`——系统态容器。
- `components/artifact-page-client.tsx` 的 **`MissingArtifact`(35–61)本身就是要提升的模板**:居中、`size-10 rounded-lg bg-secondary text-muted-foreground` 图标 chip、`h1 text-[24px] font-medium tracking-[-0.01em]`、15px muted 正文、一个 primary 文字链。
- `components/woven-mark.tsx` `WovenMark`——public scope 头部领衔。
- **今日无任何 SystemState/EmptyState 共享组件**(grep 确认)——这是 greenfield 原语。

### 3a — 新建 `components/system-state.tsx`

一个原语,三变体,chrome 由挂载它的边界文件决定:

```tsx
import Link from "next/link";
import { ArrowLeft, FileQuestion, Lock, TriangleAlert } from "lucide-react";
import { PAGE_FRAME } from "@/lib/frame";
import { WovenMark } from "@/components/woven-mark";

type Variant = "not-found" | "no-access" | "error";
type Scope = "app" | "reader" | "public";

const ICON = { "not-found": FileQuestion, "no-access": Lock, error: TriangleAlert } as const;

export function SystemState({
  variant,
  scope = "app",
  title,
  body,
  action,            // { href, label } | { onClick, label }  — one primary text-link/button
}: {
  variant: Variant;
  scope?: Scope;
  title?: string;
  body?: string;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
}) {
  const Icon = ICON[variant];
  // defaults per variant (override via props)
  const t = title ?? { "not-found": "Not found", "no-access": "Restricted", error: "Something went wrong" }[variant];
  const b = body ?? {
    "not-found": "This isn’t available in the evidence stored in this browser.",
    "no-access": "You don’t have access to this. Ask an owner to grant access.",
    error: "This surface failed to load. Try again.",
  }[variant];

  const core = (
    <div className="max-w-md text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h1 className="mt-4 text-[24px] font-medium tracking-[-0.01em]">{t}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{b}</p>
      {action ? (
        "href" in action ? (
          <Link href={action.href} className="mt-5 inline-flex items-center gap-1.5 rounded-md text-[14px] font-medium text-primary outline-none transition-colors hover:text-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-ring/40">
            <ArrowLeft className="size-4" /> {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick} className="mt-5 inline-flex items-center gap-1.5 rounded-md text-[14px] font-medium text-primary outline-none transition-colors hover:text-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-ring/40">
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );

  // public scope leads with the WovenMark header (matches /a and /c); app/reader rely on host chrome.
  return (
    <main className="min-h-screen bg-background">
      {scope === "public" ? (
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <WovenMark className="h-3.5 w-auto" />
            </span>
            Woven
          </span>
        </header>
      ) : null}
      <div className={`${PAGE_FRAME.focused} flex min-h-[70vh] items-center justify-center`}>{core}</div>
    </main>
  );
}
```

**教条守则(逐项)**:forest(`var(--primary)`)**只**用在 chrome/agent——失败图标 chip 保持 `bg-secondary/muted`(与今日 `MissingArtifact` 完全一致),唯一 accent 只允许出现在 public scope 的 WovenMark 圆点。**不加 bordered card**(不采用 dashed-card 空态样式),只居中文本 + 图标 chip。`PAGE_FRAME.focused` 居中。All-Geist,字重仅 400(正文)/ 500(标题 + 链接,`font-medium`)。`tracking-[-0.01em]` 对齐 `PageHeading`。

### 3b — 新增边界文件(App Router 约定,部分已落地:`app/(app)/not-found.tsx`、`app/(app)/error.tsx`)

| 文件 | 内容 | 捕获 |
|---|---|---|
| `app/(app)/not-found.tsx`(server) | `<SystemState variant="not-found" scope="app" action={{href:"/library", label:"Back to Library"}} />` | 所有 (app) 路由的 `notFound()`(含 P0-2 的 collection 守卫) |
| `app/(app)/error.tsx`(`"use client"`) | `<SystemState variant="error" scope="app" action={{onClick: reset, label:"Try again"}} />` | (app) 路由 render/runtime 崩溃 |
| `app/decision/not-found.tsx`(server) | `<SystemState variant="not-found" scope="reader" action={{href:"/inbox", label:"Back to Inbox"}} />` | decision 缺失 |
| `app/decision/error.tsx`(`"use client"`) | `<SystemState variant="error" scope="reader" action={{onClick: reset, label:"Try again"}} />` | decision render 失败 |
| `app/artifact/not-found.tsx` + `app/artifact/error.tsx` | 同上 reader scope | artifact 组抛错 |
| `app/not-found.tsx`(root, server) | `<SystemState variant="not-found" scope="public" action={{href:"/", label:"Go to Woven"}} />` | `/a`、`/c` 的 `notFound()` + 任何未匹配 URL |
| `app/global-error.tsx`(`"use client"`) | 自带 `<html><body>` 包裹 `<SystemState variant="error" scope="public" />` | root 级崩溃(必须客户端组件,必须渲染自身 html/body) |

> 提醒:`error.tsx`/`global-error.tsx` 必须是客户端组件;`global-error.tsx` 必须渲染自己的 `<html>/<body>`。

### 3c — decision 页三义拆分 — `app/decision/[id]/page.tsx`

**Before:**
```tsx
import { decisionRecord, listDecisionRecords } from "@/lib/api";
...
const { id } = await params;
if (!decisionRecord(id)) notFound();
return <DecisionDetail decisionId={id} />;
```

**After:**
```tsx
import { decisionById, canView, decisionRecord, listDecisionRecords } from "@/lib/api";
import { SystemState } from "@/components/system-state";
...
const { id } = await params;
if (!decisionById(id)) notFound();                                   // 不存在 → NotFound (404)
if (!canView(id)) return <SystemState variant="no-access" scope="reader" />;  // 受限 → NoAccess (200)
if (!decisionRecord(id)) notFound();                                 // 兜底:引用证据不可见(罕见/未 seed)
return <DecisionDetail decisionId={id} />;
```

> `canView(id)` 对 decision id 有效(`api.ts:900` 已如此用)。此拆分把「不存在 vs 无权」分开,配合 Change 1 后 de_sms/de_cadence 已能正常渲染,不会走到这些分支。

### 3d — artifact reader 接入 — `components/artifact-page-client.tsx`

把三处返回 `MissingArtifact` 的点替换为共享原语,**并把 restricted 与 missing 区分开**:

- `!canView(...)`(~142)→ `<SystemState variant="no-access" scope="reader" />`  ← **这就是 `a_comp` 的修复**
- `!getArtifact(...)`(~145)→ `<SystemState variant="not-found" scope="reader" title="Artifact not found" body="This artifact is not available in the evidence stored in this browser." action={{href:"/library", label:"Back to Library"}} />`
- `!version`(~162)→ `<SystemState variant="not-found" scope="reader" title="Snapshot not found" body="This exact version is not available in the evidence stored in this browser." action={{href:"/library", label:"Back to Library"}} />`
- 三处都迁移后,**删除本文件内的局部 `MissingArtifact`(35–61)**,保留 Artifact-vs-Snapshot 文案区分。

> reader 仍是客户端组件、从 localStorage 水合,restricted/missing 保持 HTTP-200 软态(见「待你拍板」#1)。

### 3e — decision-detail 空白页兜底 — `components/decision-detail.tsx`

**Before(44):** `if (!record || !truth || !packet) return null;`（已解析的 decision 却建不出 packet = 故障,不是空态,却渲染全白页）

**After:** `if (!record || !truth || !packet) return <SystemState variant="error" scope="reader" />;`

---

## 验证清单(落地后逐条过)

**类型/构建**
```bash
npx tsc --noEmit
```

**运行 `pnpm dev` 后逐一命中,确认态正确、都在 Woven 外壳内、HTTP 语义对**

| URL | 期望 |
|---|---|
| `/decision/de_sms` | ✅ 渲染四轴真相栅格,activation 项标「exact activation proof unavailable / unverified」;**不再 404** |
| `/decision/de_cadence` | ✅ 同上,状态 needs_revalidation |
| `/decision/de_digest` `/decision/de_embargo` `/decision/de_sms_v1` | ✅ 回归:仍正常(未受 Change 1 影响) |
| `/decision/nonexistent_id` | ✅ 样式化 NotFound(reader scope),HTTP 404 |
| `/artifact/a_comp` | ✅ **NoAccess(Restricted)**,明显区别于 not-found |
| `/artifact/nonexistent_id` | ✅ NotFound「Artifact not found」 |
| `/artifact/a_notif/version/bogus` | ✅ NotFound「Snapshot not found」 |
| `/collection/bogus-slug` | ✅ **不再渲染 Q4 Roadmap**;样式化 NotFound(app scope,含侧栏),HTTP 404 |
| `/collection/<合法 slug>` | ✅ 回归:正常渲染该集合 |
| `/c/bogus-slug` | ✅ 回归:「isn't published」软态(公开路由本就 fail-closed,未改) |

**暗色**:上述 NotFound/NoAccess/Error 各抽一个在 dark 下复看(chip/文本对比、无 forest 泄漏)。

**回归**:侧栏 collection 计数、facet filter(`api.ts:307`)、collection Map(collectionGraph)、drag-to-reorder——确认未受 P0-2 守卫影响(它们只吃合法 slug)。

---

## Historical open questions (superseded by Step 1 resolution)

1. **restricted artifact `a_comp`**:维持客户端 HTTP-200 软 NoAccess(当前架构,推荐,改动最小),还是提升为服务端 403 式(需把 `canView` 门移到 `app/artifact/[id]/page.tsx` 服务端、在 hydrate 前拦)?**默认取前者。**
2. **公开路由 `/a`、`/c`**:确认要**隐藏** restricted-vs-missing 区分(推荐,防 URL 枚举私有资源)——即 NoAccess 变体**不**用于公开微站,它们只显示 NotFound / 「not published」。**默认取「隐藏」。**
3. **NoAccess 的 request-access**:给真实「申请访问」动作(接真实流程),还是只放 `search.tsx:431` 那种无操作附件?若要真实,请求路由到谁(空间 owner / sp_leadership 的 pe_theo)?**默认先放无操作附件占位。**
4. **`collectionBySlug` 掩盖 helper**:本 pass 只在路由守卫,**不**改 helper 签名。要不要排一个 P1 把它改成非掩盖(返回 undefined)+ 守卫 7 个调用点?
5. **`loading.tsx`**:全仓无 loading 骨架(`LoadingArtifact` 模式已存在,可标准化)。要不要并入本系统态语法,还是单独排?**默认单独排,不进 P0。**

---

## 本 pass 明确不做
- 任何 P1/P2/P3(Today 旧 KB 语气、能力文案 overclaim、ReviewPacket 空带、⌘K 键位、卡片密度、Map 标签拥挤、暗色 reader 标题对比等)。
- `collectionBySlug` 签名重构、`lib/collections.ts` shim、`loading.tsx` 标准化(见「待你拍板」)。

## Fix backlog (2026-09-04)

按影响面和依赖关系排序。验收全部用量的:`scripts/shot.mjs` 的 `--probe` 读 DOM,`node --test`,`npx tsc --noEmit`,`node scripts/check-design-rules.mjs`。

状态(核对于 2026-11-03,`84a4bb8`):

- 已落地或已被取代,已从下文删去:4、5、6、7、13 的 Sparkles 和 ScopeChip、15、21、22,以及 scope chip 一节。
- 开放,已核对:1、2、3、8、9、10、12 的剩余部分。
- 开放或部分落地,动手前先复核:11、13 的 ⌘K 零态、14(大体已解决)、16、17、18、19、20、暗色下沉(大体已解决)。

### 数字的根

首页、侧栏徽标、Inbox 的每一个数字都从这里出。先做这三条，后面所有"计数对不上"的问题会一起消失。

1. `lib/api.ts:1937 needsYou()` 与 `lib/api.ts:2500 inboxDecisionCount()` / `:2512 inboxBadgeCount()` 是两个列表，10 项里只有 5 项重合；`needsYou()[0]` 是数组位置，不是最紧急。改法：`needsYou()` 纳入 `needs_you` 状态的 agent run 和开放的 suggestion，按一条规则排序（`lib/home.ts` 的 `KIND` 表是现成的：revalidation 0 → stale 1 → candidate/approval 2 → activation 3 → run 4 → proposal 5 → capture 7，同权重按等待时长），使 `needsYou().length === inboxBadgeCount()`。验收：`node --test scripts/home.test.mjs` 仍过；/today 上 "Needs you N" 的 N 与侧栏徽标相等，交接行 "1 + M more" 之和等于 N。
2. `lib/types.ts:348 NeedItem` 加 `at: string`、`blocks?: number`、kind 联合加 `"run"`。首页现在在本地推导这些，有了字段就删本地逻辑（`lib/home.ts rankNeeds` 只保留排序）。验收：tsc。
3. `app/(app)/inbox/page.tsx:62` Activity 标签的计数用的是 `liveRunCount()`（4），而分区标题说 Needs you 3；徽标的意思是"等你"，应为 `needsYouRunCount()`。验收：标签计数 = 分区计数。

### 说真话（文案与数据）

8. `lib/api.ts:1173` 批准项的 detail 把结果写成现在时事实（"The weekly digest is enabled…"），而这个决定还没人批准。改成陈述条件：approve → `Counts as done when ${lowerFirst(cond)}`；activation → `Add proof once …`；revalidation → `${label} changed after approval, re-check it`；中点 → 逗号（首页现在在显示时替换，接口改了就删 `houseSeparators` 的两处调用）。验收：/inbox Decisions 与 /today 的同一条文案一致，无 `·`。
9. `lib/api.ts:2612 awayDigest(viewer, since?)` 没有时间窗，是全量汇总却叫"你不在的时候"。接受 `since`，同时统计 runs（含 running / failed），返回每人待处理数。`components/home/orient.tsx` 现在本地推导这三样，有了接口就删。验收：`scripts/home.test.mjs` 的 agentDigest 用例改指向接口后仍过。
10. `lib/api.ts` 补一个撤销批准的接口（首页 toast 现在只能给 "Open Inbox"，给不了 Undo）。可选：`reweaveArtifact(id)`（重跑 capture、清 `staleness`、resolve `run_stale_notif`、记 episode、`bumpGraph()`）——只有想让种子早晨的唯一实心按钮是 Re-weave 时才需要。
11. `lib/api.ts:1585 askSuggestions()` 的 `·` → 逗号；`responsibilityLabel` 的 `" · "` → `" in "`（"Note who's mentioned in Growth"，这是 Activity 里最后一个中点）。
12. `lib/data.ts` 种子：run 标题里的 " — " 和 "+"（`Noted Maya Chen + Theo Novak on Press Outreach — Q4`）；run 标题用 artifact 的真实标题（`Launch Plan — Q4` → `Q4 launch plan`）；run 摘要里的中点（`Parsed into 4 sections · proposed 3 links`）；`"just now"` → `"1m"`；hero 的 peek 里 `agent linked it to q4-roadmap` 打印的是 slug、`Maya tightened…` 用第三人称写读者自己的编辑；"docs" 改 artifacts；空间名 `Acme · Product` → `Acme Product`（/team 标题、场中心、侧栏三处都在渲染这个中点）；`readthrough` 存的是重敲的标题不是 artifact id（:1003、:1041），且 `a_launch` 不在 `public_member_ids` 里。验收：`node scripts/check-design-rules.mjs` 的 `no-middle-dot` 在这些文件上归零。
13. `components/search.tsx`：⌘K 零态的 "Jump back in / While you were away" 与首页读同一选择器（`viewerRecents`、`awayDigest`），现在 11 行里有 4 行和首页重复但文案不同。

### Library 与 Inbox

14. `app/(app)/library/page.tsx` 行 hover：hover 会同时拿掉类型和时间，选中任意一行会拿掉全部 40 行的类型，静置时行首和右上角各压着一个不可见但可点的按钮，`⋯` 压在时间格上 22px。
16. Library 批量工具条：in-flow 的 `sticky bottom-6`、`rounded-lg`、`shadow-lg ring-1 ring-foreground/10`、`text-sm`、size sm；Archive 要 ConfirmDialog 或 Undo toast（现在压住最后一行 21px）。
17. Library 表头：Filter → `<Button variant="outline" size="sm">`；ViewToggle → 带图标的 `SegToggle`；两者上移到标题行，让 chip 行只放 chip。
18. Library 字号档与圆角：15 → base、13 → sm、12/11 → xs；`rounded-xl` → `rounded-lg`；去掉卡片 hover 抬升（全站没有别的表面会动）；`⋯` → `size="icon-sm"`；StatusPill 移到卡片页脚。
19. `components/inbox-queue.tsx`：11 个 wash 胶囊 → `Valve` 的 ✓/✕ 语法；tile `rounded-lg` → `rounded-md`；中点 :188/:307/:370；`CollectionStamp` → `CollectionTag`；空态去卡片。
20. `components/proposal.tsx` `ChoiceValve` 非 primary 项 → ghost，尺寸 sm；`components/decision-state.tsx` 的点与尺寸对齐 StatusPill。

### 暗色下沉

暗色下 `--accent / --secondary / --muted` 都是 `#141210`，低于卡片 `#232019` 和页面 `#1a1815`。20 个文件量过：坐在地面上的东西（chip、徽章、计数胶囊、hover/展开态、选中段、tile、圆形图标底）用它们填充在暗色里是个洞，30 处改成前景色透明（chip 6%、选中/展开 8%、要浮在选中行之上 10%）；陷在里面的东西（轨道、输入井、骨架屏、卡片底托）保留。其余文件没量，同样的 token 在 `inbox-queue.tsx`、`proposal.tsx`、`search.tsx`、`catch-up.tsx`、`artifact-reader.tsx`、`library/page.tsx`、`today/page.tsx` 里都有。量法：`scripts/shot.mjs --patch`（加 `.dark`，进入状态）+ `--probe`（元素 `backgroundColor` 合成到第一个不透明祖先上，比相对亮度），角色判定看它是"陷在里面"还是"坐在上面"。

### 等 Kyle 决定，或不做

- `--warn ≡ --chart-2`：新鲜度圈（`border-warn`）和 Growth 集合同一个橙，评委连续 6 轮读成"属于 Growth"。要么给 warn 一个不在 chart 里的 hex，要么新鲜度不用颜色。
- Re-weave 做种子早晨唯一的实心森林绿按钮（需要第 10 条的 `reweaveArtifact`）。现在的选择是真实 Approve、零实心森林绿。
- Links 列已从集合页删掉（rail 画集合内引用）；若产品要"总链接数"，得另找位置。
- 评委循环里 Kyle 按住的项（单项面包屑、launcher 的第二个 +、workspace 位放 logo、四档圆角、暖石灰 + 森林绿、类型标签跟在标题后）不改。

### 验收命令

```
npx tsc --noEmit
node scripts/check-design-rules.mjs
node --test tests/*.test.mjs scripts/*.test.mjs
node scripts/orbit-bench.mjs
```

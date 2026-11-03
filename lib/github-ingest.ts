export type GitHubPullRequestSnapshot = {
  repo: string;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  draft: boolean;
  author: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  mergeCommitSha?: string;
  mergedAt?: string;
  updatedAt: string;
  htmlUrl: string;
  reviews: Array<{
    author: string;
    state: string;
    submittedAt?: string;
    commitSha?: string;
  }>;
  commits: Array<{
    sha: string;
    message: string;
    author?: string;
    date?: string;
  }>;
};

export type ParsedGitHubPullRequestUrl = {
  owner: string;
  repo: string;
  number: number;
  href: string;
};

export type GitHubPullRequestCaptureIdentity = Pick<
  GitHubPullRequestSnapshot,
  | "repo"
  | "number"
  | "headSha"
  | "updatedAt"
  | "mergedAt"
  | "mergeCommitSha"
>;

export type GitHubCommitActor = {
  login?: string;
  name?: string;
  date?: string;
};

export type GitHubCommitSnapshot = {
  repo: string;
  sha: string;
  htmlUrl: string;
  message: string;
  parents: string[];
  author?: GitHubCommitActor;
  committer?: GitHubCommitActor;
  files: Array<{
    path: string;
    status: string;
    sha?: string;
    additions: number;
    deletions: number;
    changes: number;
    previousPath?: string;
  }>;
};

export type ParsedGitHubCommitUrl = {
  owner: string;
  repo: string;
  sha: string;
  href: string;
};

const OWNER_PATTERN = /^(?=.{1,39}$)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const REPO_PATTERN = /^(?=.{1,100}$)[A-Za-z0-9._-]+$/;
const PULL_REQUEST_URL_PATTERN =
  /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/pull\/([0-9]+)\/?$/;
const COMMIT_URL_PATTERN =
  /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/commit\/([0-9a-fA-F]{40})\/?$/;

export function parseGitHubPullRequestUrl(
  text: string,
): ParsedGitHubPullRequestUrl | null {
  const candidate = text.trim();
  const match = PULL_REQUEST_URL_PATTERN.exec(candidate);
  if (!match) return null;

  try {
    const url = new URL(candidate);
    const [, owner, repo, numberText] = match;
    const number = Number(numberText);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !OWNER_PATTERN.test(owner) ||
      !REPO_PATTERN.test(repo) ||
      repo === "." ||
      repo === ".." ||
      !Number.isSafeInteger(number) ||
      number <= 0
    ) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      href: `https://github.com/${owner}/${repo}/pull/${number}`,
    };
  } catch {
    return null;
  }
}

export function parseGitHubCommitUrl(text: string): ParsedGitHubCommitUrl | null {
  const candidate = text.trim();
  const match = COMMIT_URL_PATTERN.exec(candidate);
  if (!match) return null;

  try {
    const url = new URL(candidate);
    const [, owner, repo, shaText] = match;
    const sha = shaText.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !OWNER_PATTERN.test(owner) ||
      !REPO_PATTERN.test(repo) ||
      repo === "." ||
      repo === ".."
    ) {
      return null;
    }

    return {
      owner,
      repo,
      sha,
      href: `https://github.com/${owner}/${repo}/commit/${sha}`,
    };
  } catch {
    return null;
  }
}

export function githubPullRequestCommitSetIsComplete(
  declaredCount: unknown,
  headSha: string,
  commits: ReadonlyArray<{ sha: string }>,
): boolean {
  return (
    typeof declaredCount === "number" &&
    Number.isSafeInteger(declaredCount) &&
    declaredCount > 0 &&
    commits.length > 0 &&
    commits.length === declaredCount &&
    commits.some((commit) => commit.sha === headSha)
  );
}

export function githubPullRequestCaptureIsStable(
  first: GitHubPullRequestCaptureIdentity,
  second: GitHubPullRequestCaptureIdentity,
): boolean {
  return (
    first.repo.toLowerCase() === second.repo.toLowerCase() &&
    first.number === second.number &&
    first.headSha === second.headSha &&
    first.updatedAt === second.updatedAt &&
    first.mergedAt === second.mergedAt &&
    first.mergeCommitSha === second.mergeCommitSha
  );
}

function inline(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\s*\n\s*/g, " ").trim();
}

function code(value: string): string {
  const normalized = inline(value);
  const longestRun = Math.max(
    0,
    ...Array.from(normalized.matchAll(/`+/g), (match) => match[0].length),
  );
  const delimiter = "`".repeat(longestRun + 1);
  const needsPadding =
    normalized.startsWith("`") ||
    normalized.endsWith("`") ||
    normalized.startsWith(" ") ||
    normalized.endsWith(" ");
  const content = needsPadding ? ` ${normalized} ` : normalized;
  return `${delimiter}${content}${delimiter}`;
}

function optionalCode(value: string | undefined, fallback: string): string {
  return value ? code(value) : fallback;
}

function normalizedBody(value: string | undefined): string {
  const body = value?.replace(/\r\n?/g, "\n").trim();
  return body || "_No description captured._";
}

function quotedMessage(value: string): string {
  const message = value.replace(/\r\n?/g, "\n").trim();
  if (!message) return "> _Empty commit message._";
  return message
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

export function githubSnapshotMarkdown(
  snapshot: GitHubPullRequestSnapshot,
): string {
  const lines = [
    "# GitHub pull request snapshot",
    "",
    `- Repository: ${code(snapshot.repo)}`,
    `- Pull request: [#${snapshot.number}](${snapshot.htmlUrl})`,
    `- Title: ${inline(snapshot.title)}`,
    `- State: ${code(snapshot.state)}`,
    `- Draft: ${code(String(snapshot.draft))}`,
    `- Author: ${code(snapshot.author)}`,
    `- Updated at: ${code(snapshot.updatedAt)}`,
    `- Base ref: ${code(snapshot.baseRef)}`,
    `- Base SHA: ${code(snapshot.baseSha)}`,
    `- Head ref: ${code(snapshot.headRef)}`,
    `- Captured head SHA: ${code(snapshot.headSha)}`,
    `- Captured merge commit SHA: ${optionalCode(
      snapshot.mergeCommitSha,
      "not available",
    )}`,
    `- Merged at: ${optionalCode(snapshot.mergedAt, "not merged")}`,
    "",
    "## Description",
    "",
    normalizedBody(snapshot.body),
    "",
    `## Reviews (${snapshot.reviews.length})`,
    "",
  ];

  if (snapshot.reviews.length === 0) {
    lines.push("_No reviews captured._");
  } else {
    snapshot.reviews.forEach((review, index) => {
      if (index > 0) lines.push("");
      lines.push(
        `${index + 1}. ${code(review.state)} by ${code(review.author)}`,
        `   - Submitted at: ${optionalCode(review.submittedAt, "not available")}`,
        `   - Commit SHA: ${optionalCode(review.commitSha, "not available")}`,
      );
    });
  }

  lines.push("", `## Commits (${snapshot.commits.length})`, "");

  if (snapshot.commits.length === 0) {
    lines.push("_No commits captured._");
  } else {
    snapshot.commits.forEach((commit, index) => {
      if (index > 0) lines.push("");
      lines.push(
        `${index + 1}. ${code(commit.sha)}`,
        `   - Author: ${optionalCode(commit.author, "not available")}`,
        `   - Date: ${optionalCode(commit.date, "not available")}`,
        "   - Message:",
        "",
        quotedMessage(commit.message),
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

function appendCommitActor(
  lines: string[],
  label: "Author" | "Committer",
  actor: GitHubCommitActor | undefined,
): void {
  lines.push(`## ${label}`, "");
  if (!actor) {
    lines.push("_Not available._");
    return;
  }

  lines.push(
    `- GitHub login: ${optionalCode(actor.login, "not available")}`,
    `- Git name: ${optionalCode(actor.name, "not available")}`,
    `- Date: ${optionalCode(actor.date, "not available")}`,
  );
}

export function githubCommitSnapshotMarkdown(
  snapshot: GitHubCommitSnapshot,
): string {
  const message = snapshot.message.replace(/\r\n?/g, "\n").trim();
  const lines = [
    "# GitHub commit snapshot",
    "",
    `- Repository: ${code(snapshot.repo)}`,
    `- Commit: [${snapshot.sha.slice(0, 12)}](${snapshot.htmlUrl})`,
    `- Captured commit SHA: ${code(snapshot.sha)}`,
    "",
    `## Parents (${snapshot.parents.length})`,
    "",
  ];

  if (snapshot.parents.length === 0) {
    lines.push("_Root commit; no parents._");
  } else {
    snapshot.parents.forEach((parent, index) => {
      lines.push(`${index + 1}. ${code(parent)}`);
    });
  }

  lines.push("", "## Message", "", message || "_Empty commit message._", "");
  appendCommitActor(lines, "Author", snapshot.author);
  lines.push("");
  appendCommitActor(lines, "Committer", snapshot.committer);
  lines.push("", `## Files (${snapshot.files.length})`, "");

  if (snapshot.files.length === 0) {
    lines.push("_No changed files captured._");
  } else {
    snapshot.files.forEach((file, index) => {
      if (index > 0) lines.push("");
      lines.push(
        `${index + 1}. ${code(file.path)} — ${code(file.status)}`,
        `   - Blob SHA: ${optionalCode(file.sha, "not available")}`,
        `   - Changes: ${code(String(file.additions))} additions, ${code(
          String(file.deletions),
        )} deletions, ${code(String(file.changes))} total`,
      );
      if (file.previousPath) {
        lines.push(`   - Previous path: ${code(file.previousPath)}`);
      }
    });
  }

  return `${lines.join("\n")}\n`;
}

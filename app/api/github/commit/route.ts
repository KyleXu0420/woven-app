import {
  githubCommitSnapshotMarkdown,
  parseGitHubCommitUrl,
  type GitHubCommitActor,
  type GitHubCommitSnapshot,
  type ParsedGitHubCommitUrl,
} from "@/lib/github-ingest";

export const dynamic = "force-dynamic";

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "woven-public-commit-ingest",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/;

type JsonRecord = Record<string, unknown>;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return value;
}

function requiredString(value: unknown, label: string): string {
  const result = text(value, label);
  if (!result) throw new TypeError(`Invalid GitHub ${label}.`);
  return result;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  return text(value, label) || undefined;
}

function nonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return value as number;
}

function fullSha(value: unknown, label: string): string {
  const sha = requiredString(value, label).toLowerCase();
  if (!FULL_SHA_PATTERN.test(sha)) {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return sha;
}

function accountLogin(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  return optionalString(record(value, label).login, `${label} login`);
}

function commitActor(
  accountValue: unknown,
  metadataValue: unknown,
  label: string,
): GitHubCommitActor | undefined {
  const login = accountLogin(accountValue, label);
  const metadata =
    metadataValue == null ? undefined : record(metadataValue, `${label} metadata`);
  const name = optionalString(metadata?.name, `${label} name`);
  const date = optionalString(metadata?.date, `${label} date`);
  if (!login && !name && !date) return undefined;

  return {
    ...(login ? { login } : {}),
    ...(name ? { name } : {}),
    ...(date ? { date } : {}),
  };
}

function commitSnapshot(
  parsed: ParsedGitHubCommitUrl,
  value: unknown,
): GitHubCommitSnapshot {
  const response = record(value, "commit response");
  const upstreamUrl = parseGitHubCommitUrl(requiredString(response.html_url, "commit URL"));
  if (
    !upstreamUrl ||
    upstreamUrl.owner.toLowerCase() !== parsed.owner.toLowerCase() ||
    upstreamUrl.repo.toLowerCase() !== parsed.repo.toLowerCase() ||
    upstreamUrl.sha !== parsed.sha
  ) {
    throw new TypeError("GitHub returned a different commit.");
  }

  const sha = fullSha(response.sha, "commit SHA");
  if (sha !== parsed.sha) {
    throw new TypeError("GitHub returned a different commit SHA.");
  }

  const commit = record(response.commit, "commit metadata");
  if (!Array.isArray(response.parents) || !Array.isArray(response.files)) {
    throw new TypeError("Invalid GitHub commit collection response.");
  }

  const parents = response.parents.map((parentValue) =>
    fullSha(record(parentValue, "commit parent").sha, "parent SHA"),
  );
  const files = response.files.map((fileValue) => {
    const file = record(fileValue, "commit file");
    const fileSha = optionalString(file.sha, "file blob SHA");
    const previousPath = optionalString(file.previous_filename, "previous file path");
    if (fileSha && !FULL_SHA_PATTERN.test(fileSha.toLowerCase())) {
      throw new TypeError("Invalid GitHub file blob SHA.");
    }

    return {
      path: requiredString(file.filename, "file path"),
      status: requiredString(file.status, "file status"),
      ...(fileSha ? { sha: fileSha.toLowerCase() } : {}),
      additions: nonnegativeInteger(file.additions, "file additions"),
      deletions: nonnegativeInteger(file.deletions, "file deletions"),
      changes: nonnegativeInteger(file.changes, "file changes"),
      ...(previousPath ? { previousPath } : {}),
    };
  });

  return {
    repo: `${upstreamUrl.owner}/${upstreamUrl.repo}`,
    sha,
    htmlUrl: upstreamUrl.href,
    message: text(commit.message, "commit message"),
    parents,
    author: commitActor(response.author, commit.author, "commit author"),
    committer: commitActor(response.committer, commit.committer, "commit committer"),
    files,
  };
}

export async function GET(request: Request): Promise<Response> {
  const parsed = parseGitHubCommitUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!parsed) {
    return json({ error: "Invalid GitHub commit URL." }, 400);
  }

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    parsed.owner,
  )}/${encodeURIComponent(parsed.repo)}/commits/${parsed.sha}?per_page=100`;

  try {
    const response = await fetch(apiUrl, {
      cache: "no-store",
      headers: GITHUB_API_HEADERS,
    });

    if (response.status === 403 || response.status === 429) {
      return json({ error: "GitHub API rate limit exceeded." }, 403);
    }
    if (response.status === 404) {
      return json({ error: "Commit is private or unavailable." }, 404);
    }
    if (!response.ok) {
      return json({ error: "GitHub API request failed." }, 502);
    }
    if (response.headers.get("link")?.includes('rel="next"')) {
      return json({ error: "GitHub commit response was incomplete." }, 502);
    }

    const snapshot = commitSnapshot(parsed, (await response.json()) as unknown);
    return json({ snapshot, raw: githubCommitSnapshotMarkdown(snapshot) });
  } catch {
    return json({ error: "GitHub API request failed." }, 502);
  }
}

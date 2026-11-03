import {
  githubPullRequestCaptureIsStable,
  githubPullRequestCommitSetIsComplete,
  githubSnapshotMarkdown,
  parseGitHubPullRequestUrl,
  type GitHubPullRequestCaptureIdentity,
  type GitHubPullRequestSnapshot,
  type ParsedGitHubPullRequestUrl,
} from "@/lib/github-ingest";

export const dynamic = "force-dynamic";

const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "woven-public-pr-ingest",
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

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return value || undefined;
}

function fullSha(value: unknown, label: string): string {
  const sha = requiredString(value, label).toLowerCase();
  if (!FULL_SHA_PATTERN.test(sha)) {
    throw new TypeError(`Invalid GitHub ${label}.`);
  }
  return sha;
}

function optionalFullSha(value: unknown, label: string): string | undefined {
  if (value == null) return undefined;
  return fullSha(value, label);
}

function githubAuthor(value: unknown): string | undefined {
  if (value == null) return undefined;
  return optionalString(record(value, "author").login, "author login");
}

function pullRequestCaptureIdentity(
  parsed: ParsedGitHubPullRequestUrl,
  pullValue: unknown,
): GitHubPullRequestCaptureIdentity {
  const pull = record(pullValue, "pull request response");
  const upstreamUrl = parseGitHubPullRequestUrl(
    requiredString(pull.html_url, "pull request URL"),
  );
  if (
    !upstreamUrl ||
    upstreamUrl.owner.toLowerCase() !== parsed.owner.toLowerCase() ||
    upstreamUrl.repo.toLowerCase() !== parsed.repo.toLowerCase() ||
    upstreamUrl.number !== parsed.number
  ) {
    throw new TypeError("GitHub returned a different pull request.");
  }

  const head = record(pull.head, "head revision");
  return {
    repo: `${upstreamUrl.owner}/${upstreamUrl.repo}`,
    number: upstreamUrl.number,
    headSha: fullSha(head.sha, "head SHA"),
    updatedAt: requiredString(pull.updated_at, "updated timestamp"),
    mergedAt: optionalString(pull.merged_at, "merged timestamp"),
    mergeCommitSha: optionalFullSha(pull.merge_commit_sha, "merge commit SHA"),
  };
}

function pullRequestSnapshot(
  parsed: ParsedGitHubPullRequestUrl,
  pullValue: unknown,
  reviewsValue: unknown,
  commitsValue: unknown,
): GitHubPullRequestSnapshot {
  const pull = record(pullValue, "pull request response");
  if (!Array.isArray(reviewsValue) || !Array.isArray(commitsValue)) {
    throw new TypeError("Invalid GitHub pull request collection response.");
  }

  const captureIdentity = pullRequestCaptureIdentity(parsed, pull);

  const state = requiredString(pull.state, "pull request state");
  if (state !== "open" && state !== "closed") {
    throw new TypeError("Invalid GitHub pull request state.");
  }
  if (typeof pull.draft !== "boolean") {
    throw new TypeError("Invalid GitHub draft state.");
  }

  const base = record(pull.base, "base revision");
  const head = record(pull.head, "head revision");

  const reviews = reviewsValue.map((value) => {
    const review = record(value, "review");
    return {
      author: githubAuthor(review.user) ?? "ghost",
      state: requiredString(review.state, "review state"),
      submittedAt: optionalString(review.submitted_at, "review timestamp"),
      commitSha: optionalFullSha(review.commit_id, "review commit SHA"),
    };
  });

  const commits = commitsValue.map((value) => {
    const commitResponse = record(value, "commit");
    const commit = record(commitResponse.commit, "commit metadata");
    const authorMetadata =
      commit.author == null ? undefined : record(commit.author, "commit author metadata");
    const committerMetadata =
      commit.committer == null
        ? undefined
        : record(commit.committer, "commit committer metadata");

    return {
      sha: fullSha(commitResponse.sha, "commit SHA"),
      message: requiredString(commit.message, "commit message"),
      author:
        githubAuthor(commitResponse.author) ??
        optionalString(authorMetadata?.name, "commit author name"),
      date:
        optionalString(authorMetadata?.date, "commit author date") ??
        optionalString(committerMetadata?.date, "commit committer date"),
    };
  });

  if (
    !githubPullRequestCommitSetIsComplete(
      pull.commits,
      captureIdentity.headSha,
      commits,
    )
  ) {
    throw new TypeError("GitHub pull request commit response was inconsistent.");
  }

  const body = optionalString(pull.body, "pull request body");
  const snapshot: GitHubPullRequestSnapshot = {
    repo: captureIdentity.repo,
    number: captureIdentity.number,
    title: requiredString(pull.title, "pull request title"),
    state,
    draft: pull.draft,
    author: githubAuthor(pull.user) ?? "ghost",
    baseRef: requiredString(base.ref, "base ref"),
    baseSha: fullSha(base.sha, "base SHA"),
    headRef: requiredString(head.ref, "head ref"),
    headSha: captureIdentity.headSha,
    updatedAt: captureIdentity.updatedAt,
    htmlUrl: `https://github.com/${captureIdentity.repo}/pull/${captureIdentity.number}`,
    reviews,
    commits,
  };

  if (body) snapshot.body = body;
  if (captureIdentity.mergedAt) snapshot.mergedAt = captureIdentity.mergedAt;
  if (captureIdentity.mergedAt && captureIdentity.mergeCommitSha) {
    snapshot.mergeCommitSha = captureIdentity.mergeCommitSha;
  }
  return snapshot;
}

function upstreamFailure(responses: Response[]): Response | null {
  if (responses.some((response) => response.status === 403 || response.status === 429)) {
    return json({ error: "GitHub API rate limit exceeded." }, 403);
  }
  if (responses.some((response) => response.status === 404)) {
    return json({ error: "Pull request is private or unavailable." }, 404);
  }
  if (responses.some((response) => !response.ok)) {
    return json({ error: "GitHub API request failed." }, 502);
  }
  if (responses.slice(1).some((response) => response.headers.get("link")?.includes('rel="next"'))) {
    return json({ error: "GitHub pull request response was incomplete." }, 502);
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const parsed = parseGitHubPullRequestUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!parsed) {
    return json({ error: "Invalid GitHub pull request URL." }, 400);
  }

  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(
    parsed.owner,
  )}/${encodeURIComponent(parsed.repo)}/pulls/${parsed.number}`;

  try {
    const responses = await Promise.all(
      [baseUrl, `${baseUrl}/reviews?per_page=100`, `${baseUrl}/commits?per_page=100`].map(
        (url) =>
          fetch(url, {
            cache: "no-store",
            headers: GITHUB_API_HEADERS,
          }),
      ),
    );
    const failure = upstreamFailure(responses);
    if (failure) return failure;

    const [pull, reviews, commits] = await Promise.all(
      responses.map((response) => response.json() as Promise<unknown>),
    );
    const snapshot = pullRequestSnapshot(parsed, pull, reviews, commits);

    const recheckResponse = await fetch(baseUrl, {
      cache: "no-store",
      headers: GITHUB_API_HEADERS,
    });
    const recheckFailure = upstreamFailure([recheckResponse]);
    if (recheckFailure) return recheckFailure;

    const recheckedPull = (await recheckResponse.json()) as unknown;
    const recheckedIdentity = pullRequestCaptureIdentity(parsed, recheckedPull);
    if (!githubPullRequestCaptureIsStable(snapshot, recheckedIdentity)) {
      return json({ error: "GitHub pull request changed during capture." }, 502);
    }

    return json({ snapshot, raw: githubSnapshotMarkdown(snapshot) });
  } catch {
    return json({ error: "GitHub API request failed." }, 502);
  }
}

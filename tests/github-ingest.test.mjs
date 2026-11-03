import assert from "node:assert/strict";
import test from "node:test";

import {
  githubCommitSnapshotMarkdown,
  githubPullRequestCaptureIsStable,
  githubPullRequestCommitSetIsComplete,
  githubSnapshotMarkdown,
  parseGitHubCommitUrl,
  parseGitHubPullRequestUrl,
} from "../lib/github-ingest.ts";

test("parseGitHubPullRequestUrl accepts and canonicalizes public PR URLs", () => {
  assert.deepEqual(
    parseGitHubPullRequestUrl(" https://github.com/Acme-inc/woven_app/pull/0042/ "),
    {
      owner: "Acme-inc",
      repo: "woven_app",
      number: 42,
      href: "https://github.com/Acme-inc/woven_app/pull/42",
    },
  );
});

test("parseGitHubPullRequestUrl rejects non-public and ambiguous URL forms", () => {
  const invalid = [
    "http://github.com/acme/woven/pull/42",
    "https://user:secret@github.com/acme/woven/pull/42",
    "https://github.example.com/acme/woven/pull/42",
    "https://github.com:444/acme/woven/pull/42",
    "https://github.com/acme/woven/pull/42/files",
    "https://github.com/acme/woven/pull/42?diff=split",
    "https://github.com/acme/woven/pull/42#discussion",
    "https://github.com/acme/woven/pull/0",
    "https://github.com/acme/woven/pull/-1",
    "https://github.com/acme/woven/pull/not-a-number",
    "https://github.com/-acme/woven/pull/42",
    "https://github.com/acme/../pull/42",
    "https://github.com/acme/woven%2Fextra/pull/42",
  ];

  for (const value of invalid) {
    assert.equal(parseGitHubPullRequestUrl(value), null, value);
  }
});

test("githubPullRequestCommitSetIsComplete requires a safe exact count and the head SHA", () => {
  const headSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const previousSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const commits = [{ sha: previousSha }, { sha: headSha }];

  assert.equal(githubPullRequestCommitSetIsComplete(2, headSha, commits), true);
  assert.equal(githubPullRequestCommitSetIsComplete(1, headSha, commits), false);
  assert.equal(githubPullRequestCommitSetIsComplete(2.5, headSha, commits), false);
  assert.equal(
    githubPullRequestCommitSetIsComplete(Number.MAX_SAFE_INTEGER + 1, headSha, commits),
    false,
  );
  assert.equal(githubPullRequestCommitSetIsComplete(0, headSha, []), false);
  assert.equal(
    githubPullRequestCommitSetIsComplete(2, headSha, [
      { sha: previousSha },
      { sha: "cccccccccccccccccccccccccccccccccccccccc" },
    ]),
    false,
  );
});

test("githubPullRequestCaptureIsStable detects capture-window revision drift", () => {
  const first = {
    repo: "Acme/Woven",
    number: 42,
    headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    updatedAt: "2026-08-13T10:01:00Z",
    mergedAt: "2026-08-13T10:00:00Z",
    mergeCommitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  };

  assert.equal(
    githubPullRequestCaptureIsStable(first, { ...first, repo: "acme/woven" }),
    true,
  );

  for (const second of [
    { ...first, number: 43 },
    { ...first, headSha: "cccccccccccccccccccccccccccccccccccccccc" },
    { ...first, updatedAt: "2026-08-13T10:02:00Z" },
    { ...first, mergedAt: undefined },
    { ...first, mergeCommitSha: undefined },
  ]) {
    assert.equal(githubPullRequestCaptureIsStable(first, second), false);
  }
});

test("githubSnapshotMarkdown serializes a deterministic revision snapshot", () => {
  const snapshot = {
    repo: "acme/woven",
    number: 42,
    title: "Capture the PR revision",
    body: "The captured head must remain exact.\r\n\r\nNo latest fallback.",
    state: "closed",
    draft: false,
    author: "maya",
    baseRef: "main",
    baseSha: "base123",
    headRef: "capture-pr",
    headSha: "head456",
    mergeCommitSha: "merge789",
    mergedAt: "2026-08-13T10:00:00Z",
    updatedAt: "2026-08-13T10:01:00Z",
    htmlUrl: "https://github.com/acme/woven/pull/42",
    reviews: [
      {
        author: "sam",
        state: "APPROVED",
        submittedAt: "2026-08-13T09:55:00Z",
        commitSha: "head456",
      },
      { author: "lee", state: "COMMENTED" },
    ],
    commits: [
      {
        sha: "head456",
        message: "Add the adapter\n\nKeep it public-only.",
        author: "maya",
        date: "2026-08-13T09:50:00Z",
      },
    ],
  };

  const expected = `# GitHub pull request snapshot

- Repository: \`acme/woven\`
- Pull request: [#42](https://github.com/acme/woven/pull/42)
- Title: Capture the PR revision
- State: \`closed\`
- Draft: \`false\`
- Author: \`maya\`
- Updated at: \`2026-08-13T10:01:00Z\`
- Base ref: \`main\`
- Base SHA: \`base123\`
- Head ref: \`capture-pr\`
- Captured head SHA: \`head456\`
- Captured merge commit SHA: \`merge789\`
- Merged at: \`2026-08-13T10:00:00Z\`

## Description

The captured head must remain exact.

No latest fallback.

## Reviews (2)

1. \`APPROVED\` by \`sam\`
   - Submitted at: \`2026-08-13T09:55:00Z\`
   - Commit SHA: \`head456\`

2. \`COMMENTED\` by \`lee\`
   - Submitted at: not available
   - Commit SHA: not available

## Commits (1)

1. \`head456\`
   - Author: \`maya\`
   - Date: \`2026-08-13T09:50:00Z\`
   - Message:

> Add the adapter
>
> Keep it public-only.
`;

  assert.equal(githubSnapshotMarkdown(snapshot), expected);
  assert.equal(githubSnapshotMarkdown(snapshot), githubSnapshotMarkdown(snapshot));
});

test("githubSnapshotMarkdown explicitly records absent merge, reviews, and commits", () => {
  const markdown = githubSnapshotMarkdown({
    repo: "acme/woven",
    number: 7,
    title: "Open pull request",
    state: "open",
    draft: true,
    author: "maya",
    baseRef: "main",
    baseSha: "base",
    headRef: "draft",
    headSha: "head",
    updatedAt: "2026-08-13T10:01:00Z",
    htmlUrl: "https://github.com/acme/woven/pull/7",
    reviews: [],
    commits: [],
  });

  assert.match(markdown, /Captured head SHA: `head`/);
  assert.match(markdown, /Captured merge commit SHA: not available/);
  assert.match(markdown, /Merged at: not merged/);
  assert.match(markdown, /## Reviews \(0\)\n\n_No reviews captured\._/);
  assert.match(markdown, /## Commits \(0\)\n\n_No commits captured\._/);
});

test("parseGitHubCommitUrl accepts only exact public commit URLs", () => {
  const uppercaseSha = "ABCDEF0123456789ABCDEF0123456789ABCDEF01";
  const sha = uppercaseSha.toLowerCase();
  assert.deepEqual(
    parseGitHubCommitUrl(` https://github.com/Acme-inc/woven_app/commit/${uppercaseSha}/ `),
    {
      owner: "Acme-inc",
      repo: "woven_app",
      sha,
      href: `https://github.com/Acme-inc/woven_app/commit/${sha}`,
    },
  );

  const invalid = [
    `http://github.com/acme/woven/commit/${sha}`,
    `https://user:secret@github.com/acme/woven/commit/${sha}`,
    `https://github.example.com/acme/woven/commit/${sha}`,
    `https://github.com:444/acme/woven/commit/${sha}`,
    `https://github.com/acme/woven/commit/${sha}?plain=1`,
    `https://github.com/acme/woven/commit/${sha}#diff`,
    `https://github.com/acme/woven/commit/${sha}/checks`,
    "https://github.com/acme/woven/commit/abcdef0",
    "https://github.com/acme/woven/commit/gggggggggggggggggggggggggggggggggggggggg",
  ];
  for (const value of invalid) {
    assert.equal(parseGitHubCommitUrl(value), null, value);
  }
});

test("githubCommitSnapshotMarkdown serializes stable commit evidence", () => {
  const sha = "abcdef0123456789abcdef0123456789abcdef01";
  const parent = "0123456789abcdef0123456789abcdef01234567";
  const snapshot = {
    repo: "acme/woven",
    sha,
    htmlUrl: `https://github.com/acme/woven/commit/${sha}`,
    message: "Add exact commit capture\r\n\r\nDo not follow latest.",
    parents: [parent],
    author: {
      login: "maya",
      name: "Maya Chen",
      date: "2026-08-13T11:00:00Z",
    },
    committer: {
      login: "web-flow",
      name: "GitHub",
      date: "2026-08-13T11:01:00Z",
    },
    files: [
      {
        path: "app/api/github/commit/route.ts",
        status: "added",
        sha: "1111111111111111111111111111111111111111",
        additions: 120,
        deletions: 0,
        changes: 120,
      },
      {
        path: "lib/github-ingest.ts",
        previousPath: "lib/github.ts",
        status: "renamed",
        sha: "2222222222222222222222222222222222222222",
        additions: 8,
        deletions: 3,
        changes: 11,
      },
    ],
  };

  const markdown = githubCommitSnapshotMarkdown(snapshot);
  assert.equal(markdown, githubCommitSnapshotMarkdown(snapshot));
  assert.match(markdown, /Repository: `acme\/woven`/);
  assert.ok(markdown.includes(`Captured commit SHA: \`${sha}\``));
  assert.ok(markdown.includes(`## Parents (1)\n\n1. \`${parent}\``));
  assert.match(markdown, /## Author\n\n- GitHub login: `maya`/);
  assert.match(markdown, /## Committer\n\n- GitHub login: `web-flow`/);
  assert.match(markdown, /## Files \(2\)/);
  assert.match(markdown, /`app\/api\/github\/commit\/route\.ts` — `added`/);
  assert.match(markdown, /Previous path: `lib\/github\.ts`/);
  assert.doesNotMatch(markdown, /captured at/i);
});

test("githubCommitSnapshotMarkdown records root and unavailable metadata explicitly", () => {
  const sha = "abcdef0123456789abcdef0123456789abcdef01";
  const markdown = githubCommitSnapshotMarkdown({
    repo: "acme/woven",
    sha,
    htmlUrl: `https://github.com/acme/woven/commit/${sha}`,
    message: "",
    parents: [],
    files: [],
  });

  assert.match(markdown, /_Root commit; no parents\._/);
  assert.match(markdown, /_Empty commit message\._/);
  assert.match(markdown, /## Author\n\n_Not available\._/);
  assert.match(markdown, /## Committer\n\n_Not available\._/);
  assert.match(markdown, /## Files \(0\)\n\n_No changed files captured\._/);
});

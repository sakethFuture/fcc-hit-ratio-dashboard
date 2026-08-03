const OWNER = 'sakethFuture';
const REPO = 'fcc-hit-ratio-dashboard';
const BRANCH = 'main';

const TOKEN_STORAGE_KEY = 'fcc-hit-ratio.github-token';

export function getGithubToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setGithubToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearGithubToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/**
 * Commits a single file to the repo via the GitHub Contents API — the only
 * write path available to a purely static, backend-less GitHub Pages app.
 * Fetches the current file's sha first (if it exists) so this is an update
 * rather than a conflicting create.
 */
export async function commitFile(path: string, content: string, message: string): Promise<void> {
  const token = getGithubToken();
  if (!token) throw new Error('No GitHub token configured.');

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  let sha: string | undefined;
  const getRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers });
  if (getRes.ok) {
    const json = await getRes.json();
    sha = json.sha;
  } else if (getRes.status !== 404) {
    throw new Error(`Failed to read existing file (${getRes.status}): ${await getRes.text()}`);
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: toBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    throw new Error(`Commit failed (${putRes.status}): ${await putRes.text()}`);
  }
}

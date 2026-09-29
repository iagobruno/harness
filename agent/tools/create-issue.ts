import { defineTool } from 'eve/tools';
import { z } from 'zod';

export default defineTool({
  description: 'Create an issue in a GitHub repository. The repo must be in owner/name format.',
  inputSchema: z.object({
    repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'Use owner/repo format'),
    title: z.string().min(1).max(255),
    body: z.string().optional(),
  }),
  async execute({ repo, title, body }, ctx) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN is not configured');
    }

    const [owner, name] = repo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2026-03-10',
        },
        body: JSON.stringify({ title, ...(body === undefined ? {} : { body }) }),
        signal: ctx.abortSignal,
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        `GitHub API error (${response.status}): ${error?.message ?? response.statusText}`,
      );
    }

    const issue = (await response.json()) as { number: number; html_url: string };
    return { number: issue.number, url: issue.html_url };
  },
});

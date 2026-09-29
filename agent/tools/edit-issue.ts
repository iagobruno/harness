import { defineTool } from 'eve/tools';
import { z } from 'zod';

export default defineTool({
  description: 'Edit the title or body of an existing GitHub issue.',
  inputSchema: z.object({
    repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'Use owner/repo format'),
    number: z.number().int().positive(),
    title: z.string().min(1).max(255).optional(),
    body: z.string().optional(),
  }).refine(({ title, body }) => title !== undefined || body !== undefined, {
    message: 'Provide a title or body to edit',
  }),
  async execute({ repo, number, title, body }, ctx) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not configured');

    const [owner, name] = repo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${number}`,
      {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2026-03-10',
        },
        body: JSON.stringify({
          ...(title === undefined ? {} : { title }),
          ...(body === undefined ? {} : { body }),
        }),
        signal: ctx.abortSignal,
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(`GitHub API error (${response.status}): ${error?.message ?? response.statusText}`);
    }

    const issue = (await response.json()) as { number: number; html_url: string };
    return { number: issue.number, url: issue.html_url };
  },
});

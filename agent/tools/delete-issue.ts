import { defineTool } from 'eve/tools';
import { always } from 'eve/tools/approval';
import { z } from 'zod';

export default defineTool({
  description: 'Permanently delete a GitHub issue. Requires repository admin permission.',
  inputSchema: z.object({
    repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'Use owner/repo format'),
    number: z.number().int().positive(),
  }),
  approval: always(),
  async execute({ repo, number }, ctx) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is not configured');

    const [owner, name] = repo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${number}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2026-03-10',
        },
        signal: ctx.abortSignal,
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(`GitHub API error (${response.status}): ${error?.message ?? response.statusText}`);
    }

    const issue = (await response.json()) as { node_id: string; pull_request?: unknown };
    if (issue.pull_request) throw new Error('The requested number belongs to a pull request');

    const deletion = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'mutation DeleteIssue($id: ID!) { deleteIssue(input: { issueId: $id }) { repository { id } } }',
        variables: { id: issue.node_id },
      }),
      signal: ctx.abortSignal,
    });

    const result = (await deletion.json().catch(() => null)) as {
      data?: { deleteIssue?: { repository?: { id: string } } };
      errors?: { message: string }[];
      message?: string;
    } | null;
    if (!deletion.ok || result?.errors?.length || !result?.data?.deleteIssue?.repository) {
      const message = result?.errors?.map((error) => error.message).join('; ') || result?.message || deletion.statusText;
      throw new Error(`GitHub API error (${deletion.status}): ${message}`);
    }

    return { deleted: true, repo, number };
  },
});

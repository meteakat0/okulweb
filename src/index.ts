import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error("GITHUB_TOKEN environment variable is required.");
  console.error("Create a .env file with: GITHUB_TOKEN=your_token_here");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const server = new McpServer({
  name: "github-mcp-server",
  version: "1.0.0",
});

// ─── Tool: Get authenticated user info ───
server.tool("get_me", "Get the authenticated GitHub user's profile info", {}, async () => {
  const { data } = await octokit.rest.users.getAuthenticated();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            login: data.login,
            name: data.name,
            bio: data.bio,
            public_repos: data.public_repos,
            followers: data.followers,
            following: data.following,
            html_url: data.html_url,
          },
          null,
          2
        ),
      },
    ],
  };
});

// ─── Tool: List repositories ───
// @ts-expect-error MCP SDK deep type instantiation with optional zod fields
server.tool(
  "list_repos",
  "List repositories for the authenticated user",
  {
    sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().describe("Sort by"),
    per_page: z.number().min(1).max(100).optional().describe("Results per page (max 100)"),
    page: z.number().min(1).optional().describe("Page number"),
  },
  async ({ sort, per_page, page }) => {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: sort ?? "updated",
      per_page: per_page ?? 30,
      page: page ?? 1,
    });

    const repos = data.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      html_url: repo.html_url,
      updated_at: repo.updated_at,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(repos, null, 2) }],
    };
  }
);

// ─── Tool: Get repository details ───
server.tool(
  "get_repo",
  "Get detailed information about a specific repository",
  {
    owner: z.string().describe("Repository owner (username or org)"),
    repo: z.string().describe("Repository name"),
  },
  async ({ owner, repo }) => {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: data.name,
              full_name: data.full_name,
              description: data.description,
              private: data.private,
              language: data.language,
              default_branch: data.default_branch,
              stars: data.stargazers_count,
              forks: data.forks_count,
              open_issues: data.open_issues_count,
              html_url: data.html_url,
              clone_url: data.clone_url,
              created_at: data.created_at,
              updated_at: data.updated_at,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: List issues ───
// @ts-expect-error MCP SDK deep type instantiation with optional zod fields
server.tool(
  "list_issues",
  "List issues for a repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().describe("Issue state filter"),
    per_page: z.number().min(1).max(100).optional().describe("Results per page"),
    page: z.number().min(1).optional().describe("Page number"),
  },
  async ({ owner, repo, state, per_page, page }) => {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: state ?? "open",
      per_page: per_page ?? 30,
      page: page ?? 1,
    });

    const issues = data.map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      user: issue.user?.login,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
      created_at: issue.created_at,
      html_url: issue.html_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
    };
  }
);

// ─── Tool: Create issue ───
// @ts-expect-error MCP SDK deep type instantiation with optional zod fields
server.tool(
  "create_issue",
  "Create a new issue in a repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body/description"),
    labels: z.array(z.string()).optional().describe("Labels to assign"),
  },
  async ({ owner, repo, title, body, labels }) => {
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              number: data.number,
              title: data.title,
              state: data.state,
              html_url: data.html_url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: Create repository ───
// @ts-expect-error MCP SDK deep type instantiation with optional zod fields
server.tool(
  "create_repo",
  "Create a new GitHub repository",
  {
    name: z.string().describe("Repository name"),
    description: z.string().optional().describe("Repository description"),
    private: z.boolean().optional().describe("Whether the repo is private"),
    auto_init: z.boolean().optional().describe("Initialize with a README"),
  },
  async ({ name, description, private: isPrivate, auto_init }) => {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate ?? false,
      auto_init: auto_init ?? true,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: data.name,
              full_name: data.full_name,
              private: data.private,
              html_url: data.html_url,
              clone_url: data.clone_url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: List pull requests ───
server.tool(
  "list_pull_requests",
  "List pull requests for a repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    state: z.enum(["open", "closed", "all"]).optional().describe("PR state filter"),
    per_page: z.number().min(1).max(100).optional().describe("Results per page"),
  },
  async ({ owner, repo, state, per_page }) => {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: state ?? "open",
      per_page: per_page ?? 30,
    });

    const prs = data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      user: pr.user?.login,
      head: pr.head.ref,
      base: pr.base.ref,
      created_at: pr.created_at,
      html_url: pr.html_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(prs, null, 2) }],
    };
  }
);

// ─── Tool: Get file contents ───
server.tool(
  "get_file_contents",
  "Get the contents of a file from a repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    path: z.string().describe("File path in the repository"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA"),
  },
  async ({ owner, repo, path, ref }) => {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data)) {
      const entries = data.map((item) => ({
        name: item.name,
        type: item.type,
        path: item.path,
        size: item.size,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      };
    }

    if (data.type === "file" && "content" in data) {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return {
        content: [{ type: "text", text: decoded }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ─── Tool: Search repositories ───
server.tool(
  "search_repos",
  "Search for GitHub repositories",
  {
    query: z.string().describe("Search query"),
    per_page: z.number().min(1).max(100).optional().describe("Results per page"),
  },
  async ({ query, per_page }) => {
    const { data } = await octokit.rest.search.repos({
      q: query,
      per_page: per_page ?? 10,
    });

    const repos = data.items.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      html_url: repo.html_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(repos, null, 2) }],
    };
  }
);

// ─── Tool: Search code ───
server.tool(
  "search_code",
  "Search for code across GitHub repositories",
  {
    query: z.string().describe("Search query (e.g. 'addClass in:file language:js')"),
    per_page: z.number().min(1).max(100).optional().describe("Results per page"),
  },
  async ({ query, per_page }) => {
    const { data } = await octokit.rest.search.code({
      q: query,
      per_page: per_page ?? 10,
    });

    const results = data.items.map((item) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      html_url: item.html_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ─── Start the server ───
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

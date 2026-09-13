import { Link } from "react-router";

import { useApi } from "../hooks/useApi.js";
import type { EmbeddingsView, ServerState, SummariesView } from "../types.js";

export const LAMP_REFRESH_MS = 15000;

type Served = { project: string; enabled: boolean; server: ServerState };

type Address = { server: ServerState; projects: string[] };

const RANK = { down: 0, unknown: 1, ok: 2 } as const;

function when(stamp: string | null): string {
  return stamp === null ? "never" : new Date(stamp).toLocaleString("en-GB");
}

function enabledRows(rows: Served[] | undefined, project?: string): Served[] {
  return (rows ?? []).filter(
    (row) => row.enabled && (project === undefined || row.project === project),
  );
}

function addresses(rows: Served[]): Address[] {
  const byUrl = new Map<string, Address>();
  for (const row of rows) {
    const entry = byUrl.get(row.server.url) ?? {
      server: row.server,
      projects: [],
    };
    entry.projects.push(row.project);
    byUrl.set(row.server.url, entry);
  }
  return [...byUrl.values()].sort(
    (a, b) => RANK[a.server.state] - RANK[b.server.state],
  );
}

function describe(server: ServerState): string {
  const where = server.url === "" ? "no server URL" : server.url;
  if (server.state === "ok") {
    return `${where} answers (checked ${when(server.checked_at)})`;
  }
  if (server.state === "down") {
    return `${where} does not answer since ${when(server.since)}: ${server.reason}`;
  }
  return `${where}: ${server.reason}`;
}

function worst(rows: Served[]): ServerState["state"] {
  if (rows.some((row) => row.server.state === "down")) {
    return "down";
  }
  return rows.every((row) => row.server.state === "ok") ? "ok" : "unknown";
}

function Lamp({
  label,
  rows,
  to,
  counted,
}: {
  label: string;
  rows: Served[];
  to: string;
  counted: boolean;
}) {
  if (rows.length === 0) {
    return null;
  }
  const title = addresses(rows)
    .map(({ server, projects }) =>
      counted
        ? `${describe(server)} - ${projects.length} project(s)`
        : describe(server),
    )
    .join("\n");
  return (
    <Link to={to} className={`lamp lamp-${worst(rows)}`} title={title}>
      <span className="lamp-dot" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Embed and summarize lamps for every enabled project, or for the one named. */
export function QueueLamps({ project }: { project?: string }) {
  const embeddings = useApi<EmbeddingsView>("/embeddings", LAMP_REFRESH_MS);
  const summaries = useApi<SummariesView>("/summaries", LAMP_REFRESH_MS);
  const to =
    project === undefined
      ? "/settings"
      : `/projects/${encodeURIComponent(project)}?tab=settings`;
  return (
    <span className="lamps">
      <Lamp
        label="embed"
        rows={enabledRows(embeddings.data?.embeddings, project)}
        to={to}
        counted={project === undefined}
      />
      <Lamp
        label="summarize"
        rows={enabledRows(summaries.data?.summaries, project)}
        to={to}
        counted={project === undefined}
      />
    </span>
  );
}

/** Each address the enabled projects dial, with what it last did. */
export function ServerLines({
  rows,
  project,
}: {
  rows: Served[] | undefined;
  project?: string;
}) {
  return (
    <>
      {addresses(enabledRows(rows, project)).map(({ server, projects }) => (
        <p key={server.url} className={`server-state lamp-${server.state}`}>
          <span className="lamp-dot" aria-hidden="true" />
          {describe(server)}
          {project === undefined && ` - ${projects.join(", ")}`}
        </p>
      ))}
    </>
  );
}

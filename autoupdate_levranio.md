# Enggraph auto-update on Mini PC

## Purpose

The Enggraph installation on the Mini PC (`leosrv`) is configured to check for new Docker images once every 24 hours and automatically apply them.

The upstream project is:

- https://github.com/oberon-systems/enggraph

The deployed Docker images come from GitHub Container Registry (GHCR), using the upstream `latest` images.

## Mini PC deployment

Project directory:

`/opt/levrangit/enggraph`

Local configuration is stored in:

`/opt/levrangit/enggraph/.env`

The `.env` file is local and contains deployment-specific configuration and secrets. The automatic update mechanism does **not** modify or replace this file.

The PostgreSQL data is kept in the Docker volume and is not deleted by the update process.

Caddy is installed and managed separately by systemd and is not modified by the Enggraph update process.

## Update script

The update script is:

`/usr/local/sbin/enggraph-update.sh`

It performs:

1. Changes to `/opt/levrangit/enggraph`.
2. Runs `docker compose pull` to check/pull newer Docker images.
3. Runs `docker compose up -d`.
4. Writes the result to:
   `/opt/levrangit/enggraph/enggraph-update.log`

If an image has changed, Docker Compose recreates the affected container automatically. For example, if the `mcp-server` image is updated, the old `mcp-server` container is replaced with a container using the new image and started automatically.

If there are no new images, the existing containers remain running.

## systemd service

The service is:

`enggraph-update.service`

It runs:

`/usr/local/sbin/enggraph-update.sh`

The service uses:

`User=leo`

and:

`WorkingDirectory=/opt/levrangit/enggraph`

It is a `Type=oneshot` service, so `inactive (dead)` after a successful run is normal. A successful execution has:

`status=0/SUCCESS`

## systemd timer

The timer is:

`enggraph-update.timer`

Current schedule:

- first run: 10 minutes after boot
- subsequent runs: every 24 hours
- `Persistent=true`: if the Mini PC was powered off when a scheduled run was missed, systemd can run the missed timer after the machine comes back online.

The timer is enabled and should normally show:

`Active: active (waiting)`

To inspect it:

```bash
systemctl status enggraph-update.timer --no-pager
systemctl list-timers enggraph-update.timer --no-pager
```

## Manual update

To run the update immediately:

```bash
sudo systemctl start enggraph-update.service
```

Then check:

```bash
systemctl status enggraph-update.service --no-pager
```

A successful oneshot service normally returns to `inactive (dead)` with `status=0/SUCCESS`.

## Update log

The latest update activity is recorded in:

`/opt/levrangit/enggraph/enggraph-update.log`

View recent entries:

```bash
tail -50 /opt/levrangit/enggraph/enggraph-update.log
```

## Important architecture detail

The Mini PC does **not** perform a blind `git pull` for runtime updates.

Runtime updates are based on Docker images published by the upstream Enggraph project. This is intentional:

- local `.env` remains untouched;
- local PostgreSQL data remains untouched;
- local Caddy configuration remains untouched;
- only Docker images/containers are updated;
- the Mini PC follows the upstream published container releases.

The upstream Enggraph Docker publishing workflow publishes images to GHCR on its release/tag workflow. Therefore a commit appearing in the upstream Git repository does not necessarily mean that a new `latest` Docker image is immediately available.

## Current public MCP endpoint

The deployed MCP endpoint is:

`https://levranio.duckdns.org/mcp/enggraph`

Traffic reaches the Mini PC through HTTPS/Caddy and then the local Enggraph gateway.

The update of `mcp-server` does not require a manual restart. When its Docker image changes, `docker compose up -d` automatically recreates and starts the new `mcp-server` container.

## Recovery / troubleshooting

If the timer is not active:

```bash
sudo systemctl enable --now enggraph-update.timer
```

If an update fails:

```bash
systemctl status enggraph-update.service --no-pager
tail -100 /opt/levrangit/enggraph/enggraph-update.log
```

Do not delete the PostgreSQL Docker volume as part of routine update troubleshooting.

## Configuration created on the Mini PC

The automatic update consists of these systemd files:

- `/usr/local/sbin/enggraph-update.sh`
- `/etc/systemd/system/enggraph-update.service`
- `/etc/systemd/system/enggraph-update.timer`

These files are part of the Mini PC deployment configuration and are not automatically created by the upstream Enggraph repository.

## Established policy

The intended update frequency is **once per day**, not every few minutes. This is sufficient because the upstream project publishes deployable Docker images through its release workflow rather than requiring the Mini PC to follow every source-code commit.

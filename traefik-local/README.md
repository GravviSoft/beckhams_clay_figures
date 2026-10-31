# Shared local Traefik

One local Traefik serves every sibling app. Each app joins the same external
`proxy-net` network and claims its own `*.localhost` hostname and router names.

## First check whether one is already running

```bash
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i traefik
```

- **A Traefik already publishes `0.0.0.0:80`** (for example another project's
  `traefik-local`): do nothing here. This app's labels attach to it
  automatically through `proxy-net`.
- **No Traefik is running:** start this fallback once:

```bash
docker network inspect proxy-net >/dev/null 2>&1 || docker network create proxy-net
docker compose up -d
```

Never start a second proxy for the same port, never give this app a bare
`localhost` router (another app may own it), and stop this proxy only when no
local project needs it:

```bash
docker compose down
```

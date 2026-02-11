# neko-tunnel

Self-hosted remote browser accessible from anywhere via a Cloudflare Tunnel. Runs [n.eko](https://github.com/m1k1o/neko) (Google Chrome in Docker) with **microphone passthrough** — so you can browse, use Upwork, take Zoom calls, or do anything you'd do on a regular browser, remotely.

Built for situations where someone needs access to a browser running on your machine from a restricted network. All traffic goes through Cloudflare's edge — no open ports, no public IP required.

## How it works

```
Your mate's browser  --->  Cloudflare Tunnel  --->  neko (Chrome in Docker on your PC)
     (anywhere)              (HTTPS + WSS)              (video/audio via WebRTC)
                                                        (mic via TURN relay)
```

- **neko** runs a full Google Chrome instance inside a Docker container with a virtual display, streams it to the browser via WebRTC
- **cloudflared** creates a secure tunnel from the container to Cloudflare's edge, giving it a public HTTPS URL with no port forwarding
- **Cloudflare TURN** relays the WebRTC media stream when you're behind NAT (no public IP needed)
- **mic-inject.js** adds a microphone button to neko's toolbar (the upstream client doesn't have one yet — [PR #620](https://github.com/m1k1o/neko/pull/620))

## Prerequisites

- Docker and Docker Compose
- A Cloudflare account with a domain
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) CLI installed
- (Optional) Cloudflare TURN key for WebRTC behind NAT — free tier at [Cloudflare Calls](https://dash.cloudflare.com/?to=/:account/calls)

## Setup

### 1. Create the tunnel

```bash
cloudflared tunnel create neko-tunnel
cloudflared tunnel route dns neko-tunnel your-subdomain.example.com
```

### 2. Configure cloudflared

Copy the credentials file that was created:

```bash
mkdir -p config/cloudflared
cp ~/.cloudflared/<TUNNEL-UUID>.json config/cloudflared/credentials.json
```

Create `config/cloudflared/config.yml` from the example:

```bash
cp config/cloudflared/config.example.yml config/cloudflared/config.yml
```

Edit it with your tunnel UUID and hostname.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your passwords and (optionally) Cloudflare TURN credentials.

### 4. Start

```bash
./start.sh
```

This generates fresh TURN credentials (if configured), then starts neko + cloudflared. Open your tunnel URL in a browser and log in.

### Managing the stack

```bash
# Stop
docker compose --profile tunnel down

# Logs
docker compose --profile tunnel logs -f

# Restart (regenerates TURN credentials)
./start.sh
```

## What's in the box

| File | Purpose |
|---|---|
| `docker-compose.yml` | neko (Google Chrome) + cloudflared tunnel |
| `start.sh` | Generates Cloudflare TURN credentials and starts the stack |
| `mic-inject.js` | Adds microphone button to neko's toolbar via DOM injection |
| `index.html` | Patched neko index that loads the mic script |
| `.env.example` | Template for passwords and TURN config |
| `config/cloudflared/config.example.yml` | Template for tunnel config |

## Microphone support

The neko v3 server supports mic passthrough via WebRTC, but the bundled client has no UI for it. This project includes `mic-inject.js` which:

1. Intercepts the `RTCPeerConnection` that neko creates
2. Adds a mic toggle button to the bottom toolbar
3. On click, calls `getUserMedia({ audio: true })` and adds the audio track to the peer connection
4. The server receives it and pipes it into PulseAudio's virtual microphone inside the container

This means Chrome inside the container sees a working microphone — Zoom web client, Google Meet, voice recorders, etc. all work.

A proper upstream PR has been submitted: [m1k1o/neko#620](https://github.com/m1k1o/neko/pull/620)

## NAT / no public IP

If you're behind NAT (most home networks), WebRTC can't establish a direct UDP connection. The stack uses [Cloudflare TURN](https://developers.cloudflare.com/calls/turn/) to relay the media stream. The free tier gives you plenty of bandwidth for a single user.

If you skip the TURN config, `start.sh` falls back to Google STUN servers — this works if your NAT is permissive but will fail on strict/symmetric NAT.

## Notes

- TURN credentials expire after 24 hours. Re-run `./start.sh` to refresh them.
- Browser profile data persists in `data/chromium/` so cookies and sessions survive restarts.
- The `admin` password gets priority control over keyboard/mouse. The `user` password is for view + shared control.
- Implicit hosting is enabled — click inside the video to take control, no need to request it.

## License

MIT

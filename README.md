# MikroMeet

**Self-hosted, ultralight video conferencing solution that prioritizes simplicity.**

![MikroMeet product view](./mikromeet.png)

MikroMeet is an ultralight, self-hosted video meeting app for teams who want freedom, privacy, and control over their calls without a heavy hosted platform.

![Build Status](https://github.com/mikaelvesavuori/mikromeet/workflows/build/badge.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

_Use MikroMeet online for free at [meet.mikrosuite.com](https://meet.mikrosuite.com). It runs over HTTPS, needs no account, and uses room links plus WebRTC media for private calls._

_NB: MikroMeet was previous known as MikroRoom._

## Features

- **Batteries included** - paired frontend and backend release archives
- **Self-hosted meetings** with full control over app and data
- **WebRTC video and audio** with lightweight signaling
- **Room management** for small-team video calls
- **Scheduled rooms and calendar invites** for lightweight meeting planning
- **Moderator controls** for practical meeting administration
- **Built-in chat, replies, reactions, and local pinning** during calls
- **Screen sharing, file transfer, and local recording** for everyday meetings
- **Waiting room and room locking** for moderator-led sessions
- **Reconnect feedback and media fallback** when networks or devices misbehave
- **Low-overhead client** built with vanilla TypeScript, HTML, and CSS
- **No runtime dependencies** in the core server path
- **Configurable ICE servers** for STUN/TURN connectivity
- **Static frontend** that can be hosted anywhere

## Quick Start

Open [meet.mikrosuite.com](https://meet.mikrosuite.com) to start a meeting immediately, securely, and without an account.

### Download the App and API

```bash
curl -sSL -o mikromeet_app.zip https://releases.mikrosuite.com/mikromeet_app_latest.zip
curl -sSL -o mikromeet_api.zip https://releases.mikrosuite.com/mikromeet_api_latest.zip
unzip mikromeet_app.zip -d mikromeet_app
unzip mikromeet_api.zip -d mikromeet_api
```

Start the API:

```bash
cd mikromeet_api/*
node mikromeet.mjs
```

Serve the app from any static host:

```bash
cd ../../mikromeet_app/*
npx http-server . -a 127.0.0.1 -p 8000 -c-1
```

Open `http://127.0.0.1:8000`.

## Configuration

MikroMeet works out of the box. The frontend reads public runtime settings from `config.json`; `mikromeet.config.json` remains available as a legacy alias. The server reads deployment settings from environment variables.

Common production settings include:

- `MIKROMEET_PORT` or `PORT` - backend server port
- `USE_HTTPS`, `SSL_CERT_PATH`, `SSL_KEY_PATH` - optional direct HTTPS serving
- `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, `TURN_SERVER_CREDENTIAL` - TURN connectivity
- `config.json` - frontend API URL and ICE server config
- `mikromeet.config.json` - legacy frontend config alias
- HTTPS or a trusted local environment for camera and microphone access

Example frontend runtime config:

```json
{
  "apiUrl": "wss://api.yourdomain.com/ws",
  "iceServers": [
    { "urls": "stun:stun.cloudflare.com:3478" }
  ]
}
```

## API

- `GET /` returns the API endpoint index
- `GET /health` returns service health
- `GET /config` returns public ICE server settings for the frontend
- `POST /api/rooms` creates a scheduled or pre-created room
- `GET /ws` upgrades to the WebSocket signaling channel used by rooms

The WebSocket API handles room join/leave, WebRTC offer/answer exchange, ICE candidates, chat, reactions, moderation, screen sharing, file transfer, and recording state.

## Documentation

Full documentation is available at **[mikrosuite.com/meet/docs](https://mikrosuite.com/meet/docs)**:

- [Introduction](https://mikrosuite.com/meet/docs/getting-started/introduction) - What is MikroMeet?
- [Installation](https://mikrosuite.com/meet/docs/getting-started/installation) - Get up and running
- [Configuration](https://mikrosuite.com/meet/docs/guides/configuration) - Runtime and deployment settings
- [Meeting Features](https://mikrosuite.com/meet/docs/guides/meeting-features) - Room behavior and controls
- [Deployment](https://mikrosuite.com/meet/docs/guides/deployment) - Production deployment guide
- [API Reference](https://mikrosuite.com/meet/docs/reference/api) - HTTP and WebSocket API

## Release Downloads

The latest release archives are available from GitHub Releases and these stable URLs:

- `https://releases.mikrosuite.com/mikromeet_app_latest.zip` - static browser app
- `https://releases.mikrosuite.com/mikromeet_api_latest.zip` - Node API bundle

## Technology

- **Frontend**: Vanilla HTML, CSS, and TypeScript
- **Backend**: Node.js and TypeScript
- **Realtime**: WebRTC plus WebSocket signaling
- **Distribution**: Prebuilt app and API release archives

## License

MIT. See the [LICENSE](LICENSE) file.

import type { ChatMessageUI, FileTransfer, PeerConnection } from "./types.js";

export interface ParticipantListItem {
  id: string;
  name: string;
  isModerator: boolean;
  isMuted: boolean;
  isHandRaised: boolean;
  isMe: boolean;
}

export interface FileTransferActions {
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}

export function createRemoteVideoElement(peer: PeerConnection): HTMLElement {
  const videoItem = document.createElement("div");
  videoItem.className = "video-item remote";
  videoItem.id = `video-${peer.participantId}`;
  videoItem.dataset.participantId = peer.participantId;
  videoItem.title = "Double-click to pin";

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  if (peer.stream) {
    video.srcObject = peer.stream;
  }

  const handBadge = document.createElement("div");
  handBadge.className = `tile-hand-badge ${peer.isHandRaised ? "" : "hidden"}`;
  handBadge.title = "Hand raised";
  handBadge.innerHTML = '<svg class="icon"><use href="#icon-hand"/></svg><span>Hand raised</span>';

  const label = document.createElement("div");
  label.className = "video-label";
  label.innerHTML = `
    <span class="name"></span>
    <span class="status-icons">
      <span class="muted-icon ${peer.isMuted ? "visible" : ""}">
        <svg class="icon"><use href="#icon-mic-off"/></svg>
      </span>
      <span class="video-off-icon ${peer.isVideoOff ? "visible" : ""}">
        <svg class="icon"><use href="#icon-video-off"/></svg>
      </span>
      <span class="hand-icon ${peer.isHandRaised ? "visible" : ""}">
        <svg class="icon"><use href="#icon-hand"/></svg>
      </span>
      ${peer.isModerator ? '<span class="moderator-icon"><svg class="icon" style="fill: #a855f7;"><use href="#icon-record"/></svg></span>' : ""}
    </span>
  `;
  label.querySelector(".name")!.textContent = peer.name;

  videoItem.appendChild(video);
  videoItem.appendChild(handBadge);
  videoItem.appendChild(label);
  videoItem.classList.toggle("hand-raised", peer.isHandRaised);
  return videoItem;
}

export function createChatMessageElement(message: ChatMessageUI): HTMLElement {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message ${message.isMe ? "me" : ""}`;
  messageEl.dataset.messageId = message.id;

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `
    <div class="chat-message-header">
      <span class="name">${escapeHtml(message.participantName)}</span>
      <span class="chat-message-meta">
        <span class="time">${time}</span>
        <button class="chat-reply-btn" data-chat-action="reply" data-message-id="${escapeAttr(message.id)}" title="Reply">Reply</button>
      </span>
    </div>
    <div class="chat-message-text">${linkify(escapeHtml(message.text))}</div>
  `;

  if (message.replyTo) {
    const preview = message.replyPreview ? escapeHtml(message.replyPreview) : "Replying to message";
    html = `<div class="reply-indicator">${preview}</div>${html}`;
  }

  messageEl.innerHTML = html;
  return messageEl;
}

export function createParticipantListItem(
  participant: ParticipantListItem,
  canModerate: boolean,
): HTMLElement {
  const item = document.createElement("div");
  item.className = "participant-item";
  item.dataset.participantId = participant.id;

  let html = `
    <div class="participant-info">
      <span class="participant-name"></span>
      <span class="participant-badges">
        ${participant.isModerator ? '<span class="badge moderator">Mod</span>' : ""}
        ${
          participant.isHandRaised
            ? '<svg class="icon badge-icon hand"><use href="#icon-hand"/></svg>'
            : ""
        }
        ${
          participant.isMuted
            ? '<svg class="icon badge-icon muted"><use href="#icon-mic-off"/></svg>'
            : ""
        }
      </span>
    </div>
  `;

  if (canModerate && !participant.isMe) {
    html += `
      <div class="participant-actions">
        ${
          participant.isMuted
            ? `<button class="btn-icon participant-action-btn" data-action="unmute" data-id="${escapeAttr(participant.id)}" title="Unmute">
          <svg class="icon"><use href="#icon-mic"/></svg>
        </button>`
            : `<button class="btn-icon participant-action-btn" data-action="mute" data-id="${escapeAttr(participant.id)}" title="Mute">
          <svg class="icon"><use href="#icon-mic-off"/></svg>
        </button>`
        }
        <button class="btn-icon participant-action-btn" data-action="kick" data-id="${escapeAttr(participant.id)}" title="Remove">
          <svg class="icon"><use href="#icon-close"/></svg>
        </button>
        ${
          !participant.isModerator
            ? `<button class="btn-icon participant-action-btn" data-action="make-moderator" data-id="${escapeAttr(participant.id)}" title="Make moderator">
          <svg class="icon"><use href="#make-moderator"/></svg>
        </button>`
            : ""
        }
      </div>
    `;
  }

  item.innerHTML = html;
  item.querySelector(".participant-name")!.textContent =
    `${participant.name}${participant.isMe ? " (You)" : ""}`;
  return item;
}

export function createWaitingRoomItem(
  person: { id: string; name: string },
  onAdmit: (id: string) => void,
  onReject: (id: string) => void,
): HTMLElement {
  const item = document.createElement("div");
  item.className = "waiting-item";
  item.innerHTML = `
    <span class="name"></span>
    <div class="actions">
      <button class="btn-admit">Admit</button>
      <button class="btn-reject">Reject</button>
    </div>
  `;
  item.querySelector(".name")!.textContent = person.name;
  item.querySelector(".btn-admit")?.addEventListener("click", () => {
    onAdmit(person.id);
  });
  item.querySelector(".btn-reject")?.addEventListener("click", () => {
    onReject(person.id);
  });
  return item;
}

export function createFileTransferItem(
  transfer: FileTransfer,
  actions?: FileTransferActions,
): HTMLElement {
  const item = document.createElement("div");
  item.className = "file-transfer-item";
  item.dataset.transferId = transfer.id;

  const isReceiving = transfer.senderName !== "You";
  item.innerHTML = `
    <div class="file-info">
      <span class="file-name">${escapeHtml(transfer.fileName)}</span>
      <span class="file-size">${formatFileSize(transfer.fileSize)}</span>
      <span class="file-sender">${
        isReceiving ? `From: ${escapeHtml(transfer.senderName)}` : "Sending..."
      }</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill progress-width-0"></div>
    </div>
    <div class="file-actions">
      ${
        isReceiving
          ? '<button class="btn-accept">Accept</button><button class="btn-reject">Reject</button>'
          : '<button class="btn-cancel">Cancel</button>'
      }
    </div>
  `;

  item.querySelector(".btn-accept")?.addEventListener("click", () => {
    actions?.onAccept?.();
    const actionsEl = item.querySelector(".file-actions");
    if (actionsEl) actionsEl.textContent = "Receiving...";
  });
  item.querySelector(".btn-reject")?.addEventListener("click", () => actions?.onReject?.());
  item.querySelector(".btn-cancel")?.addEventListener("click", () => actions?.onCancel?.());
  return item;
}

export function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function linkify(escapedHtml: string): string {
  return escapedHtml.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

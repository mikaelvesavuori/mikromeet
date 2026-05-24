export type {
  AdmitUserMessage,
  AnswerMessage,
  BaseMessage,
  ChatMessage,
  ErrorMessage,
  FileAnswerMessage,
  FileChunkMessage,
  FileOfferMessage,
  IceCandidateMessage,
  JoinMessage,
  LeaveMessage,
  LowerHandMessage,
  MessageType,
  ModeratorAction,
  ModeratorActionMessage,
  OfferMessage,
  ParticipantJoinedMessage,
  ParticipantLeftMessage,
  ParticipantUpdatedMessage,
  QualityChangeMessage,
  RaiseHandMessage,
  ReactionMessage,
  RecordingStartedMessage,
  RecordingStoppedMessage,
  RejectUserMessage,
  RoomLockedMessage,
  RoomUnlockedMessage,
  SignalingMessage,
  WaitingRoomMessage,
} from "../shared/signaling-types.js";

export interface PeerConnection {
  participantId: string;
  name: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isModerator: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
}

export interface ChatMessageUI {
  id: string;
  participantId: string;
  participantName: string;
  text: string;
  timestamp: number;
  isMe: boolean;
  replyTo?: string;
  replyPreview?: string;
}

export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  senderId: string;
  senderName: string;
  targetId?: string;
  chunks: string[];
  receivedChunks: number;
  totalChunks: number;
  blob?: Blob;
}

export interface AppState {
  roomId: string;
  participantName: string;
  participantId: string | null;
  localStream: MediaStream | null;
  peers: Map<string, PeerConnection>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isModerator: boolean;
  isHandRaised: boolean;
  isRoomLocked: boolean;
  isRecording: boolean;
  chatMessages: ChatMessageUI[];
  activeFileTransfers: Map<string, FileTransfer>;
}

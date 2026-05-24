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

export interface Participant {
  id: string;
  name: string;
  socket: WebSocket;
  roomId: string;
  isModerator: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  joinedAt: number;
}

export interface WaitingParticipant {
  id: string;
  name: string;
  socket: WebSocket;
  requestedAt: number;
}

export interface Room {
  id: string;
  participants: Map<string, Participant>;
  waitingRoom: Map<string, WaitingParticipant>;
  password?: string;
  isLocked: boolean;
  hostId: string | null;
  createdAt: number;
  maxParticipants: number;
  creatorToken?: string;
  isPreCreated?: boolean;
  title?: string;
  scheduledStart?: number;
  scheduledEnd?: number;
}

export interface RoomConfig {
  password?: string;
  maxParticipants?: number;
  requireApproval?: boolean;
  title?: string;
  scheduledStart?: number;
  scheduledEnd?: number;
}

export interface ServerStats {
  totalRooms: number;
  totalParticipants: number;
  peakParticipants: number;
  uptime: number;
  version: string;
}

export interface PreCreatedRoomData {
  roomId: string;
  password?: string;
  creatorToken: string;
  createdAt: number;
  maxParticipants: number;
  title?: string;
  scheduledStart?: number;
  scheduledEnd?: number;
}

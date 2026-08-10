export interface User {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  image: string | null;
  banner?: string | null;
  profileSetup: boolean;
  color?: number | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  availabilityStatus?: "online" | "away" | "brb" | "dnd";
  createdAt?: string;
  isWhitelisted?: boolean;
  isWhitelistEnabled?: boolean;
  twoFactorEnabled?: boolean;
  isDisabled?: boolean;
  deletionScheduledAt?: string | null;
  badges?: Badge[];
  featuredBadgeIds?: string[];
  language?: "pl" | "en";
}

export interface Badge {
  _id?: string;
  badgeId?: {
    _id: string;
    name: string;
    icon: string;
    color: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  assignedAt?: string;
}

export interface Contact {
  _id: string;
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  image: string | null;
  banner?: string | null;
  color?: number;
  isOnline?: boolean;
  lastSeen?: string | null;
  availabilityStatus?: "online" | "away" | "brb" | "dnd";
  createdAt?: string;
  lastMessageTime?: string;
  lastMessage?: string;
  unreadCount?: number;
  isMuted?: boolean;
  isBlockedByMe?: boolean;
  badges?: Badge[];
  moderationExpiresAt?: string | null;
  moderationPermanent?: boolean;
}

export interface FriendRequestItem {
  _id: string;
  from?: Contact;
  to?: Contact;
  status: string;
  createdAt: string;
}

export interface Channel {
  _id: string;
  name: string;
  image?: string;
  admin: Contact;
  members: Contact[];
  updatedAt?: string;
  description?: string;
  lastMessageTime?: string;
  lastMessage?: string;
  unreadCount?: number;
  isMuted?: boolean;
  rateLimitPerUser?: number;
  chatLocked?: boolean;
  isMutedHere?: boolean;
}

export interface ChannelDetails extends Channel {
  bannedMembers?: Contact[];
  mutedMembers?: Contact[];
  memberCount: number;
  isAdmin: boolean;
  isMuted: boolean;
}

export interface MessageUser {
  _id?: string;
  id?: string;
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  image?: string | null;
  banner?: string | null;
  color?: number;
}

export interface Message {
  _id: string;
  sender: MessageUser | string;
  recipient?: MessageUser | string;
  channel?: string;
  channelId?: string;
  content: string;
  messageType?: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  durationMs?: number;
  timestamp: string;
  read?: boolean;
  edited?: boolean;
  editedAt?: string;
  deleted?: boolean;
  pinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: MessageUser | string;
  reactions?: MessageReactions;
  quotedMessage?: Message | string | null;
  mentions?: MessageUser[];
  mentionsEveryone?: boolean;
}

export type MessageReactions = Record<string, string[]>;

/** Kandydat do wzmianki (@user) w polu wprowadzania wiadomości. */
export interface MentionCandidate {
  id: string;
  username: string;
  displayName?: string | null;
  image?: string | null;
  color?: number;
}

export type ChatTarget =
  | { type: "dm"; contact: Contact }
  | { type: "channel"; channel: Channel };

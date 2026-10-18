// Shapes shared by the API and the client.

export type Status = "online" | "idle" | "dnd" | "invisible" | "offline";

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  avatarSeed: number;
  bannerColor: string | null;
  about: string;
  pronouns: string;
  customStatus: string;
  createdAt: number;
  status: Status; // effective presence (invisible shows as offline to others)
}

export interface Me extends PublicUser {
  statusPref: Exclude<Status, "offline">;
}

export type ChannelType = "text" | "voice" | "dm" | "group";

export interface Channel {
  id: string;
  serverId: string | null;
  categoryId: string | null;
  type: ChannelType;
  name: string;
  topic: string;
  position: number;
  isPrivate: boolean;
  roleIds: string[]; // for private server channels
  ownerId: string | null; // group DM owner
  icon: string | null;
  lastMessageId: string | null;
  recipients?: string[]; // dm/group: user ids (excluding me)
}

export interface Category {
  id: string;
  serverId: string;
  name: string;
  position: number;
}

export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: string | null;
  position: number;
  permissions: number;
  hoist: boolean;
  isDefault: boolean;
}

export interface Server {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  description: string;
  isPublic: boolean;
  bannerColor: string | null;
  createdAt: number;
  memberCount: number;
  myPermissions: number;
}

export interface Member {
  userId: string;
  serverId: string;
  nickname: string | null;
  roleIds: string[];
  joinedAt: number;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  me: boolean;
  userIds: string[];
}

export interface ReplyPreview {
  id: string;
  authorId: string | null;
  content: string;
  hasAttachments: boolean;
  deleted?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string | null;
  content: string;
  type: "default" | "join" | "call" | "pin" | "system";
  replyTo: ReplyPreview | null;
  mentions: string[];
  mentionEveryone: boolean;
  pinned: boolean;
  editedAt: number | null;
  createdAt: number;
  attachments: Attachment[];
  reactions: ReactionGroup[];
  nonce?: string;
}

export type FriendState = "none" | "friends" | "incoming" | "outgoing" | "blocked";

export interface Relationship {
  userId: string;
  type: Exclude<FriendState, "none">;
  since: number;
}

export interface VoiceState {
  userId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  streaming: boolean;
  video: boolean;
}

export interface UnreadInfo {
  channelId: string;
  lastReadId: string | null;
  mentionCount: number;
}

export interface Bootstrap {
  me: Me;
  users: PublicUser[];
  servers: Server[];
  channels: Channel[];
  categories: Category[];
  roles: Role[];
  myRoles: Record<string, string[]>; // serverId -> role ids
  relationships: Relationship[];
  unreads: UnreadInfo[];
  voice: VoiceState[];
}

export interface InviteInfo {
  code: string;
  server: { id: string; name: string; icon: string | null; description: string; bannerColor: string | null };
  memberCount: number;
  onlineCount: number;
  inviter: { displayName: string } | null;
  joined: boolean;
}

export interface DiscoverServer {
  id: string;
  name: string;
  icon: string | null;
  description: string;
  bannerColor: string | null;
  memberCount: number;
  onlineCount: number;
  createdAt: number;
  joined: boolean;
}

export const Perm = {
  ADMIN: 1 << 0,
  MANAGE_SERVER: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_ROLES: 1 << 3,
  KICK: 1 << 4,
  BAN: 1 << 5,
  MANAGE_MESSAGES: 1 << 6,
  MENTION_EVERYONE: 1 << 7,
  CREATE_INVITE: 1 << 8,
  SEND_MESSAGES: 1 << 9,
  ATTACH_FILES: 1 << 10,
  ADD_REACTIONS: 1 << 11,
  CONNECT: 1 << 12,
  MANAGE_NICKNAMES: 1 << 13,
} as const;

export const ALL_PERMS = Object.values(Perm).reduce((a, b) => a | b, 0);

export const DEFAULT_PERMS =
  Perm.SEND_MESSAGES | Perm.ATTACH_FILES | Perm.ADD_REACTIONS | Perm.CONNECT | Perm.CREATE_INVITE;

export const PERM_INFO: { key: keyof typeof Perm; label: string; desc: string; group: string }[] = [
  { key: "ADMIN", label: "Administrator", desc: "Every permission, and skips channel limits. Hand this out carefully.", group: "General" },
  { key: "MANAGE_SERVER", label: "Manage Server", desc: "Change the server name, icon, description and discovery.", group: "General" },
  { key: "MANAGE_CHANNELS", label: "Manage Channels", desc: "Create, edit, reorder and delete channels and categories.", group: "General" },
  { key: "MANAGE_ROLES", label: "Manage Roles", desc: "Create and edit roles below their highest role, and assign them.", group: "General" },
  { key: "CREATE_INVITE", label: "Create Invite", desc: "Make invite links for this server.", group: "Membership" },
  { key: "MANAGE_NICKNAMES", label: "Manage Nicknames", desc: "Change other members' nicknames.", group: "Membership" },
  { key: "KICK", label: "Kick Members", desc: "Remove people. They can come back with an invite.", group: "Membership" },
  { key: "BAN", label: "Ban Members", desc: "Remove people for good, unless they're unbanned.", group: "Membership" },
  { key: "SEND_MESSAGES", label: "Send Messages", desc: "Post in text channels.", group: "Text" },
  { key: "ATTACH_FILES", label: "Attach Files", desc: "Upload pictures and files.", group: "Text" },
  { key: "ADD_REACTIONS", label: "Add Reactions", desc: "React to messages with emoji.", group: "Text" },
  { key: "MENTION_EVERYONE", label: "Mention @everyone", desc: "Ping everyone who can see the channel.", group: "Text" },
  { key: "MANAGE_MESSAGES", label: "Manage Messages", desc: "Delete and pin other people's messages.", group: "Text" },
  { key: "CONNECT", label: "Connect to Voice", desc: "Join voice channels, talk and share a screen.", group: "Voice" },
];

export function hasPerm(perms: number, p: number): boolean {
  return (perms & Perm.ADMIN) !== 0 || (perms & p) === p;
}

export const LIMITS = {
  messageLength: 4000,
  attachmentBytes: 10 * 1024 * 1024,
  attachmentsPerMessage: 10,
  avatarBytes: 4 * 1024 * 1024,
  nameLength: 32,
  serverName: 64,
  aboutLength: 190,
  customStatus: 80,
  channelName: 64,
  topic: 256,
};

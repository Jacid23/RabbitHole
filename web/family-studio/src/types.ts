export type User = { id: string; name: string; email: string; role: string; is_admin?: boolean; user_mode?: boolean };
export type UserProfile = { name: string; sex: string; age: number | null; content_level: "general" | "teen" | "adult"; instructions: string };
export type Model = { id: string; name: string; description: string };
export type Workflow = {
  opening?: HoleOpening | null;
  theme?: string;
  content_level?: string;
  chat_model?: string;
  enhancer_model?: string;
  id: string;
  name: string;
  description: string;
  size?: {
    ratios: string[];
    resolutions: Record<string, number>;
    default_ratio: string;
    default_resolution: string;
  };
  steps?: { min: number; max: number; default: number };
  seed: boolean;
  needs_image: boolean;
  loras: { id: string; label: string }[];
  max_loras: number;
};
export type StartingIdea = { label: string; prompt: string };
export type HoleOpening = {
  examples?: OpeningExample[];
  screen?: "chat" | "create";
  greeting?: string;
  chat_starters?: StartingIdea[];
  image_starters?: StartingIdea[];
};
export type OpeningExample = { image: string; label: string; chat: string; prompt: string };
export type ImageItem = {
  id: string;
  prompt: string;
  workflow?: string;
  workflow_name: string;
  created: number;
  url?: string;
  options?: Record<string, unknown>;
};
export type Job = {
  id: string;
  state: string;
  message: string;
  progress: number | null;
  elapsed: number;
  prompt: string;
  workflow: string;
  images: string[];
  comfy_id?: string;
};
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatAction = "lock" | "unlock" | "trash" | "restore";
export type PurgeChats = (ids: string[]) => Promise<void>;
export type ManageChat = (id: string, action: ChatAction) => Promise<void>;
export type Conversation = {
  locked?: boolean;
  workflow?: string | null;
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  created: number;
  updated?: number;
};
export type Bootstrap = {
  user: User;
  models: Model[];
  workflows: Workflow[];
  images: ImageItem[];
  chats: Conversation[];
  trashed_chats?: Conversation[];
  jobs: Job[];
  openwebui: string;
};
export type Page = "chat" | "create" | "library" | "admin" | "people";
export type ImageOptions = {
  aspect_ratio: string;
  resolution: string;
  steps: number;
  seed: number;
};

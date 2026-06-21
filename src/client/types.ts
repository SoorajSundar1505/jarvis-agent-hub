export type AgentId = 'natasha' | 'thor' | 'pepper' | 'jarvis';

export interface VoiceConfig {
  rate: number;
  pitch: number;
  gender: 'male' | 'female';
}

export interface Agent {
  id: AgentId;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  voice: VoiceConfig;
  isFinal?: boolean;
}

export interface DebateLine {
  agentId: AgentId;
  name: string;
  text: string;
}

export interface ChatResponse {
  content: string;
}

export interface ApiError {
  error: { message: string };
}

// GitHub Copilot REST API types

export interface CopilotUsageDay {
  day: string;
  total_suggestions_count: number;
  total_acceptances_count: number;
  total_lines_suggested: number;
  total_lines_accepted: number;
  total_active_users: number;
  total_chat_acceptances: number;
  total_chat_turns: number;
  total_active_chat_users: number;
  breakdown: CopilotUsageBreakdown[];
}

export interface CopilotUsageBreakdown {
  language: string;
  editor: string;
  suggestions_count: number;
  acceptances_count: number;
  lines_suggested: number;
  lines_accepted: number;
  active_users: number;
}

export interface EditorBreakdown {
  editor: string;
  suggestions_count: number;
  acceptances_count: number;
  lines_suggested: number;
  lines_accepted: number;
  active_users: number;
}

export interface LanguageBreakdown {
  language: string;
  suggestions_count: number;
  acceptances_count: number;
  lines_suggested: number;
  lines_accepted: number;
  active_users: number;
}

export interface ModelBreakdown {
  model: string;
  interactions: number;
  code_generation: number;
  code_acceptances: number;
  lines_added: number;
  lines_deleted: number;
}

export interface UserUsageRecord {
  user_login: string;
  day: string;
  interactions: number;
  code_generation: number;
  code_acceptances: number;
  lines_added: number;
  lines_deleted: number;
  models: ModelBreakdown[];
  languages: LanguageBreakdown[];
  editors: string[];
  used_chat: boolean;
  used_agent: boolean;
  used_cli: boolean;
}

export interface ParsedCopilotUsage {
  date: string;
  totalSuggestions: number;
  totalAcceptances: number;
  acceptanceRate: number;
  totalLinesSuggested: number;
  totalLinesAccepted: number;
  lineAcceptanceRate: number;
  totalActiveUsers: number;
  totalChatAcceptances: number;
  totalChatTurns: number;
  totalActiveChatUsers: number;
  editorBreakdowns: EditorBreakdown[];
  languageBreakdowns: LanguageBreakdown[];
  modelBreakdowns: ModelBreakdown[];
  org: string;
}

import type {
  EditorBreakdown,
  LanguageBreakdown,
  ModelBreakdown,
  ParsedCopilotUsage,
  UserUsageRecord,
} from "../types/copilot.js";

const GITHUB_API_BASE = "https://api.github.com";

// Types for the enterprise reports API
interface ReportDayTotal {
  day: string;
  enterprise_id: string;
  daily_active_users: number;
  monthly_active_chat_users?: number;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  totals_by_ide: ReportIdeEntry[];
  totals_by_feature: ReportFeatureEntry[];
  totals_by_language_feature: ReportLanguageFeatureEntry[];
}

interface ReportIdeEntry {
  ide: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

interface ReportFeatureEntry {
  feature: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

interface ReportLanguageFeatureEntry {
  language: string;
  feature: string;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
}

interface ReportsApiResponse {
  download_links: string[];
  report_start_day: string;
  report_end_day: string;
}

interface ReportFile {
  report_start_day: string;
  report_end_day: string;
  enterprise_id: string;
  created_at: string;
  day_totals: ReportDayTotal[];
}

export class DataFetcher {
  /**
   * Fetch Copilot usage data for a specific date.
   * Uses the enterprise reports API when enterprise is specified,
   * otherwise falls back to the org metrics API.
   */
  async fetchUsage(
    org: string,
    token: string,
    date?: string,
    enterprise?: string,
  ): Promise<ParsedCopilotUsage> {
    if (enterprise) {
      return this.fetchEnterpriseReport(enterprise, org, token, date);
    }
    return this.fetchOrgMetrics(org, token, date);
  }

  /**
   * Fetch per-user usage for a specific day via the org users-1-day report.
   */
  async fetchUserReports(
    org: string,
    token: string,
    date: string,
  ): Promise<UserUsageRecord[]> {
    const url = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/copilot/metrics/reports/users-1-day?day=${encodeURIComponent(date)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) {
        throw new Error("GitHub API authentication failed. Check your token is valid.");
      }
      if (response.status === 403) {
        throw new Error(
          `Access denied (403). Your token needs 'manage_billing:copilot' or 'read:org' scope. Response: ${body.slice(0, 200)}`,
        );
      }
      if (response.status === 404) {
        throw new Error(
          `No per-user report found for ${date}. The org may not have reporting enabled. Response: ${body.slice(0, 200)}`,
        );
      }
      throw new Error(`GitHub API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as { download_links: string[] };

    if (!data.download_links || data.download_links.length === 0) {
      throw new Error("No download links found in the per-user report response.");
    }

    const fileResponse = await fetch(data.download_links[0]);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download user report: HTTP ${fileResponse.status}`);
    }

    const text = await fileResponse.text();
    const lines = text.trim().split("\n");
    const records: UserUsageRecord[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const raw = JSON.parse(line) as RawUserRecord;
      records.push(this.parseUserRecord(raw));
    }

    return records;
  }

  private parseUserRecord(raw: RawUserRecord): UserUsageRecord {
    // Aggregate models from totals_by_model_feature
    const modelMap = new Map<string, ModelBreakdown>();
    for (const mf of raw.totals_by_model_feature ?? []) {
      if (mf.model === "others") continue;
      const existing = modelMap.get(mf.model) ?? {
        model: mf.model,
        interactions: 0,
        code_generation: 0,
        code_acceptances: 0,
        lines_added: 0,
        lines_deleted: 0,
      };
      existing.interactions += mf.user_initiated_interaction_count;
      existing.code_generation += mf.code_generation_activity_count;
      existing.code_acceptances += mf.code_acceptance_activity_count;
      existing.lines_added += mf.loc_added_sum;
      existing.lines_deleted += mf.loc_deleted_sum;
      modelMap.set(mf.model, existing);
    }

    // Languages from totals_by_language_feature
    const langMap = new Map<string, LanguageBreakdown>();
    for (const lf of raw.totals_by_language_feature ?? []) {
      if (lf.language === "unknown" || lf.language === "others") continue;
      const existing = langMap.get(lf.language) ?? {
        language: lf.language,
        suggestions_count: 0,
        acceptances_count: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        active_users: 0,
      };
      existing.suggestions_count += lf.code_generation_activity_count;
      existing.acceptances_count += lf.code_acceptance_activity_count;
      existing.lines_suggested += lf.loc_suggested_to_add_sum;
      existing.lines_accepted += lf.loc_added_sum;
      langMap.set(lf.language, existing);
    }

    const editors = (raw.totals_by_ide ?? []).map((e) => e.ide);

    return {
      user_login: raw.user_login,
      day: raw.day,
      interactions: raw.user_initiated_interaction_count,
      code_generation: raw.code_generation_activity_count,
      code_acceptances: raw.code_acceptance_activity_count,
      lines_added: raw.loc_added_sum,
      lines_deleted: raw.loc_deleted_sum,
      models: [...modelMap.values()].sort((a, b) => b.interactions - a.interactions),
      languages: [...langMap.values()]
        .sort((a, b) => b.suggestions_count - a.suggestions_count)
        .slice(0, 5),
      editors,
      used_chat: raw.used_chat,
      used_agent: raw.used_agent,
      used_cli: raw.used_cli,
    };
  }

  /**
   * Fetch from the enterprise 28-day reports endpoint.
   */
  private async fetchEnterpriseReport(
    enterprise: string,
    org: string,
    token: string,
    date?: string,
  ): Promise<ParsedCopilotUsage> {
    const reportsUrl = `${GITHUB_API_BASE}/enterprises/${encodeURIComponent(enterprise)}/copilot/metrics/reports/enterprise-28-day/latest`;

    const reportsResponse = await fetch(reportsUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    if (!reportsResponse.ok) {
      const body = await reportsResponse.text();
      if (reportsResponse.status === 401) {
        throw new Error("GitHub API authentication failed. Check your token is valid.");
      }
      if (reportsResponse.status === 403) {
        throw new Error(
          `Access denied (403). Your token requires 'manage_billing:copilot' and 'read:enterprise' scopes. Response: ${body.slice(0, 200)}`,
        );
      }
      if (reportsResponse.status === 404) {
        throw new Error(
          `Enterprise '${enterprise}' reports not found (404). Ensure your token has 'read:enterprise' scope and you are an enterprise admin. Response: ${body.slice(0, 200)}`,
        );
      }
      throw new Error(`GitHub API error ${reportsResponse.status}: ${body.slice(0, 200)}`);
    }

    const reportsData = (await reportsResponse.json()) as ReportsApiResponse;

    if (!reportsData.download_links || reportsData.download_links.length === 0) {
      throw new Error("No download links found in the enterprise reports response.");
    }

    // Download report file and parse
    const fileResponse = await fetch(reportsData.download_links[0]);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download report file: HTTP ${fileResponse.status}`);
    }

    const reportFile = (await fileResponse.json()) as ReportFile;

    if (!reportFile.day_totals || reportFile.day_totals.length === 0) {
      throw new Error("No day_totals found in the enterprise report.");
    }

    // Find the target day
    let dayTotal: ReportDayTotal;
    if (date) {
      const found = reportFile.day_totals.find((d) => d.day === date);
      if (!found) {
        const available = reportFile.day_totals.map((d) => d.day).slice(-5).join(", ");
        throw new Error(`No data found for ${date}. Available dates: ${available}`);
      }
      dayTotal = found;
    } else {
      // Use the most recent day with activity
      const withActivity = reportFile.day_totals.filter(
        (d) =>
          d.code_generation_activity_count > 0 ||
          d.code_acceptance_activity_count > 0 ||
          d.user_initiated_interaction_count > 0,
      );
      dayTotal = withActivity.length > 0
        ? withActivity[withActivity.length - 1]
        : reportFile.day_totals[reportFile.day_totals.length - 1];
    }

    return this.parseDayTotal(dayTotal, org);
  }

  /**
   * Parse an enterprise report day_total into ParsedCopilotUsage.
   */
  private parseDayTotal(day: ReportDayTotal, org: string): ParsedCopilotUsage {
    const totalSuggestions = day.code_generation_activity_count;
    const totalAcceptances = day.code_acceptance_activity_count;
    const totalLinesSuggested = day.loc_suggested_to_add_sum;
    const totalLinesAccepted = day.loc_added_sum;

    const editorBreakdowns: EditorBreakdown[] = (day.totals_by_ide ?? []).map((ide) => ({
      editor: ide.ide,
      suggestions_count: ide.code_generation_activity_count,
      acceptances_count: ide.code_acceptance_activity_count,
      lines_suggested: ide.loc_suggested_to_add_sum,
      lines_accepted: ide.loc_added_sum,
      active_users: 0,
    }));

    // Aggregate language breakdowns (combine across features)
    const languageMap = new Map<string, LanguageBreakdown>();
    for (const lf of day.totals_by_language_feature ?? []) {
      if (lf.language === "unknown" || lf.language === "others") continue;
      const existing = languageMap.get(lf.language) ?? {
        language: lf.language,
        suggestions_count: 0,
        acceptances_count: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        active_users: 0,
      };
      existing.suggestions_count += lf.code_generation_activity_count;
      existing.acceptances_count += lf.code_acceptance_activity_count;
      existing.lines_suggested += lf.loc_suggested_to_add_sum;
      existing.lines_accepted += lf.loc_added_sum;
      languageMap.set(lf.language, existing);
    }

    // Chat metrics from features
    let totalChatTurns = 0;
    let totalChatAcceptances = 0;
    for (const feature of day.totals_by_feature ?? []) {
      if (feature.feature.includes("chat") || feature.feature === "copilot_cli") {
        totalChatTurns += feature.user_initiated_interaction_count;
        totalChatAcceptances += feature.code_acceptance_activity_count;
      }
    }

    const acceptanceRate =
      totalSuggestions > 0 ? (totalAcceptances / totalSuggestions) * 100 : 0;
    const lineAcceptanceRate =
      totalLinesSuggested > 0 ? (totalLinesAccepted / totalLinesSuggested) * 100 : 0;

    const languageBreakdowns = [...languageMap.values()]
      .sort((a, b) => b.suggestions_count - a.suggestions_count)
      .slice(0, 5);

    return {
      date: day.day,
      totalSuggestions,
      totalAcceptances,
      acceptanceRate,
      totalLinesSuggested,
      totalLinesAccepted,
      lineAcceptanceRate,
      totalActiveUsers: day.daily_active_users,
      totalChatAcceptances,
      totalChatTurns,
      totalActiveChatUsers: day.monthly_active_chat_users ?? 0,
      editorBreakdowns,
      languageBreakdowns,
      modelBreakdowns: [],
      org,
    };
  }

  /**
   * Fetch from the org-level /copilot/metrics endpoint (fallback for non-enterprise).
   */
  private async fetchOrgMetrics(
    org: string,
    token: string,
    date?: string,
  ): Promise<ParsedCopilotUsage> {
    const url = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/copilot/metrics?per_page=28`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401) {
        throw new Error("GitHub API authentication failed. Check your token is valid.");
      }
      if (response.status === 403) {
        throw new Error(
          `Access denied (403). Your token requires 'manage_billing:copilot' or 'read:org' scope. Response: ${body.slice(0, 200)}`,
        );
      }
      if (response.status === 404) {
        throw new Error(
          `Organization '${org}' not found or Copilot metrics not available (404). Response: ${body.slice(0, 200)}`,
        );
      }
      throw new Error(`GitHub API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(
        `Unexpected response from Copilot metrics API: expected an array but received ${typeof data}`,
      );
    }

    const days = data as OrgMetricsDay[];
    if (days.length === 0) {
      throw new Error(
        "No Copilot metrics data found. Ensure the organization has Copilot enabled and the Metrics API policy is enabled.",
      );
    }

    let day: OrgMetricsDay;
    if (date) {
      const found = days.find((d) => d.date === date);
      if (!found) {
        throw new Error(
          `No metrics data found for ${date}. Available dates: ${days.map((d) => d.date).slice(-5).join(", ")}`,
        );
      }
      day = found;
    } else {
      day = days[days.length - 1];
    }

    return this.parseOrgMetricsDay(day, org);
  }

  private parseOrgMetricsDay(day: OrgMetricsDay, org: string): ParsedCopilotUsage {
    const completions = day.copilot_ide_code_completions;

    let totalSuggestions = 0;
    let totalAcceptances = 0;
    let totalLinesSuggested = 0;
    let totalLinesAccepted = 0;

    const editorMap = new Map<string, EditorBreakdown>();
    const languageMap = new Map<string, LanguageBreakdown>();

    for (const editor of completions?.editors ?? []) {
      const editorEntry: EditorBreakdown = {
        editor: editor.name,
        suggestions_count: 0,
        acceptances_count: 0,
        lines_suggested: 0,
        lines_accepted: 0,
        active_users: editor.total_engaged_users ?? 0,
      };

      for (const model of editor.models ?? []) {
        for (const lang of model.languages ?? []) {
          const suggestions = lang.total_code_suggestions ?? 0;
          const acceptances = lang.total_code_acceptances ?? 0;
          const linesSuggested = lang.total_code_lines_suggested ?? 0;
          const linesAccepted = lang.total_code_lines_accepted ?? 0;

          totalSuggestions += suggestions;
          totalAcceptances += acceptances;
          totalLinesSuggested += linesSuggested;
          totalLinesAccepted += linesAccepted;

          editorEntry.suggestions_count += suggestions;
          editorEntry.acceptances_count += acceptances;
          editorEntry.lines_suggested += linesSuggested;
          editorEntry.lines_accepted += linesAccepted;

          const existing = languageMap.get(lang.name) ?? {
            language: lang.name,
            suggestions_count: 0,
            acceptances_count: 0,
            lines_suggested: 0,
            lines_accepted: 0,
            active_users: 0,
          };
          existing.suggestions_count += suggestions;
          existing.acceptances_count += acceptances;
          existing.lines_suggested += linesSuggested;
          existing.lines_accepted += linesAccepted;
          existing.active_users = Math.max(
            existing.active_users,
            lang.total_engaged_users ?? 0,
          );
          languageMap.set(lang.name, existing);
        }
      }

      editorMap.set(editor.name, editorEntry);
    }

    let totalChatTurns = 0;
    let totalChatAcceptances = 0;
    let totalActiveChatUsers = 0;

    for (const editor of day.copilot_ide_chat?.editors ?? []) {
      for (const model of editor.models ?? []) {
        totalChatTurns += model.total_chats ?? 0;
        totalChatAcceptances += model.total_chat_insertion_events ?? 0;
      }
      totalActiveChatUsers = Math.max(
        totalActiveChatUsers,
        editor.total_engaged_users ?? 0,
      );
    }

    for (const model of day.copilot_dotcom_chat?.models ?? []) {
      totalChatTurns += model.total_chats ?? 0;
      totalChatAcceptances += model.total_chat_insertion_events ?? 0;
    }
    totalActiveChatUsers = Math.max(
      totalActiveChatUsers,
      day.copilot_dotcom_chat?.total_engaged_users ?? 0,
    );

    const acceptanceRate =
      totalSuggestions > 0 ? (totalAcceptances / totalSuggestions) * 100 : 0;
    const lineAcceptanceRate =
      totalLinesSuggested > 0 ? (totalLinesAccepted / totalLinesSuggested) * 100 : 0;

    const languageBreakdowns = [...languageMap.values()]
      .sort((a, b) => b.suggestions_count - a.suggestions_count)
      .slice(0, 5);

    return {
      date: day.date,
      totalSuggestions,
      totalAcceptances,
      acceptanceRate,
      totalLinesSuggested,
      totalLinesAccepted,
      lineAcceptanceRate,
      totalActiveUsers: day.total_active_users ?? day.total_engaged_users ?? 0,
      totalChatAcceptances,
      totalChatTurns,
      totalActiveChatUsers,
      editorBreakdowns: [...editorMap.values()],
      languageBreakdowns,
      modelBreakdowns: [],
      org,
    };
  }
}

// Types for the org-level /copilot/metrics API
interface OrgMetricsLanguage {
  name: string;
  total_engaged_users?: number;
  total_code_suggestions?: number;
  total_code_acceptances?: number;
  total_code_lines_suggested?: number;
  total_code_lines_accepted?: number;
}

interface OrgMetricsModel {
  name: string;
  total_engaged_users?: number;
  languages?: OrgMetricsLanguage[];
}

interface OrgMetricsEditor {
  name: string;
  total_engaged_users?: number;
  models?: OrgMetricsModel[];
}

interface OrgMetricsChatModel {
  name: string;
  total_engaged_users?: number;
  total_chats?: number;
  total_chat_insertion_events?: number;
  total_chat_copy_events?: number;
}

interface OrgMetricsChatEditor {
  name: string;
  total_engaged_users?: number;
  models?: OrgMetricsChatModel[];
}

interface OrgMetricsDay {
  date: string;
  total_active_users?: number;
  total_engaged_users?: number;
  copilot_ide_code_completions?: {
    total_engaged_users?: number;
    languages?: OrgMetricsLanguage[];
    editors?: OrgMetricsEditor[];
  };
  copilot_ide_chat?: {
    total_engaged_users?: number;
    editors?: OrgMetricsChatEditor[];
  };
  copilot_dotcom_chat?: {
    total_engaged_users?: number;
    models?: OrgMetricsChatModel[];
  };
}

// Raw per-user record from the users-1-day report
interface RawUserRecord {
  user_id: number;
  user_login: string;
  day: string;
  organization_id: string;
  enterprise_id: string;
  user_initiated_interaction_count: number;
  code_generation_activity_count: number;
  code_acceptance_activity_count: number;
  loc_suggested_to_add_sum: number;
  loc_suggested_to_delete_sum: number;
  loc_added_sum: number;
  loc_deleted_sum: number;
  totals_by_ide: { ide: string }[];
  totals_by_feature: ReportFeatureEntry[];
  totals_by_language_feature: ReportLanguageFeatureEntry[];
  totals_by_model_feature: {
    model: string;
    feature: string;
    user_initiated_interaction_count: number;
    code_generation_activity_count: number;
    code_acceptance_activity_count: number;
    loc_suggested_to_add_sum: number;
    loc_suggested_to_delete_sum: number;
    loc_added_sum: number;
    loc_deleted_sum: number;
  }[];
  used_agent: boolean;
  used_chat: boolean;
  used_cli: boolean;
}

import type { ParsedCopilotUsage, UserUsageRecord } from "../types/copilot.js";
import type { ReceiptConfig } from "../types/config.js";
import { formatPercent, formatNumber, formatDate } from "../utils/formatting.js";
import { estimateModelCost } from "../core/pricing.js";

export interface ReceiptData {
  usage: ParsedCopilotUsage;
  location: string;
  config: ReceiptConfig;
  generatedAt: Date;
}

export class ReceiptGenerator {
  private width: number;

  constructor(width = 32) {
    this.width = this.normalizeWidth(width);
  }

  setWidth(width: number): void {
    this.width = this.normalizeWidth(width);
  }

  generateReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    const { usage } = data;

    // Clean header
    lines.push(this.line());
    lines.push(this.center("GITHUB COPILOT"));
    lines.push(this.center("Usage Receipt"));
    lines.push(this.line());
    lines.push("");

    // Meta info
    lines.push(this.center(`Org: ${usage.org}`));
    lines.push(this.center(`Date: ${formatDate(usage.date, data.config.timezone)}`));
    lines.push(this.center(`Location: ${data.location}`));
    lines.push("");
    lines.push(this.line());
    lines.push("");

    // Code completions
    lines.push("CODE COMPLETIONS");
    lines.push(this.rightPad("Suggestions", formatNumber(usage.totalSuggestions)));
    lines.push(this.rightPad("Accepted", formatNumber(usage.totalAcceptances)));
    lines.push(this.rightPad("Rate", formatPercent(usage.acceptanceRate)));
    lines.push("");

    // Chat section
    if (usage.totalChatTurns > 0) {
      lines.push("COPILOT CHAT");
      lines.push(this.rightPad("Chat Turns", formatNumber(usage.totalChatTurns)));
      lines.push(this.rightPad("Chat Accepted", formatNumber(usage.totalChatAcceptances)));
      lines.push("");
    }

    // Editors
    if (usage.editorBreakdowns.length > 0) {
      lines.push("TOP EDITORS");
      for (const editor of usage.editorBreakdowns.slice(0, 3)) {
        lines.push(this.rightPad(
          `  ${this.capitalize(editor.editor)}`,
          formatNumber(editor.suggestions_count),
        ));
      }
      lines.push("");
    }

    // Languages
    if (usage.languageBreakdowns.length > 0) {
      lines.push("TOP LANGUAGES");
      for (const lang of usage.languageBreakdowns.slice(0, 3)) {
        lines.push(this.rightPad(
          `  ${this.capitalize(lang.language)}`,
          formatNumber(lang.suggestions_count),
        ));
      }
      lines.push("");
    }

    // Totals
    lines.push(this.line());
    lines.push(this.rightPad("Active Users", formatNumber(usage.totalActiveUsers)));
    lines.push(this.rightPad("Total Users", formatNumber(usage.totalSuggestions)));
    lines.push("");

    // Footer
    lines.push(this.center("CASHIER: GitHub Copilot"));
    lines.push(this.center("Thank you for building!"));
    lines.push(this.center("github.com/features/copilot"));
    lines.push("");
    lines.push(this.line());

    return lines.join("\n");
  }

  generateUserReceipt(data: {
    user: UserUsageRecord;
    location: string;
    org: string;
    config: ReceiptConfig;
  }): string {
    const lines: string[] = [];
    const { user } = data;
    let totalCost = 0;

    // Clean header
    lines.push(this.line());
    lines.push(this.center("GITHUB COPILOT"));
    lines.push(this.center("Usage Receipt"));
    lines.push(this.line());
    lines.push("");

    // Meta info
    lines.push(this.center(`User: ${user.user_login}`));
    lines.push(this.center(`Org: ${data.org}`));
    lines.push(this.center(`Date: ${formatDate(user.day, data.config.timezone)}`));
    lines.push(this.center(`Location: ${data.location}`));
    lines.push("");
    lines.push(this.line());
    lines.push("");

    // Per-model sections
    for (const model of user.models) {
      if (
        model.interactions === 0 &&
        model.code_generation === 0 &&
        model.code_acceptances === 0
      ) {
        continue;
      }

      const estimate = estimateModelCost(
        model.model,
        model.interactions,
        model.code_generation,
        model.lines_added,
      );
      totalCost += estimate.cost;

      lines.push(this.capitalize(model.model));
      lines.push(this.rightPad("Interactions", formatNumber(model.interactions)));
      lines.push(
        this.rightPad("Code generations", formatNumber(model.code_generation)),
      );
      lines.push(this.rightPad("Acceptances", formatNumber(model.code_acceptances)));
      lines.push(this.rightPad("Cost", `$${estimate.cost.toFixed(2)}`));
      lines.push("");
    }

    // Total
    lines.push(this.line());
    lines.push(this.rightPad("TOTAL", `$${totalCost.toFixed(2)}`));
    lines.push("");

    // Footer
    lines.push(this.center("CASHIER: GitHub Copilot"));
    lines.push(this.center("Thank you for building!"));
    lines.push(this.center("github.com/features/copilot"));
    lines.push("");
    lines.push(this.line());

    return lines.join("\n");
  }

  // Helper methods
  private line(): string {
    return "-".repeat(this.width);
  }

  private center(text: string): string {
    const pad = Math.max(0, Math.floor((this.width - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  private rightPad(label: string, value: string): string {
    const gap = Math.max(1, this.width - label.length - value.length);
    return label + " ".repeat(gap) + value;
  }

  private normalizeWidth(width: number): number {
    if (!Number.isFinite(width)) return 32;
    return Math.max(20, Math.min(64, Math.trunc(width)));
  }

  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

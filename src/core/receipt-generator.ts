import type { ParsedCopilotUsage, UserUsageRecord } from "../types/copilot.js";
import type { ReceiptConfig } from "../types/config.js";
import { formatPercent, formatNumber, formatDate } from "../utils/formatting.js";
import { getHeader, SEPARATOR, LIGHT_SEPARATOR } from "../utils/ascii-art.js";
import { estimateModelCost } from "../core/pricing.js";

export interface ReceiptData {
  usage: ParsedCopilotUsage;
  location: string;
  config: ReceiptConfig;
  generatedAt: Date;
}

export class ReceiptGenerator {
  generateReceipt(data: ReceiptData): string {
    const lines: string[] = [];
    const { usage } = data;

    // Header
    lines.push(SEPARATOR);
    lines.push(getHeader());
    lines.push(SEPARATOR);
    lines.push("");

    // Meta info
    lines.push(this.centerText(`Location: ${data.location}`, 35));
    lines.push(this.centerText(`Org: ${usage.org}`, 35));
    lines.push(this.centerText(formatDate(usage.date, data.config.timezone), 35));
    lines.push("");

    // Code completions section
    lines.push(SEPARATOR);
    lines.push(this.padLine("ITEM", "COUNT", "RATE"));
    lines.push(LIGHT_SEPARATOR);

    lines.push(this.boldLabel("Code Completions"));
    lines.push(
      this.padLine(
        "  Suggestions",
        formatNumber(usage.totalSuggestions),
        "",
      ),
    );
    lines.push(
      this.padLine(
        "  Acceptances",
        formatNumber(usage.totalAcceptances),
        formatPercent(usage.acceptanceRate),
      ),
    );
    lines.push(
      this.padLine(
        "  Lines suggested",
        formatNumber(usage.totalLinesSuggested),
        "",
      ),
    );
    lines.push(
      this.padLine(
        "  Lines accepted",
        formatNumber(usage.totalLinesAccepted),
        formatPercent(usage.lineAcceptanceRate),
      ),
    );
    lines.push("");

    // Chat section (only if there is chat data)
    if (usage.totalChatTurns > 0) {
      lines.push(this.boldLabel("Copilot Chat"));
      lines.push(
        this.padLine(
          "  Turns",
          formatNumber(usage.totalChatTurns),
          "",
        ),
      );
      lines.push(
        this.padLine(
          "  Acceptances",
          formatNumber(usage.totalChatAcceptances),
          usage.totalChatTurns > 0
            ? formatPercent(
                (usage.totalChatAcceptances / usage.totalChatTurns) * 100,
              )
            : "—",
        ),
      );
      lines.push(
        this.padLine(
          "  Active users",
          formatNumber(usage.totalActiveChatUsers),
          "",
        ),
      );
      lines.push("");
    }

    // Editor breakdown
    if (usage.editorBreakdowns.length > 0) {
      lines.push(LIGHT_SEPARATOR);
      lines.push(this.boldLabel("By Editor"));
      for (const editor of usage.editorBreakdowns) {
        const rate =
          editor.suggestions_count > 0
            ? formatPercent(
                (editor.acceptances_count / editor.suggestions_count) * 100,
              )
            : "—";
        lines.push(
          this.padLine(
            `  ${this.capitalize(editor.editor)}`,
            formatNumber(editor.suggestions_count),
            rate,
          ),
        );
      }
      lines.push("");
    }

    // Language breakdown
    if (usage.languageBreakdowns.length > 0) {
      lines.push(LIGHT_SEPARATOR);
      lines.push(this.boldLabel("Top Languages"));
      for (const lang of usage.languageBreakdowns) {
        const rate =
          lang.suggestions_count > 0
            ? formatPercent(
                (lang.acceptances_count / lang.suggestions_count) * 100,
              )
            : "—";
        lines.push(
          this.padLine(
            `  ${this.capitalize(lang.language)}`,
            formatNumber(lang.suggestions_count),
            rate,
          ),
        );
      }
      lines.push("");
    }

    // Summary totals
    lines.push(SEPARATOR);
    lines.push(
      this.padLine(
        "ACCEPTANCE RATE",
        "",
        formatPercent(usage.acceptanceRate),
      ),
    );
    lines.push(
      this.padLine("LINE ACCEPTANCE", "", formatPercent(usage.lineAcceptanceRate)),
    );
    lines.push(LIGHT_SEPARATOR);
    lines.push(
      this.padLine("ACTIVE USERS", "", formatNumber(usage.totalActiveUsers)),
    );
    lines.push(SEPARATOR);
    lines.push("");

    // Footer
    lines.push(this.centerText("CASHIER: GitHub Copilot", 35));
    lines.push("");
    lines.push(this.centerText("Thank you for building!", 35));
    lines.push(this.centerText("github.com/features/copilot", 35));
    lines.push("");
    lines.push(SEPARATOR);

    return lines.join("\n");
  }

  /**
   * Generate a per-user receipt with per-model pricing.
   * Matches the style of the reference receipt image.
   */
  generateUserReceipt(data: {
    user: UserUsageRecord;
    location: string;
    org: string;
    config: ReceiptConfig;
  }): string {
    const lines: string[] = [];
    const { user } = data;
    const W = 40;
    const SEP = "═".repeat(W);
    const DASH = "─".repeat(W);

    // Header
    lines.push(getHeader());
    lines.push("");

    // Meta
    lines.push(this.centerText(`Location: ${data.location}`, W));
    lines.push(this.centerText(`User: ${user.user_login}`, W));
    lines.push(this.centerText(`Org: ${data.org}`, W));
    lines.push(this.centerText(formatDate(user.day, data.config.timezone), W));
    lines.push("");

    // Per-model sections with pricing (only models with activity)
    let totalCost = 0;

    for (const model of user.models) {
      if (model.interactions === 0 && model.code_generation === 0 && model.code_acceptances === 0 && model.lines_added === 0 && model.lines_deleted === 0) {
        continue;
      }
      const estimate = estimateModelCost(
        model.model,
        model.interactions,
        model.code_generation,
        model.lines_added,
      );
      totalCost += estimate.cost;

      lines.push(SEP);
      lines.push(this.rightAlign(
        this.capitalize(model.model),
        `$${estimate.cost.toFixed(2)}`,
        W,
      ));
      lines.push(DASH);
      lines.push(this.rightAlign("Interactions", formatNumber(model.interactions), W));
      lines.push(this.rightAlign("Code generations", formatNumber(model.code_generation), W));
      lines.push(this.rightAlign("Acceptances", formatNumber(model.code_acceptances), W));
      lines.push(this.rightAlign("Input tokens", formatNumber(estimate.inputTokens), W));
      lines.push(this.rightAlign("Output tokens", formatNumber(estimate.outputTokens), W));
      lines.push(this.rightAlign("Lines added", formatNumber(model.lines_added), W));
      lines.push(this.rightAlign("Lines deleted", formatNumber(model.lines_deleted), W));
      lines.push("");
    }

    // Total
    lines.push(SEP);
    lines.push(this.rightAlign("TOTAL", `$${totalCost.toFixed(2)}`, W));
    lines.push(SEP);
    lines.push("");

    // Footer
    lines.push(this.centerText("CASHIER: GitHub Copilot", W));
    lines.push("");
    lines.push(this.centerText("Thank you for building!", W));
    lines.push(this.centerText("github.com/features/copilot", W));
    lines.push("");
    lines.push(SEP);

    return lines.join("\n");
  }

  private padLine(
    left: string,
    middle: string,
    right: string,
    width: number = 35,
  ): string {
    const rightLen = right.length;
    const leftLen = left.length;
    const middleLen = middle.length;
    const totalContent = leftLen + middleLen + rightLen;
    const availableSpace = width - totalContent;

    if (availableSpace < 0) {
      return `${left} ${middle} ${right}`;
    }

    const middleSpace = Math.floor(availableSpace / 2);
    const rightSpace = availableSpace - middleSpace;

    return left + " ".repeat(middleSpace) + middle + " ".repeat(rightSpace) + right;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  private boldLabel(text: string): string {
    return text.toUpperCase();
  }

  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private rightAlign(label: string, value: string, width: number): string {
    const space = Math.max(1, width - label.length - value.length);
    return label + " ".repeat(space) + value;
  }
}

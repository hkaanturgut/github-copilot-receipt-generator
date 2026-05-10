/**
 * ASCII art header for GitHub Copilot receipts
 */

export const COPILOT_LOGO = `  ●  GitHub Copilot  ●
  ╔═══════════════╗
  ║  < / >        ║
  ╚═══════════════╝`;

export function getHeader(): string {
  return COPILOT_LOGO;
}

export const SEPARATOR = "━".repeat(32);
export const LIGHT_SEPARATOR = "─".repeat(32);

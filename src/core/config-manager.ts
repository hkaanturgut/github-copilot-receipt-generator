import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { ReceiptConfig } from "../types/config.js";
import { DEFAULT_CONFIG } from "../types/config.js";

export class ConfigManager {
  private configPath: string;

  constructor() {
    this.configPath = join(homedir(), ".copilot-receipts.config.json");
  }

  async loadConfig(): Promise<ReceiptConfig> {
    if (!existsSync(this.configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      const config = JSON.parse(content) as Partial<ReceiptConfig>;
      return { ...DEFAULT_CONFIG, ...config };
    } catch {
      console.warn("Failed to parse config file, using defaults");
      return { ...DEFAULT_CONFIG };
    }
  }

  async saveConfig(config: ReceiptConfig): Promise<void> {
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }
    await writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  async updateConfig(key: keyof ReceiptConfig, value: string): Promise<void> {
    const config = await this.loadConfig();
    const normalized = value || undefined; // treat empty string as unset
    switch (key) {
      case "version":
        config[key] = value || config[key];
        break;
      case "org":
      case "enterprise":
      case "token":
      case "location":
      case "timezone":
        config[key] = normalized;
        break;
      case "receiptWidth": {
        if (!value.trim()) {
          config.receiptWidth = DEFAULT_CONFIG.receiptWidth;
          break;
        }

        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 20 || parsed > 64) {
          throw new Error("receiptWidth must be an integer between 20 and 64.");
        }
        config.receiptWidth = parsed;
        break;
      }
    }
    await this.saveConfig(config);
  }

  async resetConfig(): Promise<void> {
    await this.saveConfig({ ...DEFAULT_CONFIG });
  }

  getConfigPath(): string {
    return this.configPath;
  }
}

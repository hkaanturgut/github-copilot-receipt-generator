import chalk from "chalk";
import ora from "ora";
import { mkdir, writeFile } from "fs/promises";
import { resolve, join } from "path";
import { homedir } from "os";
import { DataFetcher } from "../core/data-fetcher.js";
import { ReceiptGenerator } from "../core/receipt-generator.js";
import { HtmlRenderer } from "../core/html-renderer.js";
import { ConfigManager } from "../core/config-manager.js";
import { LocationDetector } from "../utils/location.js";
import { maybePrint, type PrintMode } from "../core/printer.js";

export type OutputFormat = "html" | "console";

export interface GenerateOptions {
  date?: string;
  output?: string[];
  location?: string;
  org?: string;
  enterprise?: string;
  token?: string;
  user?: string;
  print?: boolean;
  width?: string;
}

export class GenerateCommand {
  private dataFetcher = new DataFetcher();
  private receiptGenerator = new ReceiptGenerator();
  private htmlRenderer = new HtmlRenderer();
  private configManager = new ConfigManager();
  private locationDetector = new LocationDetector();

  async execute(options: GenerateOptions): Promise<void> {
    const spinner = ora("Generating receipt...").start();

    try {
      const config = await this.configManager.loadConfig();

      const configuredWidth =
        options.width !== undefined
          ? this.parseReceiptWidth(options.width)
          : (config.receiptWidth ?? 32);
      this.receiptGenerator.setWidth(configuredWidth);

      const org = options.org ?? config.org;
      const enterprise = options.enterprise ?? config.enterprise;
      const token =
        options.token ??
        config.token ??
        process.env.GITHUB_TOKEN ??
        process.env.GH_TOKEN;

      if (!org) {
        spinner.fail("Organization name is required.");
        console.error(
          chalk.red(
            '\nProvide --org <name> or set it with: copilot-receipts config --set org=<name>',
          ),
        );
        process.exit(1);
      }

      if (!token) {
        spinner.fail("GitHub token is required.");
        console.error(
          chalk.red(
            '\nProvide --token <token>, set GITHUB_TOKEN env var, or: copilot-receipts config --set token=<token>',
          ),
        );
        process.exit(1);
      }

      // Fetch usage data
      spinner.text = "Fetching Copilot usage from GitHub API...";

      // Get location
      const location =
        options.location ??
        (await this.locationDetector.getLocation(config));

      if (options.user) {
        // Per-user receipt mode
        const date = options.date ?? new Date().toISOString().slice(0, 10);
        spinner.text = `Fetching per-user report for ${date}...`;
        const users = await this.dataFetcher.fetchUserReports(org, token, date);
        const target = users.find(
          (u) => u.user_login.toLowerCase() === options.user!.toLowerCase(),
        );

        if (!target) {
          spinner.fail(`User "${options.user}" not found in report for ${date}.`);
          const logins = users.map((u) => u.user_login).join(", ");
          console.error(chalk.red(`\nAvailable users: ${logins}`));
          process.exit(1);
        }

        spinner.succeed(`Generated receipt for ${target.user_login}!`);
        const receiptText = this.receiptGenerator.generateUserReceipt({
          user: target,
          location,
          org,
          config,
        });

        // Always output to console first
        console.log("\n" + receiptText);

        // Then handle additional output formats (filter out console since we already did it)
        const additionalFormats = (options.output ?? [])
          .filter((f) => f !== "console");

        for (const format of additionalFormats) {
          if (format === "html") {
              // For per-user receipts, wrap the text in a simple HTML file
              const safeUser = target.user_login.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
              const safeDate = date.replace(/[^a-zA-Z0-9._-]/g, "_");
              const filename = `copilot-${safeUser}-${safeDate}.html`;
              const filePath = resolve(
                join(homedir(), ".copilot-receipts", "receipts", filename),
              );
              
              // Ensure directory exists
              await mkdir(resolve(join(homedir(), ".copilot-receipts", "receipts")), {
                recursive: true,
              });

              const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Copilot Receipt — ${target.user_login}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; white-space: pre-wrap; word-wrap: break-word; padding: 20px; background: #f5f5f5; }
    .receipt { background: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="receipt">${receiptText}</div>
</body>
</html>`;

              await writeFile(filePath, html, "utf-8");
              const url = `file://${filePath}`;
              console.log(chalk.green(`\n✓ HTML receipt saved: ${filePath}`));
              console.log(chalk.cyan(`  Open in browser: ${url}`));

              // Thermal print step
              const printMode: PrintMode = options.print === true
                ? "force"
                : options.print === false
                  ? "skip"
                  : "prompt";
              await maybePrint(filePath, { mode: printMode, receiptText });
            }
        }
        return;
      }

      const usage = await this.dataFetcher.fetchUsage(org, token, options.date, enterprise);

      const receiptData = {
        usage,
        location,
        config,
        generatedAt: new Date(),
      };

      const receiptText = this.receiptGenerator.generateReceipt(receiptData);

      spinner.succeed("Receipt generated!");

      // Always output to console first
      console.log("\n" + receiptText);

      // Then handle additional output formats (filter out console since we already did it)
      const additionalFormats = (options.output ?? [])
        .filter((f) => f !== "console");

      for (const format of additionalFormats) {
        if (format === "html") {
          const filePath = await this.htmlRenderer.renderToFile(
            receiptData,
            receiptText,
          );
          const url = this.htmlRenderer.fileUrl(filePath);
          console.log(chalk.green(`\n✓ HTML receipt saved: ${filePath}`));
          console.log(chalk.cyan(`  Open in browser: ${url}`));

          // Thermal print step — send plain text version (CUPS + thermal
          // printers don't support HTML directly)
          const printMode: PrintMode = options.print === true
            ? "force"
            : options.print === false
              ? "skip"
              : "prompt";
          await maybePrint(filePath, { mode: printMode, receiptText });
        }
      }
    } catch (error) {
      spinner.fail("Failed to generate receipt.");
      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));
      } else {
        console.error(chalk.red("\nAn unknown error occurred."));
      }
      process.exit(1);
    }
  }

  private parseReceiptWidth(raw: string): number {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 64) {
      throw new Error("--width must be an integer between 20 and 64");
    }
    return parsed;
  }
}

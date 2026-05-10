// Thermal printer integration for ZJ-5890K / POS58 on macOS via CUPS.

import { exec } from "child_process";
import { promisify } from "util";
import { createInterface } from "readline";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

export const PRINTER_CONFIG = {
  name: "POS58_Printer",
  paperSize: "X48MMY210MM",
  model: "ZJ-5890K",
  widthMm: 58,
  widthChars: 32,
  topBufferLines: 2,
  bottomBufferLines: 6,
} as const;

export type PrintMode = "prompt" | "force" | "skip";

/**
 * Prompt user with a yes/no question. Default: No.
 */
function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith("y"));
    });
  });
}

/**
 * Send a file (PNG/JPG/PDF/TXT/HTML) to the thermal printer via CUPS.
 */
export async function printFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Print failed, file not found: ${filePath}`);
  }

  // Print generated text receipts in raw mode so the printer firmware handles
  // monospaced text directly without CUPS text filters changing layout.
  const isText = filePath.toLowerCase().endsWith(".txt");
  const cmd = isText
    ? [
        "lp",
        `-d ${PRINTER_CONFIG.name}`,
        "-o raw",
        `-- ${JSON.stringify(filePath)}`,
      ].join(" ")
    : [
        "lp",
        `-d ${PRINTER_CONFIG.name}`,
        `-o media=${PRINTER_CONFIG.paperSize}`,
        `-- ${JSON.stringify(filePath)}`,
      ].join(" ");

  const { stdout, stderr } = await execAsync(cmd);
  if (stderr) console.warn(`[printer] stderr: ${stderr.trim()}`);
  return stdout.trim();
}

/**
 * Decide whether to print, then print if appropriate.
 * If receiptText is provided, it is written to a temp .txt file for printing
 * (thermal printers handle plain text natively via CUPS).
 */
export async function maybePrint(
  filePath: string,
  { mode = "prompt" as PrintMode, receiptText }: { mode?: PrintMode; receiptText?: string } = {},
): Promise<{ printed: boolean; jobId?: string; error?: string }> {
  let shouldPrint = false;

  if (mode === "force") {
    shouldPrint = true;
  } else if (mode === "skip") {
    shouldPrint = false;
  } else {
    shouldPrint = await askYesNo("Print this receipt to the thermal printer?");
  }

  if (!shouldPrint) return { printed: false };

  let printPath = filePath;
  let tempFile: string | undefined;

  // If receipt text is provided, write it to a temp file so CUPS can print
  // plain text (HTML is not supported by most thermal printer drivers).
  if (receiptText) {
    tempFile = join(tmpdir(), `copilot-receipt-${Date.now()}.txt`);
    const topPad = "\n".repeat(Math.max(0, PRINTER_CONFIG.topBufferLines));
    const bottomPad = "\n".repeat(Math.max(0, PRINTER_CONFIG.bottomBufferLines));
    const bufferedText = `${topPad}${receiptText}\n${bottomPad}`;
    writeFileSync(tempFile, bufferedText, "utf-8");
    printPath = tempFile;
  }

  try {
    const jobId = await printFile(printPath);
    console.log(`[printer] sent to ${PRINTER_CONFIG.name}: ${jobId}`);
    return { printed: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[printer] failed: ${message}`);
    return { printed: false, error: message };
  } finally {
    if (tempFile && existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch { /* ignore cleanup errors */ }
    }
  }
}

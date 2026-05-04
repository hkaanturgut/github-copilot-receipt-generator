/**
 * GitHub Copilot model pricing and token estimation.
 *
 * Pricing is per 1M tokens (USD) from:
 * https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
 *
 * Token estimates are derived from activity counts:
 * - Each interaction (chat turn): ~2000 input tokens, ~800 output tokens
 * - Each code generation (completion/edit): ~1500 input tokens, ~200 output tokens
 * - Each line of code added: ~20 additional output tokens
 */

export interface ModelPricing {
  inputPer1M: number;
  cachedPer1M: number;
  cacheWritePer1M?: number; // Anthropic only
  outputPer1M: number;
}

// Per-1M-token pricing (USD) from GitHub Copilot docs
const MODEL_PRICES: Record<string, ModelPricing> = {
  // Anthropic (has cache write cost)
  "claude-opus-4.7": { inputPer1M: 5.00, cachedPer1M: 0.50, cacheWritePer1M: 6.25, outputPer1M: 25.00 },
  "claude-opus-4.6": { inputPer1M: 5.00, cachedPer1M: 0.50, cacheWritePer1M: 6.25, outputPer1M: 25.00 },
  "claude-opus-4.5": { inputPer1M: 5.00, cachedPer1M: 0.50, cacheWritePer1M: 6.25, outputPer1M: 25.00 },
  "claude-sonnet-4.6": { inputPer1M: 3.00, cachedPer1M: 0.30, cacheWritePer1M: 3.75, outputPer1M: 15.00 },
  "claude-sonnet-4.5": { inputPer1M: 3.00, cachedPer1M: 0.30, cacheWritePer1M: 3.75, outputPer1M: 15.00 },
  "claude-sonnet-4": { inputPer1M: 3.00, cachedPer1M: 0.30, cacheWritePer1M: 3.75, outputPer1M: 15.00 },
  "claude-4.5-haiku": { inputPer1M: 1.00, cachedPer1M: 0.10, cacheWritePer1M: 1.25, outputPer1M: 5.00 },
  "claude-haiku-4.5": { inputPer1M: 1.00, cachedPer1M: 0.10, cacheWritePer1M: 1.25, outputPer1M: 5.00 },
  // OpenAI
  "gpt-5.5": { inputPer1M: 5.00, cachedPer1M: 0.50, outputPer1M: 30.00 },
  "gpt-5.4": { inputPer1M: 2.50, cachedPer1M: 0.25, outputPer1M: 15.00 },
  "gpt-5.4-mini": { inputPer1M: 0.75, cachedPer1M: 0.075, outputPer1M: 4.50 },
  "gpt-5.4-nano": { inputPer1M: 0.20, cachedPer1M: 0.02, outputPer1M: 1.25 },
  "gpt-5.3-codex": { inputPer1M: 1.75, cachedPer1M: 0.175, outputPer1M: 14.00 },
  "gpt-5.2-codex": { inputPer1M: 1.75, cachedPer1M: 0.175, outputPer1M: 14.00 },
  "gpt-5.2": { inputPer1M: 1.75, cachedPer1M: 0.175, outputPer1M: 14.00 },
  "gpt-5-mini": { inputPer1M: 0.25, cachedPer1M: 0.025, outputPer1M: 2.00 },
  "gpt-4.1": { inputPer1M: 2.00, cachedPer1M: 0.50, outputPer1M: 8.00 },
  "gpt-4o": { inputPer1M: 2.00, cachedPer1M: 0.50, outputPer1M: 8.00 },
  "gpt-4o-mini": { inputPer1M: 0.25, cachedPer1M: 0.025, outputPer1M: 2.00 },
  // Google
  "gemini-2.5-pro": { inputPer1M: 1.25, cachedPer1M: 0.125, outputPer1M: 10.00 },
  "gemini-3-flash": { inputPer1M: 0.50, cachedPer1M: 0.05, outputPer1M: 3.00 },
  "gemini-3.1-pro": { inputPer1M: 2.00, cachedPer1M: 0.20, outputPer1M: 12.00 },
  // xAI
  "grok-code-fast-1": { inputPer1M: 0.20, cachedPer1M: 0.02, outputPer1M: 1.50 },
  // GitHub fine-tuned
  "raptor-mini": { inputPer1M: 0.25, cachedPer1M: 0.025, outputPer1M: 2.00 },
  "goldeneye": { inputPer1M: 1.25, cachedPer1M: 0.125, outputPer1M: 10.00 },
  // Default fallback
  "default": { inputPer1M: 2.00, cachedPer1M: 0.20, outputPer1M: 10.00 },
};

// Token estimation constants
const TOKENS_PER_INTERACTION_INPUT = 2000;
const TOKENS_PER_INTERACTION_OUTPUT = 800;
const TOKENS_PER_CODE_GEN_INPUT = 1500;
const TOKENS_PER_CODE_GEN_OUTPUT = 200;
const TOKENS_PER_LINE = 20;

export interface ModelCostEstimate {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICES[model] ?? MODEL_PRICES["default"];
}

export function estimateModelCost(
  model: string,
  interactions: number,
  codeGenerations: number,
  linesAdded: number,
): ModelCostEstimate {
  const inputTokens =
    interactions * TOKENS_PER_INTERACTION_INPUT +
    codeGenerations * TOKENS_PER_CODE_GEN_INPUT;

  const outputTokens =
    interactions * TOKENS_PER_INTERACTION_OUTPUT +
    codeGenerations * TOKENS_PER_CODE_GEN_OUTPUT +
    linesAdded * TOKENS_PER_LINE;

  const pricing = getModelPricing(model);

  const cost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;

  return { model, inputTokens, outputTokens, cost };
}

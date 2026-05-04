// Configuration file types

export interface ReceiptConfig {
  version: string;
  org?: string;
  enterprise?: string;
  token?: string;
  location?: string;
  timezone?: string;
}

export const DEFAULT_CONFIG: ReceiptConfig = {
  version: "1.0.0",
};

// Plug-in interface — V1 noop. V2 conectar Claude Sonnet vision o GPT-4 vision.

export interface AIVisionProvider {
  readonly name: string;
  available(): boolean;
  analyze(blob: Blob, prompt?: string): Promise<{ summary: string; entities: Record<string, string> }>;
}

export const noopAIVision: AIVisionProvider = {
  name: "noop",
  available: () => false,
  async analyze() {
    throw new Error("Análisis AI no implementado (V1)");
  },
};

let active: AIVisionProvider = noopAIVision;

export function registerAIVision(provider: AIVisionProvider): void {
  active = provider;
}

export function getAIVision(): AIVisionProvider {
  return active;
}

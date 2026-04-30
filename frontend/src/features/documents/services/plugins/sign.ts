// Plug-in interface — V1 noop. V2 integraciones DocuSign / FirmaVirtual.cl.

export interface SignProvider {
  readonly name: string;
  available(): boolean;
  requestSignature(documentId: string, signerEmail: string): Promise<{ envelopeId: string }>;
}

export const noopSign: SignProvider = {
  name: "noop",
  available: () => false,
  async requestSignature() {
    throw new Error("Firma no implementada (V1)");
  },
};

let active: SignProvider = noopSign;

export function registerSign(provider: SignProvider): void {
  active = provider;
}

export function getSign(): SignProvider {
  return active;
}

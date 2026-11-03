import type { AuditData } from '../types/audit';

/** Full audit payload kept off the React tree until a lead submit returns status "sent". */
let sealed: AuditData | null = null;

export function sealAudit(data: AuditData): void {
  sealed = data;
}

export function takeSealedAudit(): AuditData | null {
  const value = sealed;
  sealed = null;
  return value;
}

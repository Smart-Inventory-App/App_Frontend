import { ExitReason } from '@/types/product';

// Motivos de salida, en el orden en que se muestran (el elegido pasa al principio mientras está elegido)
export const EXIT_REASONS: ExitReason[] = ['sold', 'consumed', 'expired', 'rented'];

export const EXIT_REASON_LABEL_KEY: Record<ExitReason, string> = {
  consumed: 'product.salidaMotivoConsumido',
  expired: 'product.salidaMotivoVencido',
  sold: 'product.salidaMotivoVendido',
  rented: 'product.salidaMotivoAlquilado',
};

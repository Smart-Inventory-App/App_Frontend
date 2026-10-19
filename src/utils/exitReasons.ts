import { ExitReason } from '@/types/product';

// Motivos de salida, en el orden en que se muestran
export const EXIT_REASONS: ExitReason[] = ['consumed', 'expired', 'sold', 'rented'];

export const EXIT_REASON_LABEL_KEY: Record<ExitReason, string> = {
  consumed: 'product.salidaMotivoConsumido',
  expired: 'product.salidaMotivoVencido',
  sold: 'product.salidaMotivoVendido',
  rented: 'product.salidaMotivoAlquilado',
};

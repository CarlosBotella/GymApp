import type { ReactNode } from 'react';
import type { EquipmentKind } from '../lib/types';

type P = { size?: number };
const S = ({ size = 24, children }: P & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconBack = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const IconChevron = (p: P) => <S {...p}><path d="M9 5l7 7-7 7" /></S>;
export const IconPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconCheck = (p: P) => <S {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IconX = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IconTrash = (p: P) => <S {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></S>;
export const IconUp = (p: P) => <S {...p}><path d="M6 15l6-6 6 6" /></S>;
export const IconDown = (p: P) => <S {...p}><path d="M6 9l6 6 6-6" /></S>;
export const IconSwap = (p: P) => <S {...p}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></S>;
export const IconNote = (p: P) => <S {...p}><path d="M5 4h10l4 4v12H5z" /><path d="M9 12h6M9 16h4" /></S>;
export const IconTimer = (p: P) => <S {...p}><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M10 3h4" /></S>;
export const IconMore = (p: P) => <S {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></S>;
export const IconEdit = (p: P) => <S {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></S>;
export const IconTrophy = (p: P) => <S {...p}><path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8" /></S>;

// Pestañas
export const IconToday = (p: P) => <S {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></S>;
export const IconRoutine = (p: P) => <S {...p}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></S>;
export const IconChart = (p: P) => <S {...p}><path d="M4 19h16" /><path d="M5 15l4-4 4 3 6-7" /></S>;
export const IconUser = (p: P) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></S>;
export const IconUsers = (p: P) => <S {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 19c1.2-3.2 3.6-5 6.5-5s5.3 1.8 6.5 5" /><path d="M16 4.5a3.5 3.5 0 010 7M18 14c1.7.6 3 2.3 3.5 5" /></S>;
export const IconMachine = (p: P) => <S {...p}><rect x="4" y="3" width="6" height="18" rx="1" /><path d="M7 7v3M7 13h0M10 8h8l2 4M14 12v8" /></S>;

/** Pictograma por tipo de equipo para las miniaturas de ejercicio. */
export function EquipmentGlyph({ kind, size = 28 }: { kind: EquipmentKind; size?: number }) {
  switch (kind) {
    case 'plate_loaded':
      return <S size={size}><path d="M3 12h18" /><rect x="5" y="6" width="3" height="12" rx="1" /><rect x="16" y="6" width="3" height="12" rx="1" /><path d="M12 12l-3-7" /></S>;
    case 'selectorized':
      return <S size={size}><rect x="7" y="3" width="10" height="18" rx="1.5" /><path d="M7 8h10M7 12h10M7 16h10" /><circle cx="18.5" cy="12" r="1" /></S>;
    case 'cable':
      return <S size={size}><circle cx="12" cy="4.5" r="2" /><path d="M12 6.5V16" /><path d="M8 16h8l-1 4H9z" /></S>;
    case 'smith':
      return <S size={size}><path d="M5 3v18M19 3v18M3 10h18" /><rect x="6.5" y="7.5" width="2" height="5" rx="0.5" /><rect x="15.5" y="7.5" width="2" height="5" rx="0.5" /></S>;
    case 'free_weight':
      return <S size={size}><path d="M7 12h10" /><rect x="3" y="8" width="4" height="8" rx="1" /><rect x="17" y="8" width="4" height="8" rx="1" /></S>;
    case 'bench':
      return <S size={size}><path d="M3 13h18M6 13v6M18 13v6M14 13l-3-7h-4" /></S>;
    case 'cardio':
      return <S size={size}><path d="M3 12h4l2-5 4 10 2-5h6" /></S>;
    default:
      return <S size={size}><circle cx="12" cy="5" r="2" /><path d="M12 7v7M8 10h8M9 21l3-7 3 7" /></S>;
  }
}

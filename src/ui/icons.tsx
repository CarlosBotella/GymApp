import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 20, children, strokeWidth = 1.6, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IcToday = (p: P) => <I {...p}><rect x="4" y="5" width="16" height="15" rx="1" /><path d="M4 9.5h16M8 3v4M16 3v4" /></I>;
export const IcList = (p: P) => <I {...p}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></I>;
export const IcChart = (p: P) => <I {...p}><path d="M4 19h16M5 15l4-4 3 3 7-7" /></I>;
export const IcPeople = (p: P) => <I {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 19c.9-3.2 3.3-5 6-5s5.1 1.8 6 5M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.4c1.6.7 2.8 2.3 3.5 4.6" /></I>;
export const IcDumbbell = (p: P) => <I {...p}><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></I>;
export const IcBack = (p: P) => <I size={16} {...p}><path d="M15 6l-6 6 6 6" /></I>;
export const IcChev = (p: P) => <I size={18} {...p}><path d="M9 6l6 6-6 6" /></I>;
export const IcDown = (p: P) => <I size={14} {...p}><path d="M6 9l6 6 6-6" /></I>;
export const IcUp = (p: P) => <I size={14} {...p}><path d="M6 15l6-6 6 6" /></I>;
export const IcCheck = (p: P) => <I size={16} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>;
export const IcPlus = (p: P) => <I size={16} {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IcPlay = (p: P) => <I size={16} {...p}><path d="M8 4.5v15l11-7.5z" /></I>;
export const IcMore = (p: P) => <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>;
export const IcClock = (p: P) => <I size={18} {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></I>;
export const IcPhone = (p: P) => <I size={14} {...p}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M3 9v6M21 9v6" /></I>;
export const IcSkip = (p: P) => <I {...p}><path d="M5 6l7 6-7 6M13 6l7 6-7 6" /></I>;
export const IcPen = (p: P) => <I {...p}><path d="M5 19l1-4L16 5l3 3L9 18z" /></I>;
export const IcVideo = (p: P) => <I {...p}><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M10 9.5v5l4-2.5z" /></I>;
export const IcStop = (p: P) => <I {...p}><rect x="6" y="6" width="12" height="12" /></I>;
export const IcSearch = (p: P) => <I size={18} {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></I>;
export const IcSliders = (p: P) => <I size={18} {...p}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></I>;
export const IcDownload = (p: P) => <I size={16} {...p}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" /></I>;
export const IcUpload = (p: P) => <I size={18} {...p}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14" /></I>;
export const IcCamera = (p: P) => <I size={22} {...p}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const IcFile = (p: P) => <I size={14} {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></I>;
export const IcShare = (p: P) => <I {...p}><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" /></I>;
export const IcAddHome = (p: P) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></I>;
export const IcBell = (p: P) => <I {...p}><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></I>;
export const IcArrowUp = (p: P) => <I {...p} strokeWidth={1.8}><path d="M12 19V5M6 11l6-6 6 6" /></I>;
export const IcArrowDown = (p: P) => <I {...p} strokeWidth={1.8}><path d="M12 5v14M6 13l6 6 6-6" /></I>;
export const IcArrowFlat = (p: P) => <I {...p} strokeWidth={1.8}><path d="M5 12h14M15 8l4 4-4 4" /></I>;
export const IcHandle = (p: P) => <I size={16} {...p}><path d="M5 9h14M5 15h14" /></I>;

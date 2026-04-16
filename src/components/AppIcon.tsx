'use client';

import { ReactNode } from 'react';
import { AppIconName } from '@/lib/icons';

interface Props {
  name: AppIconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

function IconPath({ name }: { name: AppIconName }) {
  const paths: Record<AppIconName, ReactNode> = {
    logo: <><path d="M4 11.5 12 7l8 4.5v6L12 22l-8-4.5Z" /><path d="M12 7V2" /><path d="M8 13h8" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5" /><path d="M12 19.5V22" /><path d="m4.9 4.9 1.8 1.8" /><path d="m17.3 17.3 1.8 1.8" /><path d="M2 12h2.5" /><path d="M19.5 12H22" /><path d="m4.9 19.1 1.8-1.8" /><path d="m17.3 6.7 1.8-1.8" /></>,
    moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
    income: <><path d="M4 7h16v10H4z" /><path d="M4 10h16" /><path d="M9 15h6" /></>,
    todo: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 3h6" /><path d="m8 10 1.8 1.8L13 8.6" /><path d="m8 15 1.8 1.8L13 13.6" /></>,
    habits: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 2.5 2.5L16 9" /></>,
    planned: <><path d="M8 3h8" /><path d="M9 3v3" /><path d="M15 3v3" /><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M8 11h8" /><path d="M8 15h8" /></>,
    receipt: <><path d="M7 3h10v18l-2-1.5L12 21l-3-1.5L7 21Z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v5l3 2" /></>,
    telegram: <><path d="m21 4-8.5 16-2.8-6.2L3 11.5 21 4Z" /><path d="m9.7 13.8 4.2-4.1" /></>,
    requests: <><path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4V6Z" /><path d="M8 9h8" /><path d="M8 12h5" /></>,
    admin: <><path d="m12 3 7 3v6c0 4.4-2.8 7.9-7 9-4.2-1.1-7-4.6-7-9V6l7-3Z" /><path d="m9.5 12 1.8 1.8L15 10" /></>,
    food: <><path d="M6 3v9" /><path d="M4 3v5" /><path d="M8 3v5" /><path d="M6 12v9" /><path d="M14 3c2 2 2 6 0 8v10" /><path d="M18 3v18" /></>,
    transport: <><path d="M5 14h14l-1.2-5.1A2 2 0 0 0 15.9 7H8.1a2 2 0 0 0-1.9 1.9Z" /><path d="M5 14v3" /><path d="M19 14v3" /><circle cx="8" cy="17" r="1.5" /><circle cx="16" cy="17" r="1.5" /></>,
    bills: <><path d="m13 2-7 12h5l-1 8 8-13h-5l0-7Z" /></>,
    shopping: <><path d="M6 7h12l-1 12H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
    health: <><path d="M12 5v14" /><path d="M5 12h14" /><rect x="4" y="4" width="16" height="16" rx="3" /></>,
    entertainment: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>,
    gift: <><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M12 9v11" /><path d="M4 13h16" /><path d="M12 9s-3-1.5-3-3.5S10.3 3 12 5c1.7-2 3 0 3 1.5S12 9 12 9Z" /></>,
    charity: <><path d="M12 20s-6-3.6-6-8.3A3.7 3.7 0 0 1 12 9a3.7 3.7 0 0 1 6 2.7C18 16.4 12 20 12 20Z" /><path d="M4 15c2.5 0 3.5 2 5 2h4" /></>,
    savings: <><path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7Z" /><path d="M7 10V7a5 5 0 0 1 10 0v3" /><path d="M12 13v4" /></>,
    family: <><circle cx="9" cy="8" r="2.5" /><circle cx="15.5" cy="9" r="2" /><path d="M4.5 19a4.5 4.5 0 0 1 9 0" /><path d="M13 19a3.5 3.5 0 0 1 7 0" /></>,
    other: <><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="m4 7 8 4 8-4" /><path d="M12 11v10" /></>,
    sparkles: <><path d="M12 3v4" /><path d="M12 17v4" /><path d="M5 12h4" /><path d="M15 12h4" /><path d="m7 7 2 2" /><path d="m15 15 2 2" /><path d="m17 7-2 2" /><path d="m9 15-2 2" /></>,
    book: <><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2H19v17H8.5A2.5 2.5 0 0 0 6 21Z" /><path d="M6 4.5V21" /><path d="M10 6h6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
    heart: <path d="M12 20s-7-4.2-7-9.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7 2.8c0 5-7 9.2-7 9.2Z" />,
    bolt: <path d="m13 2-7 11h5l-1 9 8-12h-5l0-8Z" />,
    save: <><path d="M5 4h12l2 2v14H5Z" /><path d="M8 4v5h8V4" /><path d="M9 19v-6h6v6" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /></>,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    mic: <><path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" /><path d="M8 22h8" /></>,
    wave: <><path d="M2 12h2l2-4 4 8 4-8 2 4h6" /></>,
    search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></>,
    note: <><path d="M7 3h8l4 4v14H7Z" /><path d="M15 3v5h4" /><path d="M10 13h6" /><path d="M10 17h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><circle cx="9" cy="8" r="2.5" /><circle cx="16" cy="9" r="2" /><path d="M4.5 18a4.5 4.5 0 0 1 9 0" /><path d="M13 18a3.5 3.5 0 0 1 7 0" /></>,
    tools: <><path d="m14 6 4 4" /><path d="m12 8 4-4" /><path d="m5 19 7-7" /><path d="m3 21 2-6 4 4-6 2Z" /></>,
    chart: <><path d="M4 19h16" /><path d="M7 16v-4" /><path d="M12 16V8" /><path d="M17 16v-7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></>,
    check: <path d="m5 13 4 4L19 7" />,
    warning: <><path d="m12 3 9 16H3l9-16Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M6 20a6 6 0 0 1 12 0" /></>,
    wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4Z" /><path d="M4 7V6a2 2 0 0 1 2-2h11" /><path d="M16 13h5" /></>,
    coins: <><ellipse cx="12" cy="6" rx="6" ry="3" /><path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6" /><path d="M6 12v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" /></>,
    send: <><path d="M21 4 10 15" /><path d="m21 4-7 17-4-6-6-4 17-7Z" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
    edit: <><path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" /><path d="m13.5 6.5 3.5 3.5" /></>,
    briefcase: <><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M8 9V7a4 4 0 0 1 8 0v2" /><path d="M3 14h18" /></>,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-left': <path d="m15 18-6-6 6-6" />,
  };

  return paths[name];
}

export default function AppIcon({ name, className, size = 20, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      className={`app-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <IconPath name={name} />
    </svg>
  );
}

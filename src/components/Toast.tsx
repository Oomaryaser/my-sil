'use client';

import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

export default function Toast({ message, type, visible }: Props) {
  return (
    <div className={`toast${visible ? ' show' : ''}${type === 'error' ? ' error' : ''}`}>
      {message}
    </div>
  );
}

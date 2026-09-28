/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';

/**
 * The Pfizer trademark lock-up (R-BASE-04).
 *
 * One component so the trademark is reproduced identically everywhere it
 * appears. Two rules are enforced here rather than left to each caller:
 *
 *  - **Aspect ratio.** Only a height is applied (`width:auto` in `.pfz`), so
 *    the mark can never be stretched. Callers pick a size step, not a width.
 *  - **Contrast.** The default asset is the colour mark for light surfaces; on
 *    a dark or brand-coloured field it is illegible, so `variant="white"`
 *    swaps to the knocked-out asset instead of filtering the colour one.
 *
 * `BASE_URL` is respected because this app is served from a sub-path
 * (`/<env>/<app>/uiservice/`) — a root-relative `/pfizer-logo.png` would 404.
 */

export type PfizerLogoSize = 'sm' | 'md' | 'lg';

interface PfizerLogoProps {
  /** Height step: sm 19px (dense headers), md 26px (default), lg 34px (landing). */
  size?: PfizerLogoSize;
  /** `white` is the knocked-out mark, for dark/brand-coloured surfaces. */
  variant?: 'color' | 'white';
  className?: string;
}

const SIZE_CLASS: Record<PfizerLogoSize, string> = {
  sm: 'pfz pfz-sm',
  md: 'pfz',
  lg: 'pfz pfz-lg',
};

export default function PfizerLogo({ size = 'md', variant = 'color', className }: PfizerLogoProps) {
  const file = variant === 'white' ? 'pfizer-logo-white.png' : 'pfizer-logo.png';
  const cls = className ? `${SIZE_CLASS[size]} ${className}` : SIZE_CLASS[size];
  return (
    <img
      src={`${import.meta.env.BASE_URL}${file}`}
      /* The mark is the company name, so the accessible name is just "Pfizer" —
         "Pfizer logo" would make a screen reader announce the word "logo". */
      alt="Pfizer"
      className={cls}
      /* Intrinsic size of the shipped asset — lets the browser reserve the box
         before the image decodes, so the header never shifts on first paint. */
      width={720}
      height={297}
      draggable={false}
    />
  );
}

/*
 * Persistent synthetic-data disclaimer (R-BASE-05).
 *
 * Rendered once at the App root rather than per-screen so it is present on both
 * the landing MENU and the APP shell, and cannot be lost by navigating between
 * branches, tabs or views. It is deliberately NOT dismissible: there is no close
 * button and no visibility state, so no user interaction can remove it.
 *
 * The bar is fixed to the bottom of the viewport and marked aria-hidden="false"
 * with role="note" so assistive technology announces it as a standing advisory
 * rather than as interactive content.
 */

import React from 'react';

export default function DataDisclaimer() {
  return (
    <div className="dsc" role="note">
      Synthetic demonstration data — not actual Pfizer data.
    </div>
  );
}

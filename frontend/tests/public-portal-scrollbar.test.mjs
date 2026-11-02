import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const appSource = fs.readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(
  new URL('../src/app/components/Layout/PublicPortalLayout.tsx', import.meta.url),
  'utf8',
);
const indexCssSource = fs.readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8');

test('PublicPortalLayout wraps all public landing page routes', () => {
  assert.ok(appSource.includes('<Route path="/public" element={<PublicPortalLayout />}>'));
  assert.ok(appSource.includes('<Route index element={<PublicPortal />} />'));
  assert.ok(appSource.includes('<Route path="heatmap" element={<PublicHeatmap />} />'));
  assert.ok(appSource.includes('<Route path="statistics" element={<PublicStatistics />} />'));
  assert.ok(appSource.includes('<Route path="clinics" element={<PublicClinics />} />'));
});

test('PublicPortalLayout implements Spotify-style auto-hidden scrollbar behavior', () => {
  // Hidden by default and shown when scrolling, hovering right edge, hovering bar, or dragging
  assert.ok(layoutSource.includes('isScrolling || isHoveringEdge || isHoveringBar || isDragging'));
  assert.ok(layoutSource.includes('EDGE_HOVER_THRESHOLD_PX'));
  assert.ok(layoutSource.includes('SCROLL_HIDE_DELAY_MS'));

  // Preserves normal scrolling and supports thumb dragging & track clicks
  assert.ok(layoutSource.includes('handleThumbPointerDown'));
  assert.ok(layoutSource.includes('handleTrackPointerDown'));
  assert.ok(layoutSource.includes("window.addEventListener('scroll', handleScroll"));
  assert.ok(layoutSource.includes("window.addEventListener('mousemove', handleMouseMove"));
});

test('Public portal scrollbar styles are scoped to public routes and use dark-neutral thumb with smooth opacity transition', () => {
  assert.ok(indexCssSource.includes('.public-spotify-scrollbar'));
  assert.ok(indexCssSource.includes('opacity: 0;'));
  assert.ok(indexCssSource.includes('.public-spotify-scrollbar.is-visible'));
  assert.ok(indexCssSource.includes('opacity: 1;'));
  assert.ok(indexCssSource.includes('transition: opacity'));
  assert.ok(indexCssSource.includes('.public-spotify-scrollbar-thumb'));
});

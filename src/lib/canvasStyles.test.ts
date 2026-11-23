import test from 'node:test';
import assert from 'node:assert/strict';
import { CANVAS_TEMPLATES, ALLOWED_BLOCK_TYPES, validateCanvasJson } from './canvasSchema';
import {
  CURATED_WOW_LOOKS,
  extractCanvasVisualEffects,
  resolveCanvasAppearance,
  mergeAllCanvasBlocks,
  reorderCanvasBlocks,
  extractCanvasLinks,
  isSafeHttpUrl,
  parseSafeCanvasDslOrJson,
  serializeCanvasToDsl,
} from './canvasStyles';

test('resolveCanvasAppearance styles every template and curated wow look with distinct tokens', () => {
  for (const tmpl of CANVAS_TEMPLATES) {
    const res = resolveCanvasAppearance(tmpl);
    assert.ok(res.style);
    const styleObj = res.style as Record<string, string>;
    assert.ok(styleObj['--primary'], `Missing --primary for ${tmpl.name}`);
    assert.ok(styleObj['--surface'], `Missing --surface for ${tmpl.name}`);
    assert.ok(styleObj['--text'], `Missing --text for ${tmpl.name}`);
    assert.ok(res.style.fontFamily, `Missing fontFamily for ${tmpl.name}`);
  }

  for (const look of CURATED_WOW_LOOKS) {
    const built = look.build(CANVAS_TEMPLATES[0]!);
    const validated = validateCanvasJson(built);
    assert.equal(validated.valid, true, `Wow look ${look.id} failed schema validation: ${validated.errors.join(', ')}`);
    const appearance = resolveCanvasAppearance(built);
    assert.ok(appearance.style.backgroundImage !== 'none', `Expected backdrop for ${look.id}`);
  }

  const auroraLook = CURATED_WOW_LOOKS.find((l) => l.id === 'bento-baghdad')!.build(CANVAS_TEMPLATES[0]!);
  const auroraAppearance = resolveCanvasAppearance(auroraLook);
  assert.ok(auroraAppearance.containerClass.includes('tw-canvas-aurora'));
  assert.equal(auroraAppearance.effects.avatarFrame, 'lapis-gold');
  assert.equal(auroraAppearance.effects.gridStyle, 'bento');
  assert.equal(auroraAppearance.effects.surfaceStyle, 'bento');
});

test('mergeAllCanvasBlocks exposes all 10 allowed blocks while preserving order', () => {
  const merged = mergeAllCanvasBlocks([
    { type: 'bio', visible: true },
    { type: 'cover', visible: false },
  ]);
  assert.equal(merged.length, ALLOWED_BLOCK_TYPES.length);
  assert.equal(merged[0]?.type, 'bio');
  assert.equal(merged[1]?.type, 'cover');
  assert.equal(merged[1]?.visible, false);
});

test('reorderCanvasBlocks swaps items safely within bounds', () => {
  const initial = [
    { type: 'cover' as const, visible: true },
    { type: 'identity' as const, visible: true },
    { type: 'bio' as const, visible: true },
  ];
  const movedUp = reorderCanvasBlocks(initial, 2, 'up');
  assert.deepEqual(movedUp.map((b) => b.type), ['cover', 'bio', 'identity']);
  assert.deepEqual(reorderCanvasBlocks(initial, 0, 'up').map((b) => b.type), ['cover', 'identity', 'bio']);
});

test('isSafeHttpUrl and extractCanvasLinks block javascript: and data: URIs', () => {
  assert.equal(isSafeHttpUrl('https://tawasul.iq/shop'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>'), false);

  const cfg = structuredClone(CANVAS_TEMPLATES[0]!);
  cfg.blocks.push({
    type: 'links',
    visible: true,
    settings: {
      title1: 'متجري',
      url1: 'https://tawasul.iq/market',
      title2: 'خبيث',
      url2: 'javascript:alert(1)',
    },
  });
  const links = extractCanvasLinks(cfg);
  assert.equal(links.length, 1);
  assert.equal(links[0]?.title, 'متجري');
  assert.equal(links[0]?.url, 'https://tawasul.iq/market');
});

test('parseSafeCanvasDslOrJson compiles extended visual DSL tokens and rejects HTML/HTMX injection', () => {
  const dsl = `
    name: مجلس دجلة
    preset: baghdad-night
    accent: gold
    background: pattern
    surface: bento
    backdrop: mesh
    avatarFrame: squircle
    grid: masonry-cards
    badge: مصمم عراقي
    layout: editorial
    font: noto-naskh
    blocks: cover, identity, bio, links, posts-grid
    link1: أعمالي | https://example.com/work
    note: أهلاً بكم في صفحتي
    maqam: hijaz
  `;
  const parsed = parseSafeCanvasDslOrJson(dsl);
  assert.equal(parsed.valid, true, parsed.errors.join(', '));
  assert.ok(parsed.config);
  const effects = extractCanvasVisualEffects(parsed.config);
  assert.equal(effects.surfaceStyle, 'bento');
  assert.equal(effects.backdropMode, 'mesh');
  assert.equal(effects.avatarFrame, 'squircle');
  assert.equal(effects.gridStyle, 'masonry-cards');
  assert.equal(effects.statusBadge, 'مصمم عراقي');
  assert.equal(validateCanvasJson(parsed.config).valid, true);

  // Round-trip serialization
  const roundTrip = parseSafeCanvasDslOrJson(serializeCanvasToDsl(parsed.config));
  assert.equal(roundTrip.valid, true);
  assert.deepEqual(extractCanvasVisualEffects(roundTrip.config), effects);

  // HTMX & HTML rejection
  const htmxAttempt = parseSafeCanvasDslOrJson('<div hx-post="/api/wallet/gift" hx-trigger="load">hack</div>');
  assert.equal(htmxAttempt.valid, false);
  assert.ok(htmxAttempt.errors[0]?.includes('HTML') || htmxAttempt.errors[0]?.includes('HTMX'));
});

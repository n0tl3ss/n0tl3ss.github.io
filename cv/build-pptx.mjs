// Render matching, native editable PowerPoints from the public CV source.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = process.env.PRESENTATIONS_SKILL_DIR;
if (!SKILL) throw new Error('Set PRESENTATIONS_SKILL_DIR to the installed presentation skill.');
const { finalizePresentation, makeNativeBulletParagraphs } = await import(pathToFileURL(path.join(SKILL, 'container_tools/artifact_tool_utils.mjs')));
const fontDir = process.env.CV_FONT_DIR ?? '/Applications/Microsoft Word.app/Contents/Resources/DFonts';
const { FontLibrary, Canvas } = createRequire(import.meta.resolve('@oai/artifact-tool'))('skia-canvas');
FontLibrary.use('Calibri', ['Calibri.ttf', 'Calibrib.ttf', 'Calibrii.ttf', 'Calibriz.ttf'].map(f => path.join(fontDir, f)));
const measure = new Canvas(1, 1).getContext('2d');
const stage = path.resolve(process.env.CV_BUILD_DIR ?? path.join(ROOT, '.preview/cv-update/final'));
const output = process.env.CV_OUTPUT_DIR ? path.resolve(process.env.CV_OUTPUT_DIR) : null;
const model = JSON.parse(await fs.readFile(path.join(ROOT, 'cv/content.json'), 'utf8'));
const layout = JSON.parse(await fs.readFile(path.join(stage, 'layout.json'), 'utf8'));
const PX = 4 / 3;
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function runs(html) {
  const result = [];
  let bold = false, underline = false, href = null;
  for (const token of html.match(/<[^>]+>|[^<]+/g)) {
    if (token === '<b>') bold = true;
    else if (token === '</b>') bold = false;
    else if (token === '<u>') underline = true;
    else if (token === '</u>') underline = false;
    else if (token.startsWith('<link ')) href = decode(token.match(/href="([^"]+)"/)[1]);
    else if (token === '</link>') href = null;
    else if (token.startsWith('<')) throw new Error(`Unsupported CV markup: ${token}`);
    else {
      const item = { run: decode(token), style: { bold, ...(underline ? { underline: 'sng' } : {}), ...(href ? { color: '#124c43' } : {}) } };
      if (href) item.link = { uri: href, isExternal: true };
      result.push(item);
    }
  }
  return result;
}

function textbox(slide, name, value, x, y, w, h, b, alignment = 'left') {
  const shape = slide.shapes.add({ geometry: 'textbox', name,
    position: { left: x * PX, top: y * PX, width: w * PX, height: h * PX },
    fill: 'none', line: { fill: 'none', width: 0, style: 'solid' } });
  shape.text.style = { typeface: 'Calibri', fontSize: b.size * PX, color: b.color,
    alignment, verticalAlignment: 'top', autoFit: 'none', wrap: 'square', insets: 0,
    lineSpacing: 1.0 };
  shape.text = value;
  return shape;
}

for (const [kind, pages] of Object.entries(model)) {
  const deck = Presentation.create({ slideSize: { width: pages[0].width * PX, height: pages[0].height * PX } });
  let cursor = 0;
  for (const [pageIndex, page] of pages.entries()) {
    const slide = deck.slides.add();
    slide.background.fill = '#ffffff';
    const sources = new Set();
    for (const [index, b] of page.blocks.entries()) {
      const position = layout[kind][cursor++];
      if (b.text !== position.text || position.page !== pageIndex + 1) throw new Error('Render PDF layout before building PPTX.');
      const richRuns = runs(b.html);
      if (richRuns.map(r => r.run).join('') !== b.text) throw new Error(`Text mismatch: ${b.text}`);
      for (const r of richRuns) if (r.link) sources.add(r.link.uri);
      let x = b.x, w = page.width - page.left - x;
      let value = [{ runs: richRuns }];
      if (b.kind === 'bullet') {
        x = page.left;
        w = page.width - 2 * page.left;
        value = makeNativeBulletParagraphs([b.text], { marginLeftPoints: b.x - x,
          hangingPoints: b.x - x - 5, spaceAfterPoints: 0 });
        value[0].runs = richRuns;
      }
      if (b.date) w = b.date_x - b.x - 6;
      textbox(slide, `${b.kind === 'bullet' ? 'bullets' : b.kind}-${index}`, value,
        x, position.top, w, position.bottom - position.top + 1, b);
      if (b.date) {
        measure.font = `${b.date_size * PX}px Calibri`;
        const dateWidth = measure.measureText(b.date).width / PX + 3;
        textbox(slide, `date-${index}`, b.date, page.width - page.left - dateWidth,
          position.top + b.size - b.date_size, dateWidth, b.date_size * 1.25,
          { size: b.date_size, color: '#5d685f' }, 'right');
      }
      if (b.kind === 'heading') {
        const y = position.top + b.size + 4;
        slide.shapes.add({ geometry: 'line', name: `section-rule-${index}`,
          position: { left: (page.left - 1.44) * PX, top: y * PX,
            width: (page.width - 2 * page.left + 2.88) * PX, height: 0 },
          fill: 'none', line: { fill: '#202c30', width: .5 * PX, style: 'solid' } });
      }
    }
    slide.speakerNotes.text = 'Public contribution evidence (reviewed 22 October 2026). PR totals include maintenance/backport work and AI-assisted or AI-generated contributions. The candidate identifies the Python dataclass implementation (micronaut-core#13786) as fully AI-generated and Micronaut Data vector search (#3637) as AI-assisted.\n' + [...sources].join('\n');
    slide.speakerNotes.setVisible(false);
  }
  const stem = kind === 'one' ? 'Nemanja_Mikic_One_Page_CV_Upstream_2026' : 'Nemanja_Mikic_Two_Pages_CV_Upstream_2026';
  const draft = path.join(stage, `${stem}.draft.pptx`);
  await (await PresentationFile.exportPptx(deck)).save(draft);
  // Artifact Tool preserves the indentation but currently drops the native marker.
  execFileSync(process.env.CV_PYTHON ?? 'python3', [path.join(ROOT, 'cv/normalize-pptx.py'), draft], { stdio: 'inherit' });
  const imported = await PresentationFile.importPptx(await FileBlob.load(draft));
  for (let i = 0; i < pages.length; i++) {
    const png = await imported.export({ slide: imported.slides.items[i], format: 'png', scale: 1.5 });
    await fs.writeFile(path.join(stage, `${kind}-pptx-${i + 1}.png`), new Uint8Array(await png.arrayBuffer()));
  }
  if (output) {
    await fs.mkdir(output, { recursive: true });
    const reference = path.join(ROOT, 'site/assets', kind === 'one' ? 'cv-one-page.pdf' : 'cv-two-pages.pdf');
    await finalizePresentation({ workspaceDir: path.dirname(ROOT), candidatePath: draft,
      finalPath: path.join(output, `${stem}.pptx`), explicitTotalSlideCount: pages.length,
      requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
      pythonExecutable: process.env.CV_PYTHON,
      integrityValidatorPath: path.join(SKILL, 'container_tools/inspect_presentation_package_integrity.py'),
      layoutValidatorPath: path.join(SKILL, 'container_tools/inspect_presentation_layout_geometry.py'),
      layoutArgs: ['--expected-slide-size-emu', '7559040,10692384', '--validate-bullet-geometry', '--validate-heading-fit'],
      fontPolicy: { basis: 'reference', families: ['Calibri'], referencePath: reference,
        referenceSha256: createHash('sha256').update(await fs.readFile(reference)).digest('hex') },
      verifyArtifactToolImport: true, receiptPath: path.join(stage, `${kind}-validation.json`) });
  }
  console.log(`${stem}: ${pages.length} editable page(s)`);
}

"""Render the public CVs from content.json, preserving their Calibri layout."""
from pathlib import Path
import argparse
import json

from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


def render(model, output):
    font_dir = Path('/Applications/Microsoft Word.app/Contents/Resources/DFonts')
    for name, file in [('Calibri', 'Calibri.ttf'), ('Calibri-Bold', 'Calibrib.ttf'),
                       ('Calibri-Italic', 'Calibrii.ttf'), ('Calibri-BoldItalic', 'Calibriz.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(font_dir / file)))
    pdfmetrics.registerFontFamily('Calibri', normal='Calibri', bold='Calibri-Bold',
                                 italic='Calibri-Italic', boldItalic='Calibri-BoldItalic')
    output.mkdir(parents=True, exist_ok=True)
    audit = {}
    for kind, pages in model.items():
        path = output / ('cv-one-page.pdf' if kind == 'one' else 'cv-two-pages.pdf')
        canvas = Canvas(str(path), pagesize=(pages[0]['width'], pages[0]['height']), pageCompression=1)
        canvas.setTitle(f'Nemanja Mikić — {"One-page" if kind == "one" else "Detailed"} CV')
        canvas.setAuthor('Nemanja Mikić')
        canvas.setSubject('Software engineering experience, qualifications and public contributions')
        audit[kind] = []
        for page_index, page in enumerate(pages, 1):
            width, height, left = page['width'], page['height'], page['left']
            top = page['top']
            canvas.setPageSize((width, height))
            for index, block in enumerate(page['blocks']):
                if index:
                    top += block['gap']
                size = block['size']
                style = ParagraphStyle('CV', fontName='Calibri', fontSize=size,
                                       leading=block['leading'], textColor=HexColor(block['color']),
                                       splitLongWords=False, allowWidows=0, allowOrphans=0)
                available = width - left - block['x']
                if block.get('date'):
                    available = block['date_x'] - block['x'] - 6
                paragraph = Paragraph(block['html'], style)
                _, h = paragraph.wrap(available, height)
                paragraph.drawOn(canvas, block['x'], height - top - h)
                baseline = height - top - size
                if block['kind'] == 'bullet':
                    canvas.setFillColor(HexColor(block['color']))
                    canvas.setFont('Calibri', size)
                    canvas.drawString(left + 5, baseline, '•')
                if block.get('date'):
                    canvas.setFont('Calibri', block['date_size'])
                    canvas.setFillColor(HexColor('#5d685f'))
                    canvas.drawRightString(width - left, baseline, block['date'])
                if block['kind'] == 'heading':
                    canvas.setStrokeColor(HexColor('#202c30'))
                    canvas.setLineWidth(.5)
                    canvas.line(left - 1.44, baseline - 4, width - left + 1.44, baseline - 4)
                audit[kind].append({'page':page_index, 'kind':block['kind'], 'top':round(top, 2),
                                    'bottom':round(top + h, 2), 'text':block['text']})
                top += h
            if top > height - 18:
                raise ValueError(f'{kind} page {page_index}: content ends at {top:.2f}, too close to the page edge')
            canvas.showPage()
        canvas.save()
        print(path)
    (output / 'layout.json').write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('.preview/cv-update/render'))
    args = parser.parse_args()
    render(json.loads(Path(__file__).with_name('content.json').read_text()), args.output)

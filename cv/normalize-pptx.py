"""Restore authored native bullets omitted by Artifact Tool's PPTX serializer."""
import re
import sys
from zipfile import ZIP_DEFLATED, ZipFile
from lxml import etree

NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}


def normalize(path):
    with ZipFile(path) as archive:
        files = {name: archive.read(name) for name in archive.namelist()}
    count = 0
    for name, data in files.items():
        if not re.fullmatch(r'ppt/slides/slide\d+\.xml', name):
            continue
        root = etree.fromstring(data)
        for shape in root.findall('.//p:sp', NS):
            props = shape.find('p:nvSpPr/p:cNvPr', NS)
            if props is None or not props.get('name', '').startswith('bullets-'):
                continue
            for paragraph in shape.findall('p:txBody/a:p/a:pPr', NS):
                for child in list(paragraph):
                    if etree.QName(child).localname in {'buNone', 'buChar', 'buAutoNum'}:
                        paragraph.remove(child)
                marker = etree.Element(f'{{{NS["a"]}}}buChar', char='•')
                default = paragraph.find('a:defRPr', NS)
                paragraph.insert(list(paragraph).index(default) if default is not None else len(paragraph), marker)
                count += 1
        files[name] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    with ZipFile(path, 'w', ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    print(f'Preserved {count} native bullet paragraphs')


if __name__ == '__main__':
    normalize(sys.argv[1])

import { escapeXml } from './common';

const EMU_PER_INCH = 914_400;
const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRels = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export interface PptxPackageOptions {
  widthInches: number;
  heightInches: number;
  title: string;
  author: string;
  slides: Array<{ name: string; image: Blob }>;
  createdAt?: Date;
  onProgress?: (percent: number) => void;
}

const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
const relationship = (id: string, type: string, target: string) =>
  `<Relationship Id="${id}" Type="${officeRels}/${type}" Target="${target}"/>`;
const groupShape = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function contentTypes(slideCount: number) {
  const slides = Array.from({ length: slideCount }, (_, index) =>
    `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('');
  return xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slides}</Types>`);
}

function presentation(slideCount: number, width: number, height: number) {
  const slideIds = Array.from({ length: slideCount }, (_, index) =>
    `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
  ).join('');
  return xml(`<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRels}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${width}" cy="${height}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
}

function presentationRelationships(slideCount: number) {
  const slideRels = Array.from({ length: slideCount }, (_, index) =>
    relationship(`rId${index + 2}`, 'slide', `slides/slide${index + 1}.xml`),
  ).join('');
  return xml(`<Relationships xmlns="${rels}">${relationship('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${slideRels}</Relationships>`);
}

function slide(name: string, width: number, height: number) {
  return xml(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRels}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="${escapeXml(name)}"><p:spTree>${groupShape}<p:pic><p:nvPicPr><p:cNvPr id="2" name="Visually page"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}

const slideRelationships = (index: number) => xml(`<Relationships xmlns="${rels}">${relationship('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${relationship('rId2', 'image', `../media/image${index}.png`)}</Relationships>`);

const slideMaster = xml(`<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRels}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Visually master"><p:spTree>${groupShape}</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId2"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
const slideMasterRels = xml(`<Relationships xmlns="${rels}">${relationship('rId1', 'theme', '../theme/theme1.xml')}${relationship('rId2', 'slideLayout', '../slideLayouts/slideLayout1.xml')}</Relationships>`);
const slideLayout = xml(`<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${officeRels}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${groupShape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
const slideLayoutRels = xml(`<Relationships xmlns="${rels}">${relationship('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>`);

const theme = xml(`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Visually"><a:themeElements><a:clrScheme name="Visually"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="7657FF"/></a:accent1><a:accent2><a:srgbClr val="FF6B6B"/></a:accent2><a:accent3><a:srgbClr val="22C55E"/></a:accent3><a:accent4><a:srgbClr val="0EA5E9"/></a:accent4><a:accent5><a:srgbClr val="F59E0B"/></a:accent5><a:accent6><a:srgbClr val="A855F7"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Visually"><a:majorFont><a:latin typeface="Manrope"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Visually"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);

const rootRels = xml(`<Relationships xmlns="${rels}">${relationship('rId1', 'officeDocument', 'ppt/presentation.xml')}<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>${relationship('rId3', 'extended-properties', 'docProps/app.xml')}</Relationships>`);
const presProps = xml('<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
const viewProps = xml('<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" lastView="sldView"><p:normalViewPr/><p:slideViewPr/><p:notesTextViewPr/><p:gridSpacing cx="78028800" cy="78028800"/></p:viewPr>');

export async function createPptxPackage(options: PptxPackageOptions): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const width = Math.round(options.widthInches * EMU_PER_INCH);
  const height = Math.round(options.heightInches * EMU_PER_INCH);
  const createdAt = (options.createdAt ?? new Date()).toISOString();
  zip.file('[Content_Types].xml', contentTypes(options.slides.length));
  zip.file('_rels/.rels', rootRels);
  zip.file('ppt/presentation.xml', presentation(options.slides.length, width, height));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRelationships(options.slides.length));
  zip.file('ppt/presProps.xml', presProps);
  zip.file('ppt/viewProps.xml', viewProps);
  zip.file('ppt/theme/theme1.xml', theme);
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMaster);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels);
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayout);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels);
  zip.file('docProps/app.xml', xml(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Visually</Application><PresentationFormat>Custom</PresentationFormat><Slides>${options.slides.length}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop></Properties>`));
  zip.file('docProps/core.xml', xml(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(options.title)}</dc:title><dc:creator>${escapeXml(options.author)}</dc:creator><cp:lastModifiedBy>Visually</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified></cp:coreProperties>`));

  for (const [index, item] of options.slides.entries()) {
    const slideIndex = index + 1;
    zip.file(`ppt/slides/slide${slideIndex}.xml`, slide(item.name, width, height));
    zip.file(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, slideRelationships(slideIndex));
    zip.file(`ppt/media/image${slideIndex}.png`, item.image);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  }, (metadata) => options.onProgress?.(90 + Math.round(metadata.percent / 10)));
}

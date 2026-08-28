import type { DesignDocument, DesignTemplate, EditorElement } from './types';

const uid = () => Math.random().toString(36).slice(2, 10);

export const createInitialDocument = (): DesignDocument => ({
  name: 'Untitled summer post',
  width: 1080,
  height: 1080,
  background: '#F6F1E8',
  elements: [
    {
      id: uid(), type: 'shape', name: 'Navy background', shape: 'rect', x: 48, y: 48,
      width: 984, height: 984, rotation: 0, opacity: 1, fill: '#172034', cornerRadius: 52,
    },
    {
      id: uid(), type: 'shape', name: 'Sun', shape: 'circle', x: 788, y: 96,
      width: 184, height: 184, rotation: 0, opacity: 1, fill: '#FFB44A', cornerRadius: 0,
    },
    {
      id: uid(), type: 'text', name: 'Eyebrow', text: 'TRAVEL JOURNAL  •  2026', x: 118, y: 150,
      width: 520, height: 44, rotation: 0, opacity: 1, fontSize: 25, fontFamily: 'DM Sans',
      fontStyle: 'bold', fill: '#C7F65C', align: 'left', letterSpacing: 3, lineHeight: 1.2,
    },
    {
      id: uid(), type: 'text', name: 'Headline', text: 'CHASE\nTHE SUN', x: 108, y: 255,
      width: 760, height: 360, rotation: 0, opacity: 1, fontSize: 134, fontFamily: 'Manrope',
      fontStyle: 'bold', fill: '#FFF9ED', align: 'left', letterSpacing: -4, lineHeight: .9,
    },
    {
      id: uid(), type: 'shape', name: 'Accent line', shape: 'rect', x: 116, y: 666,
      width: 846, height: 4, rotation: 0, opacity: .35, fill: '#FFF9ED', cornerRadius: 2,
    },
    {
      id: uid(), type: 'text', name: 'Details', text: 'Slow mornings, warm skies,\nand nowhere else to be.', x: 118, y: 720,
      width: 500, height: 120, rotation: 0, opacity: 1, fontSize: 34, fontFamily: 'DM Sans',
      fontStyle: 'normal', fill: '#FFF9ED', align: 'left', letterSpacing: 0, lineHeight: 1.35,
    },
    {
      id: uid(), type: 'shape', name: 'Tag', shape: 'rect', x: 730, y: 770,
      width: 240, height: 90, rotation: -4, opacity: 1, fill: '#C7F65C', cornerRadius: 45,
    },
    {
      id: uid(), type: 'text', name: 'Tag text', text: 'LET’S GO  →', x: 748, y: 791,
      width: 204, height: 42, rotation: -4, opacity: 1, fontSize: 25, fontFamily: 'DM Sans',
      fontStyle: 'bold', fill: '#172034', align: 'center', letterSpacing: 1, lineHeight: 1.2,
    },
  ],
});

const template = (
  id: string,
  name: string,
  category: string,
  background: string,
  accent: string,
  elements: EditorElement[],
  size: { width: number; height: number } = { width: 1080, height: 1080 },
): DesignTemplate => ({
  id, name, category, background, accent,
  document: { name, width: size.width, height: size.height, background, elements },
});

const text = (name: string, value: string, x: number, y: number, width: number, size: number, fill: string, font = 'Manrope', align: 'left' | 'center' | 'right' = 'left'): EditorElement => ({
  id: uid(), type: 'text', name, text: value, x, y, width, height: size * 2.6, rotation: 0, opacity: 1,
  fontSize: size, fontFamily: font, fontStyle: 'bold', fill, align, letterSpacing: -1, lineHeight: 1,
});

const shape = (name: string, kind: 'rect' | 'circle' | 'star', x: number, y: number, width: number, height: number, fill: string, radius = 0): EditorElement => ({
  id: uid(), type: 'shape', name, shape: kind, x, y, width, height, rotation: 0, opacity: 1, fill, cornerRadius: radius,
});

const line = (name: string, x: number, y: number, width: number, color: string, weight = 4, dash: number[] = []): EditorElement => ({
  id: uid(), type: 'line', name, x, y, width, height: Math.max(20, weight), rotation: 0, opacity: 1,
  fill: color, strokeWidth: weight, dash,
});

export const templates: DesignTemplate[] = [
  template('editorial', 'Sunday Editorial', 'Social', '#F2E8D9', '#E75832', [
    shape('Red panel', 'rect', 56, 56, 440, 968, '#E75832', 12),
    text('Issue', 'ISSUE 04  /  CULTURE', 98, 110, 360, 22, '#FBEFDE', 'DM Sans'),
    text('Title', 'THE\nNEW\nRHYTHM', 90, 278, 830, 116, '#192233', 'Playfair Display'),
    text('Notes', 'People, places & ideas shaping tomorrow.', 555, 790, 390, 34, '#192233', 'DM Sans'),
    shape('Dot', 'circle', 824, 114, 120, 120, '#F5B940'),
  ]),
  template('wellness', 'Daily Reset', 'Story', '#D9E6D7', '#315B48', [
    shape('Arch', 'rect', 100, 96, 880, 888, '#315B48', 440),
    shape('Inner', 'circle', 310, 272, 460, 460, '#E7CF9D'),
    text('Title', 'BREATHE\nIN. OUT.', 165, 660, 750, 86, '#FFFDF6', 'Manrope', 'center'),
    text('Kicker', 'A DAILY PRACTICE', 300, 142, 480, 24, '#FFFDF6', 'DM Sans', 'center'),
  ]),
  template('launch', 'Product Launch', 'Marketing', '#161821', '#8A7CFF', [
    shape('Glow', 'circle', 610, 60, 390, 390, '#8A7CFF'),
    shape('Card', 'rect', 74, 596, 932, 380, '#232631', 42),
    text('Kicker', 'INTRODUCING / 01', 94, 90, 500, 24, '#B8B0FF', 'DM Sans'),
    text('Title', 'Ideas,\namplified.', 90, 250, 850, 118, '#F7F5FF'),
    text('Body', 'Build bold. Ship beautifully.', 126, 695, 760, 38, '#C9CBD3', 'DM Sans'),
    shape('Button', 'rect', 126, 815, 290, 82, '#F7F5FF', 41),
    text('Button label', 'DISCOVER MORE', 145, 840, 250, 22, '#161821', 'DM Sans', 'center'),
  ]),
  template('coffee', 'Morning Brew', 'Post', '#F5D7B7', '#713A26', [
    shape('Brown block', 'rect', 0, 0, 1080, 400, '#713A26'),
    shape('Cup', 'circle', 590, 225, 390, 390, '#FFF6E9'),
    shape('Coffee', 'circle', 660, 295, 250, 250, '#A86542'),
    text('Title', 'GOOD\nMORNING.', 82, 520, 760, 112, '#713A26'),
    text('Body', 'Your first cup is on us.', 90, 850, 700, 34, '#713A26', 'DM Sans'),
  ]),
  template('minimal', 'Less, Better', 'Quote', '#F4F3EF', '#111111', [
    text('Number', '01', 74, 68, 300, 26, '#111111', 'DM Sans'),
    text('Quote', 'LESS,\nBUT\nBETTER.', 70, 275, 920, 132, '#111111'),
    shape('Line', 'rect', 74, 910, 932, 5, '#111111'),
    text('Caption', 'THE ART OF FOCUS', 680, 948, 320, 22, '#111111', 'DM Sans', 'right'),
  ]),
  template('night', 'Night Moves', 'Event', '#150E35', '#FD4D83', [
    shape('Planet', 'circle', 520, 88, 470, 470, '#FD4D83'),
    shape('Planet core', 'circle', 605, 170, 300, 300, '#F2B65D'),
    text('Title', 'NIGHT\nMOVES', 72, 520, 900, 134, '#F9F2FF'),
    text('Date', '28 / 08  —  9PM', 82, 860, 500, 28, '#C6B9FF', 'DM Sans'),
  ]),
  template('aurora-summit', 'Aurora Summit', 'Presentation', '#0A1024', '#7CF7C4', [
    shape('Aurora one', 'circle', 1280, -260, 760, 760, '#6657FF'),
    shape('Aurora two', 'circle', 1420, 180, 580, 580, '#43D6B3'),
    shape('Glass panel', 'rect', 90, 78, 1740, 924, '#111A35', 44),
    text('Eyebrow', 'CREATIVE LEADERSHIP SUMMIT  /  2026', 160, 160, 900, 30, '#7CF7C4', 'DM Sans'),
    text('Title', 'BUILD THE\nNEXT BRAVE\nTHING.', 150, 290, 1080, 122, '#F8FAFF'),
    text('Date', 'OCT 18–20  ·  SINGAPORE', 160, 860, 700, 32, '#B9C2DA', 'DM Sans'),
    shape('Number pill', 'rect', 1510, 820, 210, 86, '#F8FAFF', 43),
    text('Number', '05 / 12', 1538, 845, 155, 24, '#0A1024', 'DM Sans', 'center'),
  ], { width: 1920, height: 1080 }),
  template('bloom-sale', 'Bloom Season Sale', 'Story', '#FFF4EC', '#EE5D67', [
    shape('Top bloom', 'circle', 600, -180, 720, 720, '#F6B8C0'),
    shape('Center bloom', 'circle', 744, -32, 430, 430, '#EE5D67'),
    shape('Leaf one', 'rect', 30, 260, 430, 150, '#2E6A58', 75),
    shape('Leaf two', 'rect', 620, 590, 520, 170, '#A7C9A7', 85),
    text('Kicker', 'SPRING / SUMMER 2026', 92, 670, 896, 28, '#8E3B43', 'DM Sans', 'center'),
    text('Title', 'BLOOM\nSALE', 72, 820, 936, 158, '#3D2530', 'Playfair Display', 'center'),
    text('Offer', 'UP TO 40% OFF', 190, 1260, 700, 44, '#EE5D67', 'DM Sans', 'center'),
    shape('Shop button', 'rect', 260, 1465, 560, 112, '#3D2530', 56),
    text('Shop label', 'SHOP THE EDIT', 295, 1498, 490, 30, '#FFF9F5', 'DM Sans', 'center'),
    text('Footer', 'ENDS SUNDAY  ·  ONLINE + IN STORE', 135, 1740, 810, 23, '#715963', 'DM Sans', 'center'),
  ], { width: 1080, height: 1920 }),
  template('maison-menu', 'Maison Supper Menu', 'Menu', '#EEE7D8', '#203B32', [
    shape('Green frame', 'rect', 62, 62, 1276, 1876, '#203B32', 28),
    shape('Paper', 'rect', 92, 92, 1216, 1816, '#F7F1E6', 18),
    text('Monogram', 'M', 555, 170, 290, 150, '#C4774E', 'Playfair Display', 'center'),
    text('Title', 'MAISON\nSUPPER CLUB', 220, 390, 960, 86, '#203B32', 'Playfair Display', 'center'),
    text('Date', 'FRIDAY  ·  19 SEPTEMBER', 300, 660, 800, 25, '#8B6B57', 'DM Sans', 'center'),
    line('Rule one', 230, 760, 940, '#C9BDA8', 3),
    text('Course one', 'I  /  GARDEN', 250, 835, 400, 24, '#C4774E', 'DM Sans'),
    text('Dish one', 'Heirloom tomato · basil oil · chèvre', 250, 900, 900, 34, '#203B32', 'DM Sans'),
    text('Course two', 'II  /  FIELD', 250, 1055, 400, 24, '#C4774E', 'DM Sans'),
    text('Dish two', 'Wild mushroom · charred leek · jus', 250, 1120, 900, 34, '#203B32', 'DM Sans'),
    text('Course three', 'III  /  SWEET', 250, 1275, 400, 24, '#C4774E', 'DM Sans'),
    text('Dish three', 'Pear · brown butter · vanilla bean', 250, 1340, 900, 34, '#203B32', 'DM Sans'),
    line('Rule two', 230, 1510, 940, '#C9BDA8', 3),
    text('Footer', 'SEASONAL PLATES · NATURAL WINES · GOOD COMPANY', 210, 1605, 980, 23, '#8B6B57', 'DM Sans', 'center'),
  ], { width: 1400, height: 2000 }),
  template('modern-vows', 'Modern Vows', 'Invitation', '#F3EFE7', '#293B32', [
    shape('Sage arch', 'rect', 110, 120, 980, 1560, '#CBD7C8', 490),
    shape('Ivory arch', 'rect', 165, 175, 870, 1450, '#FAF8F1', 435),
    text('Initials', 'A  +  J', 280, 295, 640, 76, '#293B32', 'Playfair Display', 'center'),
    text('Invite', 'TOGETHER WITH THEIR FAMILIES', 280, 535, 640, 22, '#6C7C73', 'DM Sans', 'center'),
    text('Names', 'Amelia\n& Julian', 225, 680, 750, 104, '#293B32', 'Playfair Display', 'center'),
    line('Divider', 420, 1095, 360, '#B99A72', 3),
    text('Date', 'SATURDAY · JUNE 14 · 2026', 250, 1180, 700, 25, '#293B32', 'DM Sans', 'center'),
    text('Place', 'THE GLASSHOUSE  ·  HUDSON VALLEY', 235, 1280, 730, 22, '#6C7C73', 'DM Sans', 'center'),
    text('RSVP', 'DINNER & DANCING TO FOLLOW', 260, 1510, 680, 20, '#B07B52', 'DM Sans', 'center'),
  ], { width: 1200, height: 1800 }),
  template('folio', 'Studio Folio', 'Portfolio', '#F1F0EB', '#F04B32', [
    shape('Black rail', 'rect', 0, 0, 350, 1080, '#181818'),
    shape('Coral tile', 'rect', 1250, 95, 530, 530, '#F04B32', 12),
    shape('Cream tile', 'rect', 710, 95, 500, 530, '#D9D2C3', 12),
    text('Studio', 'NORTH / 24', 70, 72, 240, 25, '#F7F4EC', 'DM Sans'),
    text('Index', 'SELECTED\nWORKS', 68, 360, 250, 54, '#F7F4EC'),
    text('Year', '2024—2026', 70, 920, 240, 22, '#A9A9A5', 'DM Sans'),
    text('Title', 'Objects, spaces\n& visual systems.', 710, 710, 1010, 68, '#181818', 'Playfair Display'),
    text('Caption', 'INDEPENDENT CREATIVE PRACTICE  ·  COPENHAGEN', 715, 930, 950, 25, '#5D5B56', 'DM Sans'),
  ], { width: 1920, height: 1080 }),
  template('kinetic', 'Kinetic Club', 'Fitness', '#E8FF3F', '#111111', [
    shape('Black panel', 'rect', 54, 54, 972, 1812, '#111111', 28),
    shape('Lime slash', 'rect', 540, 180, 620, 180, '#E8FF3F', 16),
    shape('Orange ball', 'circle', 690, 440, 300, 300, '#FF5B35'),
    text('Kicker', 'KINETIC / TRAINING CLUB', 100, 125, 780, 28, '#E8FF3F', 'DM Sans'),
    text('Title', 'MOVE\nLOUDER.', 92, 710, 900, 156, '#FFFFFF'),
    line('Dash rule', 100, 1260, 840, '#FFFFFF', 5, [18, 16]),
    text('Body', 'STRENGTH · MOBILITY · CONDITIONING', 100, 1360, 830, 27, '#C8C8C2', 'DM Sans'),
    shape('Trial button', 'rect', 100, 1540, 490, 110, '#E8FF3F', 55),
    text('Trial label', 'BOOK A FREE CLASS', 126, 1574, 438, 27, '#111111', 'DM Sans', 'center'),
    text('Location', 'BROOKLYN  /  MON—SAT', 100, 1760, 520, 23, '#96968F', 'DM Sans'),
  ], { width: 1080, height: 1920 }),
  template('coastal-home', 'Coastal Residence', 'Real Estate', '#E9F0EF', '#163C3A', [
    shape('Hero', 'rect', 55, 55, 1090, 750, '#A9C8C3', 24),
    shape('Sun', 'circle', 730, 145, 300, 300, '#F4D59A'),
    shape('House', 'rect', 190, 385, 760, 360, '#F7F3EA', 10),
    shape('Window one', 'rect', 295, 470, 160, 210, '#163C3A', 6),
    shape('Window two', 'rect', 675, 470, 160, 210, '#163C3A', 6),
    text('Status', 'JUST LISTED  /  PACIFIC GROVE', 85, 900, 900, 25, '#47716B', 'DM Sans'),
    text('Title', 'A QUIET PLACE\nBY THE WATER.', 78, 1015, 1020, 82, '#163C3A', 'Playfair Display'),
    text('Details', '3 BED  ·  2.5 BATH  ·  2,180 SQ FT', 82, 1295, 850, 30, '#163C3A', 'DM Sans'),
    line('Divider', 82, 1390, 1030, '#9BB3AF', 3),
    text('Price', '$1,895,000', 82, 1450, 620, 52, '#163C3A', 'DM Sans'),
  ], { width: 1200, height: 1600 }),
  template('signal-podcast', 'Signal / Noise', 'Podcast', '#1B1634', '#FFCF4A', [
    shape('Signal one', 'circle', 95, 95, 890, 890, '#30245F'),
    shape('Signal two', 'circle', 210, 210, 660, 660, '#5D47B8'),
    shape('Signal core', 'circle', 365, 365, 350, 350, '#FFCF4A'),
    text('Series', 'THE SIGNAL / NOISE PODCAST', 95, 80, 890, 24, '#E1DDF5', 'DM Sans', 'center'),
    text('Episode', 'EP. 48', 405, 490, 270, 34, '#1B1634', 'DM Sans', 'center'),
    text('Title', 'THE FUTURE\nIS HUMAN', 110, 780, 860, 84, '#FFFFFF', 'Manrope', 'center'),
    text('Guest', 'WITH MAYA CHEN  ·  DESIGN FUTURIST', 120, 1000, 840, 21, '#BDB5E4', 'DM Sans', 'center'),
  ]),
  template('webinar', 'Future Systems', 'Webinar', '#F5F1E9', '#2458E6', [
    shape('Blue rail', 'rect', 0, 0, 575, 1080, '#2458E6'),
    shape('Grid card', 'rect', 690, 110, 1080, 860, '#E4DED1', 44),
    shape('Orb', 'circle', 1190, 220, 430, 430, '#FF6A3D'),
    text('Type', 'LIVE WEBINAR  /  FREE', 90, 95, 400, 27, '#CFE0FF', 'DM Sans'),
    text('Title', 'FUTURE\nSYSTEMS', 82, 300, 440, 91, '#FFFFFF'),
    text('Date', '09.24  ·  11AM ET', 90, 845, 390, 27, '#FFFFFF', 'DM Sans'),
    text('Headline', 'Designing products\nfor uncertain times.', 760, 650, 920, 68, '#171B25', 'Playfair Display'),
    text('Speakers', 'MAYA CHEN  ·  ELI ROSS  ·  NOAH KING', 765, 890, 850, 24, '#5F615F', 'DM Sans'),
  ], { width: 1920, height: 1080 }),
  template('botanical', 'Botanical Note', 'Quote', '#E7EDDF', '#3C654D', [
    shape('Leaf one', 'rect', -80, 110, 600, 220, '#8CAF7D', 110),
    shape('Leaf two', 'rect', 650, 720, 560, 210, '#B7CDA5', 105),
    shape('Paper', 'rect', 115, 125, 850, 830, '#F8F6EF', 34),
    text('Mark', '“', 180, 170, 240, 140, '#D49A68', 'Playfair Display'),
    text('Quote', 'GROW AT\nYOUR OWN\nPACE.', 175, 340, 730, 94, '#294537', 'Playfair Display'),
    line('Rule', 180, 760, 250, '#D49A68', 5),
    text('Author', 'A NOTE TO SELF', 180, 820, 600, 24, '#6A7D70', 'DM Sans'),
  ]),
  template('atelier-drop', 'Atelier Drop 03', 'Fashion', '#E8E2FF', '#5A3FE5', [
    shape('Purple block', 'rect', 48, 48, 984, 840, '#5A3FE5', 24),
    shape('Look panel', 'rect', 170, 210, 740, 1070, '#C9BFF6', 370),
    shape('Head', 'circle', 420, 300, 240, 240, '#F4C7A4'),
    shape('Body', 'rect', 330, 520, 420, 680, '#1D1830', 200),
    text('Edition', 'ATELIER / DROP 03', 90, 105, 660, 27, '#FFFFFF', 'DM Sans'),
    text('Title', 'NEW\nFORM.', 80, 1300, 920, 150, '#1D1830'),
    text('Caption', 'STRUCTURE IN MOTION  ·  LIMITED EDITION', 88, 1700, 850, 24, '#5A5268', 'DM Sans'),
  ], { width: 1080, height: 1920 }),
  template('pitch-cover', 'Nova Pitch Cover', 'Presentation', '#FFF7E8', '#FC5A3C', [
    shape('Coral band', 'rect', 0, 0, 1920, 170, '#FC5A3C'),
    shape('Navy card', 'rect', 1110, 280, 650, 650, '#18213A', 54),
    shape('Coral orb', 'circle', 1285, 455, 300, 300, '#FC5A3C'),
    text('Company', 'NOVA / LABS', 110, 245, 600, 30, '#FC5A3C', 'DM Sans'),
    text('Title', 'A BETTER WAY\nTO BUILD TRUST.', 100, 390, 940, 102, '#18213A'),
    text('Subtitle', 'SEED ROUND  ·  CONFIDENTIAL  ·  AUGUST 2026', 110, 870, 860, 25, '#6D6A63', 'DM Sans'),
    text('Slide', '01', 1600, 870, 110, 30, '#FFFFFF', 'DM Sans', 'center'),
  ], { width: 1920, height: 1080 }),
];

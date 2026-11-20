export interface CampusPhotoItem {
  id: string;
  src: string;
  alt: string;
  position: string;
  mobilePosition?: string;
  credit: string;
  source: string;
  license?: { name: string; url: string };
}

export const campusPhotos: readonly CampusPhotoItem[] = [
  {
    id: 'milan-building',
    src: '/campus/milan-building.webp',
    alt: '西安交通大学创新港校区米兰楼外立面',
    position: '50% 28%',
    mobilePosition: '50% 39%',
    credit: '《遇见仙交》校园打卡攻略',
    source: 'https://m.sohu.com/a/926152641_121124033/',
  },
  {
    id: 'xingqing-gate',
    src: '/campus/xingqing-gate.webp',
    alt: '西安交通大学兴庆校区北门与花坛',
    position: '50% 10%',
    mobilePosition: '50% 2%',
    credit: 'IronBlood / Wikimedia Commons',
    source: 'https://commons.wikimedia.org/wiki/File:XJTU_Main_Gate.JPG',
    license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  },
  {
    id: 'innovation-panorama',
    src: '/campus/innovation-panorama.webp',
    alt: '西安交通大学创新港校区全景',
    position: '50% 48%',
    credit: '邢鹏 摄',
    source: 'https://wmw.xjtu.edu.cn/gy1/mzwx1.htm',
  },
  {
    id: 'xingqing-panorama',
    src: '/campus/xingqing-panorama.webp',
    alt: '西安交通大学兴庆校区全景',
    position: '50% 48%',
    credit: '刘鸿翔 摄',
    source: 'https://wmw.xjtu.edu.cn/gy1/mzwx1.htm',
  },
];

const key = 'classboard-last-campus-photo';
const storageKinds = ['localStorage', 'sessionStorage'] as const;

export function chooseCampusPhoto(): CampusPhotoItem {
  for (const kind of storageKinds) {
    try {
      const previous = window[kind].getItem(key);
      if (!previous) continue;
      const index = campusPhotos.findIndex(photo => photo.id === previous);
      return campusPhotos[(index + 1) % campusPhotos.length];
    } catch { /* Try the next available storage. */ }
  }
  return campusPhotos[0];
}

export function rememberCampusPhoto(id: string): void {
  for (const kind of storageKinds) {
    try {
      window[kind].setItem(key, id);
      return;
    } catch { /* Showing the photo does not require storage. */ }
  }
}

import type { NewsCategoryId, VisualDesk } from '../types/news';

export const DESK_ASSETS: Record<
  VisualDesk,
  {
    src: string;
    caption: string;
    label: string;
    fallbackClass: string;
  }
> = {
  economy: {
    src: '/src/assets/images/editorial_economy_macro_1794810256886.jpg',
    caption: 'Tài chính vĩ mô & dòng vốn thị trường',
    label: 'Kinh tế & Thị trường',
    fallbackClass: 'from-slate-200 via-amber-50/60 to-slate-300 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800',
  },
  tech: {
    src: '/src/assets/images/editorial_tech_silicon_1794810257084.jpg',
    caption: 'Hạ tầng bán dẫn & công nghệ lõi',
    label: 'Công nghệ & AI',
    fallbackClass: 'from-slate-200 via-slate-100 to-slate-300 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
  },
  world: {
    src: '/src/assets/images/editorial_world_diplomacy_1794810257436.jpg',
    caption: 'Diễn đàn đối ngoại & địa chính trị quốc tế',
    label: 'Thế giới & Chính sách',
    fallbackClass: 'from-slate-200 via-slate-100 to-amber-100/50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900',
  },
  climate: {
    src: '/src/assets/images/editorial_climate_energy_1794810258146.jpg',
    caption: 'Chuyển dịch năng lượng & hạ tầng xanh',
    label: 'Khoa học & Môi trường',
    fallbackClass: 'from-slate-200 via-emerald-50/40 to-slate-300 dark:from-slate-800 dark:via-emerald-950/30 dark:to-slate-900',
  },
};

export const CATEGORIES: { id: NewsCategoryId; label: string }[] = [
  { id: 'tong-hop', label: 'Tổng hợp' },
  { id: 'viet-nam', label: 'Việt Nam' },
  { id: 'kinh-te', label: 'Kinh tế' },
  { id: 'cong-nghe', label: 'Công nghệ' },
  { id: 'the-gioi', label: 'Thế giới' },
  { id: 'khoa-hoc', label: 'Khoa học' },
];

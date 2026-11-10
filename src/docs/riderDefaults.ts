// Starter riders in AZ / RU / EN. The artist edits every line.
import type { Language, RiderKind, RiderSection } from '../lib/types';

type Def = { key: string; title: string; items: string[] }[];

const TECH: Record<Language, Def> = {
  az: [
    { key: 'stage', title: 'Səhnə', items: ['Səhnə ölçüsü: ən azı 6 × 4 m', 'Səhnəyə çıxış üçün pilləkən', 'Səhnə arxasında hazırlıq yeri'] },
    { key: 'sound', title: 'Səs', items: ['Peşəkar PA sistemi, məkana uyğun gücdə', 'Səs pultu (ən azı 16 kanal)', '2 simsiz vokal mikrofonu (Shure SM58/Beta 58 və ya bərabəri)', 'Səs operatoru, səs yoxlamasından əvvəl yerində'] },
    { key: 'monitors', title: 'Monitorlar', items: ['2 səhnə monitoru və ya in-ear sistemi', 'Ayrıca monitor qarışığı'] },
    { key: 'light', title: 'İşıq', items: ['Səhnənin ön işıqlandırılması', 'Rəngli işıq (LED)'] },
    { key: 'power', title: 'Elektrik və vaxt', items: ['Səhnədə 220V rozetkalar', 'Səs yoxlaması: çıxışdan ən azı 1 saat əvvəl'] },
  ],
  ru: [
    { key: 'stage', title: 'Сцена', items: ['Размер сцены: не менее 6 × 4 м', 'Лестница для выхода на сцену', 'Место для подготовки за сценой'] },
    { key: 'sound', title: 'Звук', items: ['Профессиональная PA-система по размеру площадки', 'Микшерный пульт (не менее 16 каналов)', '2 радиомикрофона для вокала (Shure SM58/Beta 58 или аналог)', 'Звукорежиссёр на месте до саундчека'] },
    { key: 'monitors', title: 'Мониторы', items: ['2 сценических монитора или in-ear система', 'Отдельный мониторный микс'] },
    { key: 'light', title: 'Свет', items: ['Фронтальный свет на сцену', 'Цветной свет (LED)'] },
    { key: 'power', title: 'Электричество и время', items: ['Розетки 220 В на сцене', 'Саундчек: не позднее чем за 1 час до выступления'] },
  ],
  en: [
    { key: 'stage', title: 'Stage', items: ['Stage size: at least 6 × 4 m', 'Stairs to the stage', 'Backstage preparation area'] },
    { key: 'sound', title: 'Sound', items: ['Professional PA system suited to the venue', 'Mixing console (at least 16 channels)', '2 wireless vocal microphones (Shure SM58/Beta 58 or equal)', 'Sound engineer on site before soundcheck'] },
    { key: 'monitors', title: 'Monitors', items: ['2 stage monitors or an in-ear system', 'Separate monitor mix'] },
    { key: 'light', title: 'Light', items: ['Front stage lighting', 'Colour lighting (LED)'] },
    { key: 'power', title: 'Power and timing', items: ['220V sockets on stage', 'Soundcheck at least 1 hour before the show'] },
  ],
};

const HOSP: Record<Language, Def> = {
  az: [
    { key: 'room', title: 'Qrim otağı', items: ['Kilidlənən, təmiz otaq', 'Güzgü, işıq, asılqan', 'Elektrik rozetkası'] },
    { key: 'catering', title: 'Qida və içki', items: ['Qazsız su (otaq temperaturunda)', 'Çay, limon, bal', 'Meyvə və yüngül qəlyanaltı'] },
    { key: 'transport', title: 'Nəqliyyat', items: ['Hava limanı / ünvandan məkana və geri transfer'] },
    { key: 'hotel', title: 'Qonaqlama', items: ['Şəhərdən kənar tədbirlərdə otel (komanda üçün)'] },
  ],
  ru: [
    { key: 'room', title: 'Гримёрка', items: ['Закрывающееся чистое помещение', 'Зеркало, свет, вешалка', 'Электрическая розетка'] },
    { key: 'catering', title: 'Еда и напитки', items: ['Негазированная вода (комнатной температуры)', 'Чай, лимон, мёд', 'Фрукты и лёгкие закуски'] },
    { key: 'transport', title: 'Транспорт', items: ['Трансфер из аэропорта / с адреса на площадку и обратно'] },
    { key: 'hotel', title: 'Проживание', items: ['Отель для команды при выездных мероприятиях'] },
  ],
  en: [
    { key: 'room', title: 'Dressing room', items: ['Lockable, clean room', 'Mirror, light, clothes rack', 'Power socket'] },
    { key: 'catering', title: 'Food and drinks', items: ['Still water (room temperature)', 'Tea, lemon, honey', 'Fruit and light snacks'] },
    { key: 'transport', title: 'Transport', items: ['Transfer from airport / address to the venue and back'] },
    { key: 'hotel', title: 'Accommodation', items: ['Hotel for the team for out-of-town events'] },
  ],
};

export const RIDER_TITLES: Record<Language, Record<RiderKind, string>> = {
  az: { technical: 'Texniki rider', hospitality: 'Məişət rider-i' },
  ru: { technical: 'Технический райдер', hospitality: 'Бытовой райдер' },
  en: { technical: 'Technical rider', hospitality: 'Hospitality rider' },
};

export function defaultRiderSections(kind: RiderKind, lang: Language): RiderSection[] {
  const src = kind === 'technical' ? TECH[lang] : HOSP[lang];
  return src.map((s) => ({ key: s.key, title: s.title, items: [...s.items] }));
}

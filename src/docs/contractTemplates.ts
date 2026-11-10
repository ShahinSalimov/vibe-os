// Contract templates in AZ / RU / EN. Plain text with {{placeholders}}.
// These are starting points, not legal advice: the app tells the user to review them.
// No bank details are ever inserted (VIBE OS does not store them).
import type { ContractTemplate, Language } from '../lib/types';

export interface ContractData {
  artist: string;
  organizer: string;
  eventType: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  fee: string;
  advance: string;
  balance: string;
  today: string;
}

const BLANK = '________';

type Texts = {
  titles: Record<ContractTemplate, string>;
  subject: Record<ContractTemplate, string>;
  common: string;
  collaboration: string;
  sponsorship: string;
  custom: string;
};

const AZ: Texts = {
  titles: {
    performance: 'Çıxış haqqında müqavilə',
    wedding: 'Toy mərasimində çıxış haqqında müqavilə',
    corporate: 'Korporativ tədbirdə çıxış haqqında müqavilə',
    collaboration: 'Musiqi əməkdaşlığı haqqında müqavilə',
    sponsorship: 'Sponsorluq müqaviləsi',
    custom: 'Müqavilə',
  },
  subject: {
    performance: 'İfaçı Sifarişçinin təşkil etdiyi tədbirdə ({{eventType}}) canlı çıxış edir.',
    wedding: 'İfaçı Sifarişçinin toy mərasimində canlı çıxış edir.',
    corporate: 'İfaçı Sifarişçinin korporativ tədbirində canlı çıxış edir.',
    collaboration: '',
    sponsorship: '',
    custom: '',
  },
  common: `{{title}}

Tarix: {{today}}

Tərəflər:
İfaçı: {{artist}}
Sifarişçi: {{organizer}}

1. Müqavilənin predmeti
{{subject}}

2. Vaxt və yer
Tarix: {{date}}
Başlama saatı: {{time}}
Məkan: {{venue}}, {{city}}
Çıxışın müddəti və proqramı tərəflər arasında əlavə olaraq razılaşdırılır.

3. Qonorar və ödəniş
Ümumi qonorar: {{fee}}.
Avans: {{advance}} — müqavilə imzalanarkən ödənilir.
Qalıq: {{balance}} — çıxışdan əvvəl ödənilir.
Ödənişin üsulu tərəflər arasında birbaşa razılaşdırılır.

4. Texniki tələblər
Sifarişçi İfaçının texniki və məişət tələblərini (rider) təmin edir. Rider bu müqavilənin ayrılmaz hissəsidir.

5. Ləğvetmə
Sifarişçi tədbiri ləğv edərsə, avans geri qaytarılmır. İfaçı üzrlü səbəb olmadan çıxışı ləğv edərsə, avansı tam qaytarır.

6. Fors-major
Təbii fəlakət, dövlət qərarları və tərəflərdən asılı olmayan digər hallarda tərəflər məsuliyyət daşımır. Yeni tarix razılaşdırıla bilər.

7. Foto və video
Tədbirdə çəkilən materialların kommersiya məqsədilə istifadəsi tərəflərin yazılı razılığı ilə mümkündür.

8. Yekun müddəalar
Müqavilə iki nüsxədə tərtib edilir və imzalandığı andan qüvvəyə minir.

İfaçı: ____________________ / {{artist}}

Sifarişçi: ____________________ / {{organizer}}`,
  collaboration: `{{title}}

Tarix: {{today}}

Tərəflər:
Tərəf 1: {{artist}}
Tərəf 2: {{organizer}}

1. Predmet
Tərəflər birgə musiqi əsəri (mahnı) üzərində işləyirlər.

2. Öhdəliklər
Hər tərəfin işi (söz, musiqi, aranjiman, ifa, yazılış) əlavə olaraq razılaşdırılır.

3. Ödəniş
Razılaşdırılmış məbləğ: {{fee}}. Ödənişin üsulu tərəflər arasında birbaşa razılaşdırılır.

4. Müəlliflik
Əsər üzrə müəllif adları hər buraxılışda göstərilir. Gəlirlərin bölgüsü tərəflərin yazılı razılığı ilə müəyyən edilir.

5. Yekun müddəalar
Müqavilə iki nüsxədə tərtib edilir və imzalandığı andan qüvvəyə minir.

Tərəf 1: ____________________ / {{artist}}

Tərəf 2: ____________________ / {{organizer}}`,
  sponsorship: `{{title}}

Tarix: {{today}}

Tərəflər:
Sənətçi: {{artist}}
Sponsor: {{organizer}}

1. Predmet
Sponsor Sənətçinin layihəsinə dəstək verir, Sənətçi isə Sponsorun brendini razılaşdırılmış qaydada təqdim edir.

2. Sponsorluq məbləği
{{fee}}. Ödənişin üsulu tərəflər arasında birbaşa razılaşdırılır.

3. Sənətçinin öhdəlikləri
Sosial şəbəkə paylaşımları, tədbirlərdə brendin təqdimatı və digər öhdəliklər əlavədə göstərilir.

4. Müddət
Müqavilə {{date}} tarixinədək qüvvədədir.

5. Yekun müddəalar
Müqavilə iki nüsxədə tərtib edilir və imzalandığı andan qüvvəyə minir.

Sənətçi: ____________________ / {{artist}}

Sponsor: ____________________ / {{organizer}}`,
  custom: `{{title}}

Tarix: {{today}}

Tərəflər:
{{artist}}
{{organizer}}

1.

2.

3.

____________________ / {{artist}}

____________________ / {{organizer}}`,
};

const RU: Texts = {
  titles: {
    performance: 'Договор на выступление',
    wedding: 'Договор на выступление на свадьбе',
    corporate: 'Договор на выступление на корпоративном мероприятии',
    collaboration: 'Договор о музыкальном сотрудничестве',
    sponsorship: 'Спонсорский договор',
    custom: 'Договор',
  },
  subject: {
    performance: 'Исполнитель выступает вживую на мероприятии Заказчика ({{eventType}}).',
    wedding: 'Исполнитель выступает вживую на свадьбе, организованной Заказчиком.',
    corporate: 'Исполнитель выступает вживую на корпоративном мероприятии Заказчика.',
    collaboration: '',
    sponsorship: '',
    custom: '',
  },
  common: `{{title}}

Дата: {{today}}

Стороны:
Исполнитель: {{artist}}
Заказчик: {{organizer}}

1. Предмет договора
{{subject}}

2. Время и место
Дата: {{date}}
Время начала: {{time}}
Место: {{venue}}, {{city}}
Продолжительность и программа выступления согласовываются сторонами дополнительно.

3. Гонорар и оплата
Общий гонорар: {{fee}}.
Аванс: {{advance}} — оплачивается при подписании договора.
Остаток: {{balance}} — оплачивается до начала выступления.
Способ оплаты стороны согласовывают напрямую.

4. Технические требования
Заказчик обеспечивает технические и бытовые требования Исполнителя (райдер). Райдер является неотъемлемой частью договора.

5. Отмена
При отмене мероприятия Заказчиком аванс не возвращается. При отмене выступления Исполнителем без уважительной причины аванс возвращается полностью.

6. Форс-мажор
Стороны не несут ответственности при стихийных бедствиях, решениях государственных органов и иных обстоятельствах, не зависящих от сторон. Может быть согласована новая дата.

7. Фото и видео
Коммерческое использование материалов, снятых на мероприятии, возможно с письменного согласия сторон.

8. Заключительные положения
Договор составлен в двух экземплярах и вступает в силу с момента подписания.

Исполнитель: ____________________ / {{artist}}

Заказчик: ____________________ / {{organizer}}`,
  collaboration: `{{title}}

Дата: {{today}}

Стороны:
Сторона 1: {{artist}}
Сторона 2: {{organizer}}

1. Предмет
Стороны совместно работают над музыкальным произведением (песней).

2. Обязанности
Вклад каждой стороны (текст, музыка, аранжировка, исполнение, запись) согласовывается дополнительно.

3. Оплата
Согласованная сумма: {{fee}}. Способ оплаты стороны согласовывают напрямую.

4. Авторство
Авторы указываются при каждом выпуске произведения. Распределение доходов определяется письменным соглашением сторон.

5. Заключительные положения
Договор составлен в двух экземплярах и вступает в силу с момента подписания.

Сторона 1: ____________________ / {{artist}}

Сторона 2: ____________________ / {{organizer}}`,
  sponsorship: `{{title}}

Дата: {{today}}

Стороны:
Артист: {{artist}}
Спонсор: {{organizer}}

1. Предмет
Спонсор поддерживает проект Артиста, Артист представляет бренд Спонсора в согласованном порядке.

2. Сумма спонсорства
{{fee}}. Способ оплаты стороны согласовывают напрямую.

3. Обязанности Артиста
Публикации в социальных сетях, представление бренда на мероприятиях и другие обязанности указываются в приложении.

4. Срок
Договор действует до {{date}}.

5. Заключительные положения
Договор составлен в двух экземплярах и вступает в силу с момента подписания.

Артист: ____________________ / {{artist}}

Спонсор: ____________________ / {{organizer}}`,
  custom: `{{title}}

Дата: {{today}}

Стороны:
{{artist}}
{{organizer}}

1.

2.

3.

____________________ / {{artist}}

____________________ / {{organizer}}`,
};

const EN: Texts = {
  titles: {
    performance: 'Performance Agreement',
    wedding: 'Wedding Performance Agreement',
    corporate: 'Corporate Event Performance Agreement',
    collaboration: 'Music Collaboration Agreement',
    sponsorship: 'Sponsorship Agreement',
    custom: 'Agreement',
  },
  subject: {
    performance: 'The Artist performs live at the Client’s event ({{eventType}}).',
    wedding: 'The Artist performs live at the wedding organized by the Client.',
    corporate: 'The Artist performs live at the Client’s corporate event.',
    collaboration: '',
    sponsorship: '',
    custom: '',
  },
  common: `{{title}}

Date: {{today}}

Parties:
Artist: {{artist}}
Client: {{organizer}}

1. Subject
{{subject}}

2. Time and place
Date: {{date}}
Start time: {{time}}
Venue: {{venue}}, {{city}}
The length and programme of the performance are agreed separately.

3. Fee and payment
Total fee: {{fee}}.
Advance: {{advance}} — paid when this agreement is signed.
Balance: {{balance}} — paid before the performance.
The payment method is agreed directly between the parties.

4. Technical requirements
The Client provides the Artist’s technical and hospitality requirements (rider). The rider is an integral part of this agreement.

5. Cancellation
If the Client cancels the event, the advance is not refunded. If the Artist cancels without a valid reason, the advance is refunded in full.

6. Force majeure
Neither party is liable for natural disasters, government decisions or other circumstances beyond their control. A new date may be agreed.

7. Photo and video
Commercial use of material recorded at the event requires the written consent of both parties.

8. Final provisions
This agreement is made in two copies and takes effect when signed.

Artist: ____________________ / {{artist}}

Client: ____________________ / {{organizer}}`,
  collaboration: `{{title}}

Date: {{today}}

Parties:
Party 1: {{artist}}
Party 2: {{organizer}}

1. Subject
The parties work together on a musical work (song).

2. Responsibilities
Each party’s contribution (lyrics, music, arrangement, performance, recording) is agreed separately.

3. Payment
Agreed amount: {{fee}}. The payment method is agreed directly between the parties.

4. Credits
Authors are credited on every release. The split of income is set by a written agreement of the parties.

5. Final provisions
This agreement is made in two copies and takes effect when signed.

Party 1: ____________________ / {{artist}}

Party 2: ____________________ / {{organizer}}`,
  sponsorship: `{{title}}

Date: {{today}}

Parties:
Artist: {{artist}}
Sponsor: {{organizer}}

1. Subject
The Sponsor supports the Artist’s project; the Artist presents the Sponsor’s brand as agreed.

2. Sponsorship amount
{{fee}}. The payment method is agreed directly between the parties.

3. Artist’s obligations
Social media posts, brand presence at events and other obligations are listed in an annex.

4. Term
This agreement is valid until {{date}}.

5. Final provisions
This agreement is made in two copies and takes effect when signed.

Artist: ____________________ / {{artist}}

Sponsor: ____________________ / {{organizer}}`,
  custom: `{{title}}

Date: {{today}}

Parties:
{{artist}}
{{organizer}}

1.

2.

3.

____________________ / {{artist}}

____________________ / {{organizer}}`,
};

const TEXTS: Record<Language, Texts> = { az: AZ, ru: RU, en: EN };

export function contractTitle(template: ContractTemplate, lang: Language): string {
  return TEXTS[lang].titles[template];
}

function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const v = (values[k] ?? '').trim();
    return v || BLANK;
  });
}

/** Renders the full contract text. Empty fields become "________" to fill in by hand. */
export function renderContract(template: ContractTemplate, lang: Language, data: ContractData): string {
  const tx = TEXTS[lang];
  const base =
    template === 'collaboration'
      ? tx.collaboration
      : template === 'sponsorship'
        ? tx.sponsorship
        : template === 'custom'
          ? tx.custom
          : tx.common;
  const values: Record<string, string> = { ...data, title: tx.titles[template] };
  values.subject = fill(tx.subject[template], values);
  return fill(base, values);
}

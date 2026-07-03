import type { Aspect, ChartPoint, ChartResult, InterpretationHighlight, NatalInterpretationPreview } from "./types";

const signNamesUk: Record<string, string> = {
  aries: "Овні",
  taurus: "Тельці",
  gemini: "Близнюках",
  cancer: "Раку",
  leo: "Леві",
  virgo: "Діві",
  libra: "Терезах",
  scorpio: "Скорпіоні",
  sagittarius: "Стрільці",
  capricorn: "Козерозі",
  aquarius: "Водолії",
  pisces: "Рибах"
};

const bodyNamesUk: Record<string, string> = {
  asc: "Асцендент",
  sun: "Сонце",
  moon: "Місяць",
  mercury: "Меркурій",
  venus: "Венера",
  mars: "Марс",
  jupiter: "Юпітер",
  saturn: "Сатурн",
  uranus: "Уран",
  neptune: "Нептун",
  pluto: "Плутон",
  "north-node": "Північний вузол",
  "south-node": "Південний вузол",
  chiron: "Хірон",
  lilith: "Ліліт"
};

const sunBySign: Record<string, string> = {
  aries: "Ідентичність рухається через ініціативу, прямоту і потребу діяти першою. Важливо навчитися не лише стартувати, а й доводити імпульс до форми.",
  taurus: "Сила проявляється через сталість, тілесність, цінності й здатність будувати повільно, але міцно. Головний урок - не плутати безпеку із застиглістю.",
  gemini: "Особистість живиться обміном, навчанням, мовою і швидкою адаптацією. Важливо збирати факти в цілісну позицію, а не лише рухатися між варіантами.",
  cancer: "Центр тяжіння пов'язаний із пам'яттю, домом, близькістю і захистом свого простору. Сила зростає, коли чутливість стає опорою, а не панциром.",
  leo: "Ідентичність прагне творчого прояву, видимості й теплого лідерства. Важливо світити не для схвалення, а з внутрішнього відчуття гідності.",
  virgo: "Сила проявляється через точність, ремесло, аналіз і бажання покращувати реальність. Головний баланс - між корисністю і надмірною самокритикою.",
  libra: "Особистість розкривається через взаємність, естетику, діалог і відчуття справедливості. Важливо не втрачати власний центр у пошуку гармонії.",
  scorpio: "Ідентичність має глибину, інтенсивність і здатність проходити трансформації. Сила зростає там, де контроль поступається чесності з собою.",
  sagittarius: "Життєва енергія рухається через сенс, подорожі, навчання і широку перспективу. Важливо не тікати в ідею, а перевіряти її життям.",
  capricorn: "Особистість орієнтована на структуру, відповідальність і довгу дистанцію. Сила приходить, коли амбіція спирається на живі цінності, а не лише на обов'язок.",
  aquarius: "Ідентичність пов'язана з незалежністю, майбутнім, спільнотами і нестандартним мисленням. Важливо бути вільною не через відсторонення, а через чесну участь.",
  pisces: "Сила проявляється через уяву, співчуття, інтуїцію і тонке відчуття невидимого. Головний урок - мати межі, щоб чутливість не розмивала напрям."
};

const moonBySign: Record<string, string> = {
  aries: "Емоції швидкі, прямі й потребують руху. Заспокоєння часто приходить через дію, фізичність і можливість чесно назвати бажання.",
  taurus: "Емоційна безпека пов'язана зі стабільністю, ритмом, дотиком і передбачуваністю. Тілу важливо довіряти не менше, ніж думкам.",
  gemini: "Почуття проходять через слова, пояснення і контакт. Внутрішня рівновага зміцнюється, коли емоції не тільки аналізуються, а й проживаються.",
  cancer: "Місяць тут дуже чутливий до близькості, дому і настрою середовища. Потреба у захисті природна, але важливо не замикатися в ній.",
  leo: "Емоційне тепло розкривається через щедрість, гру, творчість і визнання. Серцю потрібен простір, де його радість помічають.",
  virgo: "Почуття часто організовуються через турботу, деталі й корисність. Спокій приходить, коли порядок допомагає жити, а не стає способом контролю.",
  libra: "Емоційна рівновага залежить від атмосфери, взаємності й краси контакту. Важливо чути власні потреби до того, як вони розчиняться у потребах інших.",
  scorpio: "Почуття глибокі, проникливі й не люблять поверховості. Довіра формується повільно, зате дає здатність до дуже чесної близькості.",
  sagittarius: "Емоціям потрібен простір, сенс і відчуття горизонту. Важливо не перескакувати через складні переживання лише тому, що хочеться вперед.",
  capricorn: "Почуття можуть проявлятися стримано, через відповідальність і надійність. М'якість не суперечить силі; вона робить її людянішою.",
  aquarius: "Емоційна природа потребує свободи, дружби і чесного простору. Важливо не плутати дистанцію з ясністю, а незалежність із самотністю.",
  pisces: "Почуття проникні, образні й дуже емпатичні. Внутрішня рівновага потребує меж, тиші й практик, які повертають у тіло."
};

const ascBySign: Record<string, string> = {
  aries: "Перший контакт зі світом прямий, швидкий і ініціативний. Образ дії часто випереджає пояснення.",
  taurus: "Зовнішній стиль спокійний, тілесний і стабільний. Люди можуть відчувати в цій присутності надійність і земну силу.",
  gemini: "Перший прояв рухливий, контактний і допитливий. Світ зустрічається через питання, слова і швидку зміну перспектив.",
  cancer: "Зовнішня оболонка чутлива, захисна і уважна до атмосфери. Довіра відкриває набагато більше тепла, ніж видно спочатку.",
  leo: "Присутність помітна, тепла і творча. Навіть без наміру людина може займати більше простору, ніж думає.",
  virgo: "Перший стиль зібраний, уважний до деталей і практичний. Світ зустрічається через спостереження, корисність і точність.",
  libra: "Зовнішній прояв дипломатичний, естетичний і орієнтований на контакт. Важливо, щоб ввічливість не приховувала справжню позицію.",
  scorpio: "Присутність інтенсивна, зібрана і магнетична. Люди можуть відчувати глибину ще до того, як щось сказано.",
  sagittarius: "Перший контакт відкритий, широкий і живий. Є враження руху, пошуку і готовності йти за сенсом.",
  capricorn: "Зовнішній стиль стриманий, відповідальний і структурний. Довіра часто вибудовується через компетентність і час.",
  aquarius: "Перший прояв незалежний, незвичний і ментально вільний. Людина може одразу зчитуватися як та, що не вписується в шаблон.",
  pisces: "Присутність м'яка, образна і проникна. Межі можуть бути тонкими, тому важливо свідомо обирати, що впускати."
};

const aspectByType: Record<string, string> = {
  conjunction: "З'єднання підсилює обидві функції й робить їх майже нероздільними у досвіді людини.",
  opposition: "Опозиція показує вісь напруги й діалогу: дві потреби ніби стоять одна навпроти одної та вчаться балансу.",
  trine: "Трин описує природний потік, талант або легкість, яка працює краще, коли її свідомо розвивати.",
  square: "Квадрат створює внутрішній тиск і потребу в дії. Це аспект росту через тертя, рішення і практику.",
  sextile: "Секстиль дає можливість і гнучкий ресурс, який розкривається через вибір, навчання і регулярне застосування."
};

const findPoint = (chart: ChartResult, key: string): ChartPoint | undefined =>
  [...chart.angles, ...chart.bodies].find((point) => point.key === key);

const signName = (sign: string): string => signNamesUk[sign] ?? sign;

const buildSignHighlight = ({
  factor,
  point,
  texts,
  titlePrefix
}: {
  factor: string;
  point: ChartPoint;
  texts: Record<string, string>;
  titlePrefix: string;
}): InterpretationHighlight | null => {
  const text = texts[point.sign];

  if (!text) {
    return null;
  }

  return {
    factorKey: `${factor}.sign.${point.sign}`,
    title: `${titlePrefix} в ${signName(point.sign)}`,
    body: text,
    source: "seed"
  };
};

const buildAspectHighlight = (aspect: Aspect): InterpretationHighlight | null => {
  const text = aspectByType[aspect.type];

  if (!text) {
    return null;
  }

  const bodyA = bodyNamesUk[aspect.bodyA] ?? aspect.bodyA;
  const bodyB = bodyNamesUk[aspect.bodyB] ?? aspect.bodyB;

  return {
    factorKey: `aspect.${aspect.bodyA}.${aspect.type}.${aspect.bodyB}`,
    title: `${bodyA} - ${bodyB}: ${aspect.type}, орб ${aspect.orb.toFixed(2)}°`,
    body: text,
    source: "seed"
  };
};

export const generateNatalInterpretationPreview = (chart: ChartResult): NatalInterpretationPreview => {
  const highlights: InterpretationHighlight[] = [];
  const missingFactorKeys: string[] = [];
  const sun = findPoint(chart, "sun");
  const moon = findPoint(chart, "moon");
  const asc = findPoint(chart, "asc");

  const signHighlights = [
    sun && buildSignHighlight({ factor: "planet.sun", point: sun, texts: sunBySign, titlePrefix: "Сонце" }),
    moon && buildSignHighlight({ factor: "planet.moon", point: moon, texts: moonBySign, titlePrefix: "Місяць" }),
    asc && buildSignHighlight({ factor: "angle.asc", point: asc, texts: ascBySign, titlePrefix: "Асцендент" })
  ].filter((highlight): highlight is InterpretationHighlight => highlight !== null && highlight !== undefined);

  highlights.push(...signHighlights);

  for (const key of [
    sun ? `planet.sun.sign.${sun.sign}` : "planet.sun.sign",
    moon ? `planet.moon.sign.${moon.sign}` : "planet.moon.sign",
    asc ? `angle.asc.sign.${asc.sign}` : "angle.asc.sign"
  ]) {
    if (!highlights.some((highlight) => highlight.factorKey === key)) {
      missingFactorKeys.push(key);
    }
  }

  const aspectHighlights = chart.aspects
    .slice()
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 4)
    .map(buildAspectHighlight)
    .filter((highlight): highlight is InterpretationHighlight => highlight !== null);

  highlights.push(...aspectHighlights);

  const summaryParts = [
    sun ? `Сонце в ${signName(sun.sign)}` : null,
    moon ? `Місяць в ${signName(moon.sign)}` : null,
    asc ? `Асцендент в ${signName(asc.sign)}` : null
  ].filter(Boolean);

  return {
    locale: "uk",
    summary:
      summaryParts.length > 0
        ? `Базовий фокус карти: ${summaryParts.join(", ")}. Нижче - перший контрольований шар трактувань без AI.`
        : "Базовий шар трактувань очікує достатньо розрахованих факторів карти.",
    highlights,
    missingFactorKeys
  };
};

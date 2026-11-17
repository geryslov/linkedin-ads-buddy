// What kind of activity a campaign is, for grouping the scorecard. LinkedIn's
// campaign format/type settles message ads and (when flagged) CTV; thought
// leadership is a property of the sponsored post's author, which this app can't
// read (posts are partner-gated), so it comes from the campaign name only.

export type ActivitySource = 'format' | 'name' | 'none';

export interface CampaignActivity {
  activity: string;
  source: ActivitySource;
}

export interface ActivityInput {
  name: string;
  format?: string;
  type?: string;
  ctv?: boolean;
}

// Token match that treats _ | - . as separators (\b counts _ as a word character).
const tok = (alts: string) => new RegExp(`(?<![a-z0-9])(?:${alts})(?![a-z0-9])`, 'i');

const NAME_RULES: [RegExp, string][] = [
  [tok('ctv|connected[\\s_-]?tv|ott'), 'CTV'],
  [tok('in[\\s_-]?mails?|message[\\s_-]?ads?|conversation(al)?[\\s_-]?ads?|convo|msg'), 'Message ads'],
  [tok('thought[\\s_-]?leader(ship)?([\\s_-]?ads?)?|tlas?|tl'), 'Thought leadership'],
  [tok('docs?|documents?|pdf|e-?books?'), 'Document ads'],
  [tok('events?|webinars?'), 'Event ads'],
  [tok('videos?|vid'), 'Video ads'],
  [tok('carousels?'), 'Carousel ads'],
  [tok('spotlight|followers?|dynamic'), 'Dynamic ads'],
  [tok('text[\\s_-]?ads?'), 'Text ads'],
];

const FORMAT_LABELS: Record<string, string> = {
  SPONSORED_INMAIL: 'Message ads',
  SPONSORED_MESSAGE: 'Message ads',
  CONVERSATION: 'Message ads',
  CONVERSATION_AD: 'Message ads',
  SINGLE_VIDEO: 'Video ads',
  CAROUSEL: 'Carousel ads',
  TEXT_AD: 'Text ads',
  SPOTLIGHT: 'Dynamic ads',
  FOLLOW_COMPANY: 'Dynamic ads',
  JOBS: 'Dynamic ads',
  SPONSORED_UPDATE_EVENT: 'Event ads',
  STANDARD_UPDATE: 'Single image / sponsored content',
};

const humanize = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function activityOf(c: ActivityInput): CampaignActivity {
  const format = (c.format || '').toUpperCase();
  const type = (c.type || '').toUpperCase();
  // Specific formats beat names: a message ad is a message ad whatever it's called.
  if (c.ctv || /TELEVISION|CTV/.test(format)) return { activity: 'CTV', source: 'format' };
  if (type === 'SPONSORED_INMAILS' || FORMAT_LABELS[format] === 'Message ads') return { activity: 'Message ads', source: 'format' };
  // Names beat generic formats: "TL" on a STANDARD_UPDATE campaign is thought leadership.
  for (const [re, activity] of NAME_RULES) if (re.test(c.name)) return { activity, source: 'name' };
  if (FORMAT_LABELS[format]) return { activity: FORMAT_LABELS[format], source: 'format' };
  if (type === 'DYNAMIC') return { activity: 'Dynamic ads', source: 'format' };
  if (type === 'TEXT_AD') return { activity: 'Text ads', source: 'format' };
  if (format && format !== 'UNSUPPORTED') return { activity: humanize(format), source: 'format' };
  return { activity: 'Other', source: 'none' };
}

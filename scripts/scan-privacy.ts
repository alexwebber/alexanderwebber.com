// Privacy scan of data/ and dist/ (T041, SC-004, Principle VI). It fails on:
// - times of day in run files and run pages (ISO datetimes, start_time-style keys);
// - coordinates outside race tracks and race pages;
// - unapproved categories (sleep, stress, Body Battery, steps, SpO2);
// - provider activity links and ID keys, and name/description keys in published runs;
// - donor, Gift Aid and JustGiving account keys, and Gift Aid figures on pages;
// - image metadata in dist/;
// - with --provider-ids=<file> (R2 state/run-ids.json, fetched by the gate when it has R2
//   credentials): any known provider activity ID anywhere.
//
//   node scripts/scan-privacy.ts [--provider-ids=state-run-ids.json]
//
// Findings give a line and column, never the surrounding text: the gate runs on unpublished bot
// output, so its log must not carry the values it caught. Rules whose match is itself a value
// (a time, an ID) redact the match too.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IMAGE, metadataKinds } from './scan-images.ts';
import { isMain, walk } from './lib/walk.ts';

export interface PrivacyFinding {
  file: string;
  rule: string;
  line: number;
  column: number;
  /** The matched key, or a redaction note when the match is itself a value. */
  excerpt: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  /** Which files the rule applies to (repo-relative paths). */
  applies: (file: string) => boolean;
  /** The match is a value (a time, an ID), not a key name, so it is not echoed. */
  redact?: boolean;
}

const TEXT = /\.(json|ya?ml|html?|js|mjs|css|xml|txt|svg|webmanifest|map)$/i;
const RUN_FILE = /^data\/running\/published\/runs\//;
const RUN_PAGE = /^dist\/running\/runs\//;
const TRACK_FILE = /^data\/running\/published\/race-tracks\//;
const RACE_PAGE = /^dist\/running\/races\//;
// Bundled library code (e.g. MapLibre) is full of lat/lng identifiers; data lives in pages and JSON.
const BUNDLE = /^dist\/_astro\/.*\.(js|mjs|css|map)$/;
const inData = (f: string) => f.startsWith('data/');
const inDist = (f: string) => f.startsWith('dist/') && !BUNDLE.test(f);
const anywhere = () => true;

// A JSON or YAML key: "key": / 'key': / key: at the start of a YAML line or after { or ,
const key = (names: string) => new RegExp(`(?:["'](?:${names})["']\\s*:|(?:^|[\\s{,])(?:${names})\\s*:(?=\\s))`, 'im');

const FUNDRAISING_KEYS =
  'donor\\w*|donations?|donation_?amount|gift_?aid\\w*|totalEstimatedGiftAid|owner_?guid|page_?guid|campaign_?guid|consumer_?id|page_?id|event_?id';
// An approved story is the owner's own text and may say "Gift Aid: ...".
const STORY_FILE = /^data\/running\/owner\/stories\//;

export const RULES: Rule[] = [
  {
    name: 'time of day (ISO datetime) in a run file or run page',
    pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    applies: (f) => RUN_FILE.test(f) || RUN_PAGE.test(f),
    redact: true,
  },
  {
    name: 'start time key in a run file or run page',
    pattern: key('start_?time\\w*|start_?date_?local|start_local|start_date'),
    applies: (f) => RUN_FILE.test(f) || RUN_PAGE.test(f),
  },
  {
    name: 'coordinates outside race tracks and race pages',
    pattern: key('lat|lon|lng|latitude|longitude|latlng|lat_lng|coordinates|start_?latlng|end_?latlng'),
    applies: (f) => !TRACK_FILE.test(f) && !RACE_PAGE.test(f) && !BUNDLE.test(f),
  },
  {
    name: 'unapproved category (sleep, stress, Body Battery, steps, SpO2) in data',
    pattern: key('sleep\\w*|steps|spo2|stress\\w*|body_?battery\\w*|respiration\\w*'),
    applies: inData,
  },
  {
    name: 'unapproved category (sleep, stress, Body Battery, steps, SpO2) on a page',
    pattern:
      /["'](?:sleep\w*|steps|spO2|stress\w*|bodyBattery\w*)["']\s*:|\bSpO2\s*:?\s*\d+\s*%|\b\d[\d,]*\s+steps\b|\bbody\s*battery\b|\bsleep\s+score\b|\bstress\s+(?:score|level)\b/i,
    applies: inDist,
  },
  {
    name: 'provider activity link',
    pattern: /connect\.garmin\.com\/modern\/activity\/|intervals\.icu\/activities\//i,
    applies: anywhere,
  },
  {
    name: 'provider activity ID key',
    pattern: key('activity_?id|garmin_?id|external_?id|icu_?id|provider_?id|strava_?id'),
    applies: (f) => !BUNDLE.test(f),
  },
  {
    name: 'intervals.icu-style activity ID',
    pattern: /(?<![\w-])i\d{6,}\b/,
    applies: inData,
    redact: true,
  },
  {
    name: 'name or description key in a published run (titles use "title")',
    pattern: /["'](?:name|description)["']\s*:/,
    applies: (f) => RUN_FILE.test(f),
  },
  {
    name: 'donor, Gift Aid or JustGiving account key in data',
    pattern: key(FUNDRAISING_KEYS),
    applies: (f) => inData(f) && !STORY_FILE.test(f),
  },
  {
    // Quoted keys only: key() also matches a bare word before a colon, so a sentence such as
    // "Donations: ..." would fail the gate.
    name: 'donor, Gift Aid or JustGiving account key on a page',
    pattern: new RegExp(`["'](?:${FUNDRAISING_KEYS})["']\\s*:`, 'i'),
    applies: inDist,
  },
  {
    name: 'Gift Aid figure on a page',
    pattern: /£\s?\d[\s\S]{0,40}?\bgift aid\b|\bgift aid\b[\s\S]{0,40}?£\s?\d/i,
    applies: inDist,
    redact: true,
  },
];

function finding(file: string, rule: string, text: string, match: RegExpExecArray | RegExpMatchArray, redact: boolean): PrivacyFinding {
  const before = text.slice(0, match.index);
  const line = before.split('\n').length;
  const column = match.index! - before.lastIndexOf('\n');
  const excerpt = redact ? `[${match[0].length} chars redacted]` : match[0].replace(/\s+/g, ' ').trim();
  return { file, rule, line, column, excerpt };
}

export function scanText(file: string, text: string, providerIds?: Set<string>): PrivacyFinding[] {
  const findings: PrivacyFinding[] = [];
  for (const rule of RULES) {
    if (!rule.applies(file)) continue;
    const match = rule.pattern.exec(text);
    if (match) findings.push(finding(file, rule.name, text, match, rule.redact ?? false));
  }
  if (providerIds && providerIds.size > 0) {
    for (const match of text.matchAll(/[A-Za-z]?\d{5,}/g)) {
      if (providerIds.has(match[0])) {
        findings.push(finding(file, 'known provider activity ID', text, match, true));
        break;
      }
    }
  }
  return findings;
}

/** Provider IDs from R2 state/run-ids.json ({<providerId>: <publicRunId>}). */
export function loadProviderIds(path: string): Set<string> {
  const map = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
  return new Set(Object.keys(map));
}

export async function scanPrivacy(root: string, providerIds?: Set<string>): Promise<PrivacyFinding[]> {
  const findings: PrivacyFinding[] = [];
  for (const file of [...walk(root, 'data'), ...walk(root, 'dist')]) {
    if (TEXT.test(file)) {
      findings.push(...scanText(file, readFileSync(resolve(root, file), 'utf8'), providerIds));
    } else if (inDist(file) && IMAGE.test(file)) {
      const kinds = await metadataKinds(resolve(root, file)).catch(() => ['unreadable']);
      if (kinds.length > 0) findings.push({ file, rule: 'image metadata in the built site', line: 0, column: 0, excerpt: kinds.join(', ') });
    }
  }
  return findings;
}

if (isMain(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  const idsArg = process.argv.find((a) => a.startsWith('--provider-ids='))?.slice('--provider-ids='.length);
  const providerIds = idsArg ? loadProviderIds(resolve(idsArg)) : undefined;
  const findings = await scanPrivacy(root, providerIds);
  for (const f of findings) {
    const at = f.line > 0 ? `${f.file}:${f.line}:${f.column}` : f.file;
    console.error(`error: ${at}: ${f.rule}: ${f.excerpt}`);
  }
  const scope = providerIds ? `, checked against ${providerIds.size} known provider ID(s)` : '';
  console.log(`scan-privacy: data/ and dist/: ${findings.length} finding(s)${scope}`);
  if (findings.length > 0) process.exit(1);
}

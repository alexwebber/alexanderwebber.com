// Phone numbers in CV text (spec 004, T028): each form found alone, both of two found, and the CV's
// own numbers left alone (privacy-pipelines tips: plant each alone, then both). Made-up numbers from
// the ranges set aside for drama (07700 900xxx, 020 7946 0xxx, 01632 960xxx).
import { describe, expect, it } from 'vitest';
import { findPhone } from '../../src/sections/cv/domain/phone.ts';

const found = (text: string) => findPhone(text).map((m) => text.slice(m.index, m.index + m.length));

describe('findPhone', () => {
  it.each([
    ['a UK mobile, spaced', 'Call 07700 900123 today', '07700 900123'],
    ['a UK mobile, unspaced', 'Call 07700900123', '07700900123'],
    ['a London landline', 'Ring 020 7946 0018.', '020 7946 0018'],
    ['an area code in brackets', 'Ring (020) 7946 0018', '(020) 7946 0018'],
    ['a regional landline, hyphenated', 'Ring 0161-496-0000', '0161-496-0000'],
    ['a dotted number', 'Ring 07700.900.123', '07700.900.123'],
    ['+44 with the trunk zero in brackets', 'Ring +44 (0)20 7946 0018', '+44 (0)20 7946 0018'],
    ['+44 mobile', 'Ring +44 7700 900123', '+44 7700 900123'],
    ['a US number', 'Ring +1 202 555 0143', '+1 202 555 0143'],
    ['a French number', 'Ring +33 1 23 45 67 89', '+33 1 23 45 67 89'],
    ['a tel: link', '<a href="tel:+447700900123">', 'tel:+447700900123'],
  ])('finds %s', (_, text, number) => expect(found(text)).toEqual([number]));

  it.each([
    ['a year', 'In 2014 we began'],
    ['a year range with an en dash', 'From 2013–2016'],
    ['an ongoing range', '2019–now'],
    ['a run of years', 'In 2012 2013 2014 and 2015'],
    ['a date', 'Approved 2026-11-25'],
    ['a month', 'As of 2026-11'],
    ['a sha256', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['a sha256 starting with digits', '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'],
    ['a commit', 'from 0a1b2c3'],
    ['a size', 'A PDF of 123 KB'],
    ['a count', '50 changes in 5 themes'],
  ])('leaves %s alone', (_, text) => expect(found(text)).toEqual([]));

  it('finds both of two numbers in one text', () => {
    expect(found('07700 900123 or 020 7946 0018')).toEqual(['07700 900123', '020 7946 0018']);
    expect(found('07700 900123, +44 20 7946 0018')).toEqual(['07700 900123', '+44 20 7946 0018']);
    expect(found('07700 900123 020 7946 0018')).toEqual(['07700 900123', '020 7946 0018']);
  });
});

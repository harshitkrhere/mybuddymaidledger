import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_SETTINGS,
  getSettings,
  upsertSettings,
  SettingsKey,
} from '@/lib/accounting';

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // validate + coerce each field against its default type
    const values: Partial<Record<SettingsKey, string | number>> = {};

    for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw == null) continue;

      if (typeof DEFAULT_SETTINGS[key] === 'number') {
        if (raw === '') continue; // empty numeric field falls back to default
        const n = Number(raw);
        if (isNaN(n) || n < 0) {
          return NextResponse.json({ error: `${key} must be a non-negative number.` }, { status: 400 });
        }
        if (key === 'defaultGstRate' && n > 100) {
          return NextResponse.json({ error: 'GST rate cannot exceed 100%.' }, { status: 400 });
        }
        values[key] = n;
      } else {
        // empty string explicitly clears a text field (e.g. GSTIN when unregistered)
        const s = String(raw).trim();
        if (key === 'gstin' && s && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/i.test(s)) {
          return NextResponse.json(
            { error: 'GSTIN format looks invalid (expected 15 chars, e.g. 07ABCDE1234F1Z5). Leave blank if unregistered.' },
            { status: 400 }
          );
        }
        values[key] = s;
      }
    }

    if (Object.keys(values).length === 0) {
      return NextResponse.json({ error: 'No valid settings provided.' }, { status: 400 });
    }

    const settings = await upsertSettings(values);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

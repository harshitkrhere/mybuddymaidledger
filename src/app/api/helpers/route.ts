import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SERVICE_TYPES } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const serviceType = searchParams.get('serviceType');
    const city = searchParams.get('city');
    const query = searchParams.get('q');

    const helpers = await db.helper.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        placements: { select: { status: true, startDate: true, endDate: true, customerId: true } },
      },
    });

    const result = helpers
      .map((h) => ({
        id: h.id,
        name: h.name,
        phone: h.phone,
        gender: h.gender,
        city: h.city,
        locality: h.locality,
        serviceType: h.serviceType,
        expectedMonthlyRate: h.expectedMonthlyRate,
        aadhaarVerified: h.aadhaarVerified,
        policeVerified: h.policeVerified,
        referenceChecked: h.referenceChecked,
        status: h.status,
        notes: h.notes,
        createdAt: h.createdAt,
        placementCount: h.placements.length,
        activePlacement: h.placements.some((p) => p.status === 'ACTIVE'),
      }))
      .filter((h) => {
        if (status && status !== 'ALL' && h.status !== status) return false;
        if (serviceType && serviceType !== 'ALL' && h.serviceType !== serviceType) return false;
        if (city && city !== 'ALL' && h.city !== city) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            h.name.toLowerCase().includes(q) ||
            h.city.toLowerCase().includes(q) ||
            (h.locality || '').toLowerCase().includes(q)
          );
        }
        return true;
      });

    return NextResponse.json({ helpers: result });
  } catch (error) {
    console.error('Helpers GET error:', error);
    return NextResponse.json({ error: 'Failed to load helpers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      gender,
      city,
      locality,
      serviceType,
      expectedMonthlyRate,
      aadhaarVerified,
      policeVerified,
      referenceChecked,
      notes,
    } = body;

    if (!name || !city || !serviceType) {
      return NextResponse.json({ error: 'Name, city and service type are required.' }, { status: 400 });
    }
    if (!SERVICE_TYPES[serviceType]) {
      return NextResponse.json({ error: 'Invalid service type.' }, { status: 400 });
    }

    const anyCheck = aadhaarVerified || policeVerified || referenceChecked;
    const status = aadhaarVerified && policeVerified && referenceChecked ? 'VERIFIED' : anyCheck ? 'PENDING' : 'PENDING';

    const helper = await db.helper.create({
      data: {
        name,
        phone: phone || null,
        gender: gender === 'M' ? 'M' : 'F',
        city,
        locality: locality || null,
        serviceType,
        expectedMonthlyRate: expectedMonthlyRate ? Number(expectedMonthlyRate) : null,
        aadhaarVerified: !!aadhaarVerified,
        policeVerified: !!policeVerified,
        referenceChecked: !!referenceChecked,
        status,
        notes: notes || null,
      },
    });
    return NextResponse.json({ helper }, { status: 201 });
  } catch (error) {
    console.error('Helpers POST error:', error);
    return NextResponse.json({ error: 'Failed to create helper' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, aadhaarVerified, policeVerified, referenceChecked, notes } = body;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const helper = await db.helper.findFirst({ where: { id } });
    if (!helper) return NextResponse.json({ error: 'Helper not found.' }, { status: 404 });

    const nextAadhaar = aadhaarVerified ?? helper.aadhaarVerified;
    const nextPolice = policeVerified ?? helper.policeVerified;
    const nextRef = referenceChecked ?? helper.referenceChecked;

    // derive status: fully verified -> VERIFIED (unless PLACED)
    let nextStatus = status ?? helper.status;
    if (nextAadhaar && nextPolice && nextRef && nextStatus !== 'PLACED') {
      nextStatus = 'VERIFIED';
    } else if (nextStatus === 'VERIFIED' && !(nextAadhaar && nextPolice && nextRef)) {
      nextStatus = 'PENDING';
    }

    const updated = await db.helper.update({
      where: { id },
      data: {
        status: nextStatus,
        aadhaarVerified: nextAadhaar,
        policeVerified: nextPolice,
        referenceChecked: nextRef,
        notes: notes ?? undefined,
      },
    });
    return NextResponse.json({ helper: updated });
  } catch (error) {
    console.error('Helpers PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update helper' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const placementCount = await db.placement.count({ where: { helperId: id } });
    if (placementCount > 0) {
      return NextResponse.json(
        { error: 'Helper has placement history and cannot be deleted. Set status to inactive instead.' },
        { status: 400 }
      );
    }
    await db.helper.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Helpers DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete helper' }, { status: 500 });
  }
}

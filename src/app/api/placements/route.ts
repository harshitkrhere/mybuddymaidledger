import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SERVICE_TYPES, money } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const placements = await db.placement.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        customer: { select: { id: true, name: true, city: true, locality: true, phone: true, maxPlacements: true, placementsUsed: true, planType: true } },
        helper: { select: { id: true, name: true, phone: true, city: true, serviceType: true } },
      },
    });

    const result = placements
      .filter((p) => (status && status !== 'ALL' ? p.status === status : true))
      .map((p) => ({
        id: p.id,
        customerId: p.customerId,
        helperId: p.helperId,
        customer: p.customer,
        helper: p.helper,
        serviceType: p.serviceType,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        isReplacement: p.isReplacement,
        monthlyRate: p.monthlyRate ? money(p.monthlyRate) : null,
        notes: p.notes,
      }));

    return NextResponse.json({ placements: result });
  } catch (error) {
    console.error('Placements GET error:', error);
    return NextResponse.json({ error: 'Failed to load placements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, helperId, serviceType, startDate, monthlyRate, notes } = body;

    if (!customerId || !helperId || !serviceType || !startDate) {
      return NextResponse.json(
        { error: 'Customer, helper, service type and start date are required.' },
        { status: 400 }
      );
    }
    if (!SERVICE_TYPES[serviceType]) {
      return NextResponse.json({ error: 'Invalid service type.' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId } });
    if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });

    // plan coverage checks
    if (!customer.planType) {
      return NextResponse.json(
        { error: 'Customer has no active plan. Record a plan sale first.' },
        { status: 400 }
      );
    }
    if (customer.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Customer plan status is ${customer.status} — placement not allowed.` },
        { status: 400 }
      );
    }
    if (customer.planExpiryDate && new Date(customer.planExpiryDate) < new Date()) {
      return NextResponse.json({ error: 'Customer plan has expired. Renew first.' }, { status: 400 });
    }
    if (customer.placementsUsed >= customer.maxPlacements) {
      return NextResponse.json(
        {
          error: `Plan limit reached (${customer.placementsUsed}/${customer.maxPlacements} placements used). Upgrade or renew the plan.`,
        },
        { status: 400 }
      );
    }

    const helper = await db.helper.findFirst({ where: { id: helperId } });
    if (!helper) return NextResponse.json({ error: 'Helper not found.' }, { status: 404 });
    if (helper.status === 'PLACED') {
      return NextResponse.json({ error: 'Helper is already placed with a family.' }, { status: 400 });
    }
    if (helper.status === 'INACTIVE') {
      return NextResponse.json({ error: 'Helper is inactive.' }, { status: 400 });
    }
    if (!(helper.aadhaarVerified && helper.policeVerified && helper.referenceChecked)) {
      return NextResponse.json(
        { error: 'Helper is not fully verified (Aadhaar, police & references required).' },
        { status: 400 }
      );
    }

    const placement = await db.$transaction(async (tx) => {
      const created = await tx.placement.create({
        data: {
          customerId,
          helperId,
          serviceType,
          startDate: new Date(startDate),
          monthlyRate: monthlyRate ? money(Number(monthlyRate)) : null,
          notes: notes || null,
          status: 'ACTIVE',
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { placementsUsed: { increment: 1 } },
      });
      await tx.helper.update({ where: { id: helperId }, data: { status: 'PLACED' } });
      return created;
    });

    return NextResponse.json({ placement }, { status: 201 });
  } catch (error) {
    console.error('Placements POST error:', error);
    return NextResponse.json({ error: 'Failed to create placement' }, { status: 500 });
  }
}

// PATCH — end a placement, or replace the helper
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, newHelperId, notes } = body;
    if (!id || !action) return NextResponse.json({ error: 'Missing id or action.' }, { status: 400 });

    const placement = await db.placement.findFirst({
      where: { id },
      include: { customer: true, helper: true },
    });
    if (!placement) return NextResponse.json({ error: 'Placement not found.' }, { status: 404 });
    if (placement.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Only active placements can be ended or replaced.' }, { status: 400 });
    }

    if (action === 'end') {
      await db.$transaction(async (tx) => {
        await tx.placement.update({
          where: { id },
          data: { status: 'ENDED', endDate: new Date(), notes: notes || placement.notes },
        });
        await tx.helper.update({ where: { id: placement.helperId }, data: { status: 'VERIFIED' } });
      });
      return NextResponse.json({ success: true, ended: true });
    }

    if (action === 'replace') {
      if (!newHelperId) {
        return NextResponse.json({ error: 'newHelperId is required for replacement.' }, { status: 400 });
      }
      const newHelper = await db.helper.findFirst({ where: { id: newHelperId } });
      if (!newHelper) return NextResponse.json({ error: 'New helper not found.' }, { status: 404 });
      if (newHelper.status === 'PLACED') {
        return NextResponse.json({ error: 'New helper is already placed.' }, { status: 400 });
      }
      if (!(newHelper.aadhaarVerified && newHelper.policeVerified && newHelper.referenceChecked)) {
        return NextResponse.json(
          { error: 'New helper is not fully verified.' },
          { status: 400 }
        );
      }

      // coverage check for the replacement placement
      const customer = placement.customer;
      if (customer.placementsUsed >= customer.maxPlacements) {
        return NextResponse.json(
          {
            error: `Plan limit reached (${customer.placementsUsed}/${customer.maxPlacements}). Replacement would exceed coverage.`,
          },
          { status: 400 }
        );
      }

      // end current + create replacement atomically
      const replacement = await db.$transaction(async (tx) => {
        await tx.placement.update({
          where: { id },
          data: { status: 'REPLACED', endDate: new Date(), notes: notes || 'Replaced under plan coverage' },
        });
        await tx.helper.update({ where: { id: placement.helperId }, data: { status: 'VERIFIED' } });

        const created = await tx.placement.create({
          data: {
            customerId: placement.customerId,
            helperId: newHelperId,
            serviceType: placement.serviceType,
            startDate: new Date(),
            monthlyRate: placement.monthlyRate,
            status: 'ACTIVE',
            isReplacement: true,
            notes: `Replacement for ${placement.helper.name}`,
          },
        });
        await tx.customer.update({
          where: { id: placement.customerId },
          data: { placementsUsed: { increment: 1 } },
        });
        await tx.helper.update({ where: { id: newHelperId }, data: { status: 'PLACED' } });
        return created;
      });

      return NextResponse.json({ success: true, replaced: true, replacement });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Placements PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update placement' }, { status: 500 });
  }
}

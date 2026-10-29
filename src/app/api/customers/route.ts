import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { money } from '@/lib/accounting';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const status = searchParams.get('status');
    const query = searchParams.get('q');
    const now = new Date();

    const customers = await db.customer.findMany({
      where: city && city !== 'ALL' ? { city } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        placements: { select: { status: true, startDate: true, monthlyRate: true } },
        planSales: { select: { planType: true, totalAmount: true, saleDate: true, isRefunded: true } },
      },
    });

    const result = customers
      .map((c) => {
        const activePlacement = c.placements.find((p) => p.status === 'ACTIVE');
        const totalPaid = money(c.planSales.reduce((s, x) => s + (x.isRefunded ? 0 : x.totalAmount), 0));
        const daysLeft = c.planExpiryDate
          ? Math.ceil((new Date(c.planExpiryDate).getTime() - now.getTime()) / 86400000)
          : null;
        let effStatus = c.status;
        if (c.status === 'ACTIVE' && c.planExpiryDate && new Date(c.planExpiryDate) < now) {
          effStatus = 'EXPIRED';
        }
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city,
          locality: c.locality,
          notes: c.notes,
          planType: c.planType,
          planFee: c.planFee,
          planPurchaseDate: c.planPurchaseDate,
          planExpiryDate: c.planExpiryDate,
          placementsUsed: c.placementsUsed,
          maxPlacements: c.maxPlacements,
          status: effStatus,
          createdAt: c.createdAt,
          hasActivePlacement: !!activePlacement,
          totalPaid,
          daysLeft,
        };
      })
      .filter((c) => {
        if (status && status !== 'ALL' && c.status !== status) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.city.toLowerCase().includes(q) ||
            (c.locality || '').toLowerCase().includes(q)
          );
        }
        return true;
      });

    return NextResponse.json({ customers: result });
  } catch (error) {
    console.error('Customers GET error:', error);
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, city, locality, address, notes } = body;

    if (!name || !city) {
      return NextResponse.json({ error: 'Name and city are required.' }, { status: 400 });
    }

    const customer = await db.customer.create({
      data: {
        name,
        phone: phone || null,
        email: email || null,
        city,
        locality: locality || null,
        address: address || null,
        notes: notes || null,
      },
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error('Customers POST error:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const [saleCount, placementCount] = await Promise.all([
      db.planSale.count({ where: { customerId: id } }),
      db.placement.count({ where: { customerId: id } }),
    ]);
    if (saleCount > 0 || placementCount > 0) {
      return NextResponse.json(
        { error: 'Customer has plan sales or placements and cannot be deleted.' },
        { status: 400 }
      );
    }
    await db.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customers DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}

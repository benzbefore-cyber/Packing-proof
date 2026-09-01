import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, where } from "firebase/firestore";

export async function POST(request: Request) {
  try {
    // 1. Verify Authentication / Signature
    // In a real scenario, you'd check a signature header from Shopee/Lazada
    const authHeader = request.headers.get("authorization");
    
    // Strict check for production-ready webhook secret
    if (!process.env.WEBHOOK_SECRET || authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json({ success: false, message: "Unauthorized webhook" }, { status: 401 });
    }

    const payload = await request.json();
    
    // Example Payload Expected:
    // {
    //   "shopOrderId": "SHOPEE-123456",
    //   "customerName": "John Doe",
    //   "phone": "0812345678",
    //   "address": "123 Main St, BKK",
    //   "weight": "1.5",
    //   "items": [{ "sku": "TSHIRT-BLK", "quantity": 2 }]
    // }

    if (!payload.shopOrderId || !payload.items || !Array.isArray(payload.items)) {
      return NextResponse.json({ success: false, message: "Invalid payload structure" }, { status: 400 });
    }

    // 2. Fetch products to validate SKUs and get Object IDs
    const productsRef = collection(db, "products");
    const productsSnap = await getDocs(productsRef);
    const inventory = productsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    const orderItemsToSave = [];
    const batch = writeBatch(db);

    for (const item of payload.items) {
      const product = inventory.find(p => p.sku === item.sku);
      if (!product) {
        return NextResponse.json({ success: false, message: `SKU ${item.sku} not found in inventory` }, { status: 404 });
      }

      if (product.stock < item.quantity) {
        return NextResponse.json({ success: false, message: `Insufficient stock for SKU ${item.sku}` }, { status: 400 });
      }

      orderItemsToSave.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        size: product.size,
        color: product.color,
        quantity: item.quantity
      });

      // Deduct stock
      const productDocRef = doc(db, "products", product.id);
      batch.update(productDocRef, { stock: product.stock - item.quantity });
    }

    // 3. (Mock) Call Logistics Provider API (e.g. Flash Express) to get a tracking number
    // In real app, call Flash API here.
    const fakeFlashTracking = "TH-API-" + Math.random().toString().slice(2, 10);

    // 4. Save the new order
    const orderRef = doc(collection(db, "orders"));
    batch.set(orderRef, {
      shopOrderId: payload.shopOrderId,
      customerName: payload.customerName,
      phone: payload.phone || "-",
      address: payload.address || "-",
      weight: payload.weight || "1.0",
      items: orderItemsToSave,
      flashTracking: fakeFlashTracking,
      staffId: "API_SYNC",
      timestamp: serverTimestamp(),
      status: "label_created",
      source: "marketplace_webhook"
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: "Order synchronized and stock deducted",
      orderId: orderRef.id,
      trackingNumber: fakeFlashTracking
    });

  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const shop = process.env.SHOPIFY_SHOP_NAME;
const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

async function audit() {
  let allOrders = [];
  let nextUrl = `https://${shop}/admin/api/2024-04/orders.json`;
  let params = {
    status: 'any',
    limit: 250,
    created_at_min: '2024-08-01T00:00:00Z',
    created_at_max: '2026-08-05T23:59:59Z',
    fields: 'id,name,created_at,cancelled_at,total_price,subtotal_price,total_discounts,discount_applications,discount_codes,refunds'
  };

  while (nextUrl) {
    const res = await axios.get(nextUrl, {
      params,
      headers: { 'X-Shopify-Access-Token': token }
    });
    const orders = res.data.orders || [];
    allOrders = allOrders.concat(orders);
    
    const linkHeader = res.headers['link'] || res.headers['Link'];
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = match ? match[1] : null;
      params = undefined;
    } else {
      nextUrl = null;
    }
  }

  console.log(`TOTAL SHOPIFY ORDERS AUDITED: ${allOrders.length}`);
  const monthlyReport = {};

  allOrders.forEach(o => {
    const m = o.created_at.substring(0, 7);
    if (!monthlyReport[m]) {
      monthlyReport[m] = {
        ordersCount: 0,
        totalDiscounts: 0,
        totalRefunds: 0,
        cancelledCount: 0,
        cancelledPriceTotal: 0
      };
    }
    monthlyReport[m].ordersCount++;

    let disc = parseFloat(o.total_discounts || 0);
    if (disc === 0 && o.discount_codes && o.discount_codes.length > 0) {
      disc = o.discount_codes.reduce((s, dc) => s + parseFloat(dc.amount || 0), 0);
    }
    monthlyReport[m].totalDiscounts += disc;

    let ref = 0;
    (o.refunds || []).forEach(r => {
      (r.refund_line_items || []).forEach(rli => ref += parseFloat(rli.subtotal || 0));
      (r.transactions || []).filter(t => t.kind === 'refund' && t.status === 'success').forEach(t => ref += parseFloat(t.amount || 0));
    });
    monthlyReport[m].totalRefunds += ref;

    if (o.cancelled_at) {
      monthlyReport[m].cancelledCount++;
      monthlyReport[m].cancelledPriceTotal += parseFloat(o.total_price || 0);
    }
  });

  console.log("SHOPIFY MONTHLY AUDIT TABLE:");
  console.table(monthlyReport);
}

audit().catch(err => console.error(err));

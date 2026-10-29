/**
 * evaluate-erp-concept.ts
 * VLM-evaluates generated ERP concept images against the redesign brief.
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const RUBRIC = `You are a strict senior product design reviewer. This image should be a high-fidelity desktop UI concept for "MyBuddyMaid ERP", an Indian home-services accounting workspace with an editorial "business ledger" art direction.

Evaluate the image against this checklist and answer each item PASS / PARTIAL / FAIL with one short sentence of evidence:

1. Editorial ledger aesthetic (warm ivory paper tone, hairline rules, flat, refined) — NOT a generic white SaaS dashboard?
2. Deep forest green (#123D32-ish) left navigation rail with ~9 small-caps items (Dashboard, Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings) and a "MyBuddyMaid" wordmark?
3. Editorial serif headline "Your business, in balance." near the top?
4. Financial hero: one integrated composition (NOT four identical KPI cards) with a dominant revenue figure ~₹2.9 lakh plus cash ₹3.8 lakh, net income −₹14.4K, GST payable ₹52.7K?
5. Revenue-vs-expenses line chart with months May–Oct, green revenue line, amber/coral expenses line, clean plot area?
6. Subscriptions visualization (NOT a big default donut in a card): Silver 19, Gold 14, Diamond 13, total 46 active plans?
7. Operations strip: 12 active placements, 10 verified helpers, 48 customers, 50 plan sales — typographic, not 4 identical cards?
8. Lower area: restrained India map/graphic with Patna, Delhi NCR, Ludhiana, Mumbai, Chennai, Dehradun?
9. Ledger activity table with Date/Type/Description/Amount/Status columns and realistic rows?
10. Palette adherence: forest green / signature green / sage / ivory / charcoal / amber, with NO purple or blue?
11. Text legibility: is the interface text crisp and readable at desktop scale (major headline, figures, table)?
12. Anti-template compliance: no glassmorphism, no big rounded white cards everywhere, no neon gradients, no device frame or marketing graphics around the screenshot?

Then give:
- TOTAL SCORE: x/12
- WORST 3 PROBLEMS (most visually damaging, ranked)
- VERDICT: one sentence — does it read as a distinctive premium ERP concept or a generic AI dashboard?`;

async function evaluate(imagePath: string, label: string) {
  const zai = await ZAI.create();
  const base64 = fs.readFileSync(imagePath).toString('base64');
  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RUBRIC },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  });
  const content = response.choices[0]?.message?.content ?? 'NO RESPONSE';
  console.log(`\n${'='.repeat(70)}\nEVALUATION: ${label}\n${'='.repeat(70)}\n${content}\n`);
  return content;
}

async function main() {
  const a = '/home/z/my-project/concept-candidates/mybuddymaid-erp-concept-a.png';
  const b = '/home/z/my-project/concept-candidates/mybuddymaid-erp-concept-b.png';
  if (fs.existsSync(a)) await evaluate(a, 'VARIANT A');
  if (fs.existsSync(b)) await evaluate(b, 'VARIANT B');
}

main().catch((e) => { console.error('Eval failed:', e.message); process.exit(1); });

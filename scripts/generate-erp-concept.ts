/**
 * generate-erp-concept.ts
 * Generates high-fidelity desktop UI concept images for the redesigned
 * MyBuddyMaid ERP — "The Business Ledger, Reimagined" art direction.
 *
 * Usage: bun /home/z/my-project/scripts/generate-erp-concept.ts [variantA|variantB]
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/home/z/my-project/concept-candidates';

// ---------------------------------------------------------------------------
// Variant A — primary art direction
// ---------------------------------------------------------------------------
const VARIANT_A = `High-fidelity desktop web-app UI mockup, one flat widescreen screenshot, no device frame, no surrounding graphics. "MyBuddyMaid" — a premium accounting ERP for an Indian home-services firm, art-directed like an editorial financial publication: warm ivory paper background #F7F5EF with subtle grain, fine 1px hairline rules instead of cards, generous margins, flat, restrained, not a generic SaaS template.

Slim deep-forest-green #123D32 left navigation rail: elegant serif "MyBuddyMaid" wordmark, thin line icons with small-caps labels — Dashboard (active, signature green #009B72 marker), Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings.

Workspace: slim utility bar with search field, bell icon, date-range control "Apr – Oct 2025", round avatar. Large editorial serif headline "Your business, in balance." beside a small delicate ink line-art illustration of a helper sweeping a doorstep, thin strokes, secondary in scale.

Financial hero as one composed reporting surface, no KPI card row: huge serif figure "₹2.9 lakh" labeled "TOTAL REVENUE"; on a shared hairline baseline three smaller figures: "Cash & bank ₹3.8 lakh", "Net income −₹14.4K" in amber #D88A32, "GST payable ₹52.7K". To the right, a line chart "Revenue vs expenses", months May Jun Jul Aug Sep Oct, revenue line in green #009B72 with pale sage #E7F0E9 fill, expenses line amber, faint gridlines, small rupee axis labels, no border box.

Slim band below: horizontal segmented bar in three tones of green — "Silver 19", "Gold 14", "Diamond 13", serif total "46 active plans"; beside it a typographic operations strip divided by hairline vertical rules, no boxes: "Active placements 12 · Verified helpers 10 · Customers 48 · Plan sales 50".

Bottom, two distinct areas: a restrained sage outline map of India with six city markers and a compact list — Patna, Delhi NCR, Ludhiana, Mumbai, Chennai, Dehradun — each with a small count; and a crisp legible ledger table "Latest ledger activity" with columns Date, Type, Description, Amount, Status and realistic rows like "12 Oct · Plan sale · Gold plan — R. Sharma, Patna · ₹8,900 · Paid", tiny green and amber status dots.

Editorial serif for headings and financial figures, clean modern sans for navigation, tables, labels. Crisp readable interface text, believable data visualization, pixel-precise alignment. Palette locked to #123D32 #009B72 #E7F0E9 #F7F5EF #202521 #D88A32. Flat, no gradients, no glassmorphism, no rounded white cards, no purple-blue, no generic AI dashboard look.`;

// ---------------------------------------------------------------------------
// Variant B — same brief, stronger emphasis on ledger asymmetry
// ---------------------------------------------------------------------------
const VARIANT_B = `High-fidelity professional UI concept: one full desktop web-application screenshot, flat, widescreen, no device frame, no marketing graphics. "MyBuddyMaid ERP" — the financial workspace of an Indian home-services company, redesigned as "the business ledger, reimagined": the visual character of an independent financial publication printed on warm ivory paper #F7F5EF with subtle grain, plus the usability of modern enterprise software. Editorial, understated luxury, tactile, precise. Not a template dashboard.

Asymmetric editorial composition. Narrow deep-forest-green #123D32 navigation rail: serif "MyBuddyMaid" wordmark on top, thin line icons with small-caps labels — Dashboard (active, green #009B72 edge marker), Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings.

Workspace opens with a bold editorial serif headline "Your business, in balance." beside a compact date-range selector "Apr – Oct 2025", a search field, notification bell and round account avatar in a slim top bar, plus one subtle original line-art illustration of a helper sweeping near a doorway, thin ink strokes, secondary in scale.

Financial performance as the hero, one composed whole: dominant serif figure "₹2.9 lakh" labeled "Total revenue", with three supporting figures on a shared hairline baseline — "Cash & bank ₹3.8 lakh", "Net income −₹14.4K" in amber #D88A32, "GST payable ₹52.7K" — no four-card row, no boxes; thin rules and spacing carry the hierarchy. To the right a clean plotting area with months May Jun Jul Aug Sep Oct: revenue line in green #009B72 with pale sage #E7F0E9 fill, expenses line in muted amber, subtle gridlines, small readable labels, integrated into the page with no card border.

Slim band: subscriptions as an elegant horizontal segmented bar in three greens — "Silver 19", "Gold 14", "Diamond 13" — with serif total "46 active plans"; beside it an operations summary as a refined typographic strip divided by hairline vertical rules: "Active placements 12", "Verified helpers 10", "Customers 48", "Plan sales 50".

Lower workspace: a restrained sage outline map of India with markers and a scannable list — Patna, Delhi NCR, Ludhiana, Mumbai, Chennai, Dehradun — each with a small activity number; and a dense but airy ledger table "Latest ledger activity", columns Date, Type, Description, Amount, Status, realistic rows like "09 Oct · Plan sale · Silver plan — A. Iyer, Chennai · ₹4,900 · Paid", small green and amber status dots.

Editorial serif for headings and figures, legible modern sans for UI text. Crisp readable text at desktop scale, believable charts, precise spacing, realistic proportions. Palette locked to #123D32 #009B72 #E7F0E9 #F7F5EF #202521 #D88A32 with restrained grey. Flat, no gradients, no glass cards, no rounded rectangle containers, no blue-purple SaaS look, no fake 3D.`;

// ---------------------------------------------------------------------------
// Variant C — hybrid: A's chart + B's subscription band, all defects targeted
// ---------------------------------------------------------------------------
const VARIANT_C = `High-fidelity desktop web-app UI mockup, one flat widescreen screenshot, no device frame, no surrounding graphics. "MyBuddyMaid" — a premium accounting ERP for an Indian home-services firm, art-directed like an editorial financial publication: warm ivory paper background #F7F5EF with subtle grain, fine 1px hairline rules instead of cards, generous margins, flat, restrained, distinctive, not a generic SaaS template.

Slim deep-forest-green #123D32 left navigation rail: serif "MyBuddyMaid" wordmark, thin line icons with small-caps labels — Dashboard (active, green #009B72 marker), Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings.

Workspace: slim utility bar with search field, bell icon, date-range control "Apr – Oct 2025", round avatar. Large editorial serif headline "Your business, in balance." beside a small delicate ink line-art illustration of a helper sweeping a doorstep, thin strokes, secondary in scale.

Financial hero, one composed reporting surface, no KPI card row: huge serif figure "₹2.9 lakh" labeled "TOTAL REVENUE" (rupee symbol ₹ rendered correctly on every figure); on a shared hairline baseline three smaller figures: "Cash & bank ₹3.8 lakh", "Net income −₹14.4K" as a negative number in amber #D88A32, "GST payable ₹52.7K". To the right a dual-line chart "Revenue vs expenses": TWO lines plotted in the same clean area — a green #009B72 revenue line rising with a pale sage #E7F0E9 fill under it, and a muted amber #D88A32 expenses line below it that crosses and dips — months May Jun Jul Aug Sep Oct on the axis, faint gridlines, small rupee labels, no border box.

One slim horizontal band with two halves. Left half, subscriptions as a segmented horizontal bar in three tones of green with labels "Silver 19", "Gold 14", "Diamond 13" and serif total "46 active plans". Right half, a typographic operations strip divided by hairline vertical rules: "Active placements 12", "Verified helpers 10", "Customers 48", "Plan sales 50".

Bottom, two distinct areas. Left: a restrained sage outline map of India with six small labeled dots placed on the map, each with a tiny legible name — Patna, Delhi NCR, Ludhiana, Mumbai, Chennai, Dehradun — plus a compact list with counts. Right: crisp ledger table "Latest ledger activity", columns Date, Type, Description, Amount, Status, with four DIFFERENT realistic rows: "12 Oct · Plan sale · Gold plan — R. Sharma, Patna · ₹8,900 · Paid", "09 Oct · Expense · Helper verification fees · ₹1,200 · Pending", "05 Oct · Plan sale · Silver plan — A. Iyer, Chennai · ₹4,900 · Paid", "01 Oct · Refund · Diamond plan cancel — M. Kaur, Ludhiana · ₹2,100 · Overdue", small status dots in green and amber.

Editorial serif for headings and figures, modern sans for UI. Crisp readable text, believable charts, pixel-precise alignment. Palette locked to #123D32 #009B72 #E7F0E9 #F7F5EF #202521 #D88A32. Flat, no gradients, no glassmorphism, no rounded white cards, no purple-blue, no generic AI dashboard look.`;

// ---------------------------------------------------------------------------
// Variant D — proven module phrasings; city list off-map; minimal table text
// ---------------------------------------------------------------------------
const VARIANT_D = `High-fidelity desktop web-app UI mockup, one flat widescreen screenshot, no device frame, no surrounding graphics. "MyBuddyMaid" — a premium accounting ERP for an Indian home-services firm, art-directed like an editorial financial publication: warm ivory paper background #F7F5EF with subtle grain, fine 1px hairline rules instead of cards, generous margins, flat, restrained, distinctive, not a generic SaaS template.

Slim deep-forest-green #123D32 left navigation rail: serif "MyBuddyMaid" wordmark, thin line icons with small-caps labels — Dashboard (active, green #009B72 marker), Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings.

Workspace: slim utility bar with search field, bell icon, date-range control "Apr – Oct 2025", round avatar. Large editorial serif headline "Your business, in balance." beside a small delicate ink line-art illustration of a helper sweeping a doorstep, thin strokes, secondary in scale.

Financial hero, one composed reporting surface, no KPI card row: huge serif figure "₹2.9 lakh" labeled "TOTAL REVENUE"; on a shared hairline baseline three smaller aligned figures: "Cash & bank ₹3.8 lakh", "Net income −₹14.4K" in amber #D88A32, "GST payable ₹52.7K". Every money figure uses the Indian rupee symbol ₹. To the right a dual-line chart "Revenue vs expenses", months May Jun Jul Aug Sep Oct, revenue line in green #009B72 with pale sage #E7F0E9 fill, expenses line in muted amber #D88A32 below it, faint gridlines, no border box.

Slim band: subscriptions as an elegant horizontal segmented bar in three tones of green with typographic labels "Silver 19", "Gold 14", "Diamond 13" and a serif total "46 active plans"; beside it an operations summary as a typographic strip divided by hairline vertical rules: "Active placements 12", "Verified helpers 10", "Customers 48", "Plan sales 50".

Bottom, two distinct areas. Left: a restrained pale-sage outline map of India with NO text on the map, only six small green dots, beside a clean typographic city list with counts: "Patna 14 · Delhi NCR 11 · Ludhiana 8 · Mumbai 7 · Chennai 4 · Dehradun 2". Right: a crisp ledger table "Latest ledger activity", columns Date, Type, Description, Amount, Status, three different realistic rows: "12 Oct · Plan sale · Gold plan, R. Sharma · ₹8,900 · Paid", "09 Oct · Expense · Verification fees · ₹1,200 · Pending", "03 Oct · Refund · Plan cancel, M. Kaur · ₹2,100 · Overdue", small status dots in green and amber.

Editorial serif for headings and figures, modern sans for UI. Crisp readable text, believable charts, pixel-precise alignment. Palette strictly #123D32 #009B72 #E7F0E9 #F7F5EF #202521 #D88A32, no other colors, no blue at all. Flat, no gradients, no glassmorphism, no rounded white cards, no purple, no generic AI dashboard look.`;

// ---------------------------------------------------------------------------
// Variant E — restructured vertical rhythm: ops strip gets its own full row
// ---------------------------------------------------------------------------
const VARIANT_E = `High-fidelity desktop web-app UI mockup, one flat widescreen screenshot, no device frame, no surrounding graphics. "MyBuddyMaid" — a premium accounting ERP for an Indian home-services firm, art-directed like an editorial financial publication: warm ivory paper background #F7F5EF with subtle grain, fine 1px hairline rules instead of cards, generous margins, flat, restrained, distinctive, not a generic SaaS template.

Slim deep-forest-green #123D32 left navigation rail: serif "MyBuddyMaid" wordmark, thin line icons with small-caps labels — Dashboard (active, green #009B72 marker), Plan Sales, Customers, Helpers, Placements, Payments, Accounting, Reports, Settings.

Workspace: slim utility bar with search field, bell icon, date-range control "Apr – Oct 2025", round avatar. Large editorial serif headline "Your business, in balance." beside a small delicate ink line-art illustration of a helper sweeping a doorstep, thin strokes, secondary in scale.

ROW ONE, financial hero, one composed reporting surface, no KPI card row: huge serif figure "₹2.9 lakh" labeled "TOTAL REVENUE"; on a shared hairline baseline three smaller aligned figures: "Cash & bank ₹3.8 lakh", "Net income −₹14.4K" in amber #D88A32, "GST payable ₹52.7K". Every money figure uses the Indian rupee symbol ₹. Beside it a large dual-line chart "Revenue vs expenses": TWO clearly visible lines — a green #009B72 revenue line with pale sage #E7F0E9 fill, and a muted amber #D88A32 expenses line distinctly below it — with month names May Jun Jul Aug Sep Oct labeled along the horizontal axis, faint gridlines, no border box.

ROW TWO, full-width slim subscriptions band: an elegant horizontal segmented bar in three tones of green with typographic labels "Silver 19", "Gold 14", "Diamond 13" and a serif total "46 active plans", all on one line.

ROW THREE, full-width operations strip: four figures in refined typography separated by thin vertical hairline rules — "Active placements 12", "Verified helpers 10", "Customers 48", "Plan sales 50" — no boxes, no cards.

ROW FOUR, two distinct areas side by side. Left: a restrained pale-sage outline map of India with six small green dots and a clean typographic city list with counts: "Patna 14 · Delhi NCR 11 · Ludhiana 8 · Mumbai 7 · Chennai 4 · Dehradun 2". Right: a crisp ledger table "Latest ledger activity", columns Date, Type, Description, Amount, Status, three different realistic rows: "12 Oct · Plan sale · Gold plan, R. Sharma · ₹8,900 · Paid", "09 Oct · Expense · Verification fees · ₹1,200 · Pending", "03 Oct · Refund · Plan cancel, M. Kaur · ₹2,100 · Overdue", small status dots in green and amber.

Editorial serif for headings and figures, modern sans for UI. Crisp correctly spelled readable text, believable charts, pixel-precise alignment. Palette strictly #123D32 #009B72 #E7F0E9 #F7F5EF #202521 #D88A32, no blue. Flat, no gradients, no glassmorphism, no rounded white cards, no generic AI dashboard look.`;

async function main() {
  const variant = process.argv[2] ?? 'A';
  const suffix = process.argv[3] ?? ''; // optional re-roll suffix, e.g. "2"
  const prompts: Record<string, string> = { A: VARIANT_A, B: VARIANT_B, C: VARIANT_C, D: VARIANT_D, E: VARIANT_E };
  const prompt = prompts[variant.toUpperCase()] ?? VARIANT_A;
  const outPath = path.join(OUT_DIR, `mybuddymaid-erp-concept-${variant.toLowerCase()}${suffix}.png`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const zai = await ZAI.create();

  // The image API intermittently rejects long prompts / rate-limits;
  // retry with exponential backoff.
  let response: Awaited<ReturnType<typeof zai.images.generations.create>> | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      response = await zai.images.generations.create({
        prompt,
        size: '1344x768', // closest supported ratio to the requested 1536×960 (1.6:1)
      });
      if (response.data?.[0]?.base64) break;
      throw new Error('empty data in response');
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed: ${(err?.message ?? '').slice(0, 120)}`);
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }

  if (!response?.data?.[0]?.base64) {
    throw new Error('Invalid response from image generation API after retries');
  }

  const buffer = Buffer.from(response.data[0].base64, 'base64');
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved variant ${variant} → ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});

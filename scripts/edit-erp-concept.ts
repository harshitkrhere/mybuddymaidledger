/**
 * edit-erp-concept.ts
 * Surgical image-edit pass on the winning concept image — fixes the four
 * defects found by VLM review while preserving the working composition.
 *
 * Usage: bun /home/z/my-project/scripts/edit-erp-concept.ts <input.png> <output.png>
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const EDIT_PROMPT = `This is a premium accounting ERP dashboard UI concept for MyBuddyMaid with an editorial ledger aesthetic. Keep the overall composition, layout, warm ivory paper palette, forest green navigation rail, serif headline "Your business, in balance.", financial figures, ledger table, and flat editorial style EXACTLY as they are. Make only these corrections:

1. In the "Revenue vs expenses" chart, add a clearly visible second line in muted amber #D88A32 labeled "Expenses", running below the green revenue line across the same months May to October, so both lines are distinct and readable.

2. Add a slim typographic operations strip between the subscriptions band and the lower map-and-table row: four figures separated by thin vertical hairline rules in refined editorial typography — "Active placements 12", "Verified helpers 10", "Customers 48", "Plan sales 50".

3. Fix every garbled, misspelled or gibberish word so all interface text is correct crisp English. Correct spellings: "Cash & bank ₹3.8 lakh", "Net income −₹14.4K", "GST payable ₹52.7K", "Payments", "Total revenue". On or beside the sage outline map of India, write the six city names correctly: "Patna", "Delhi NCR", "Ludhiana", "Mumbai", "Chennai", "Dehradun".

4. Ensure every money figure uses the Indian rupee symbol ₹, and keep the map graphic in sage green tones only with no blue.

All other elements, colors, spacing and typography remain unchanged. Crisp readable text, pixel-precise, professional product-design quality.`;

async function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    console.error('Usage: bun edit-erp-concept.ts <input.png> <output.png>');
    process.exit(1);
  }

  const base64 = fs.readFileSync(input).toString('base64');
  const zai = await ZAI.create();

  let response: Awaited<ReturnType<typeof zai.images.generations.edit>> | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      response = await zai.images.generations.edit({
        prompt: EDIT_PROMPT,
        images: [{ url: `data:image/png;base64,${base64}` }],
        size: '1344x768',
      });
      if (response.data?.[0]?.base64) break;
      throw new Error('empty data in response');
    } catch (err: any) {
      console.error(`Attempt ${attempt} failed: ${(err?.message ?? '').slice(0, 120)}`);
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }

  if (!response?.data?.[0]?.base64) throw new Error('Edit API returned no image');

  const buffer = Buffer.from(response.data[0].base64, 'base64');
  fs.writeFileSync(output, buffer);
  console.log(`Saved edited image → ${output} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error('Edit failed:', e.message); process.exit(1); });

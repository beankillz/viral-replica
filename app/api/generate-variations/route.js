import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(request) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.error('Missing GROQ_API_KEY in generate-variations');
            return NextResponse.json({
                error: 'Missing GROQ_API_KEY',
                details: 'Please add GROQ_API_KEY to your .env file'
            }, { status: 500 });
        }

        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        const body = await request.json();
        const { hook, cta } = body;

        if (!hook || !cta) {
            return NextResponse.json(
                { error: 'Hook and CTA are required' },
                { status: 400 }
            );
        }

        const prompt = `You are a viral content optimizer. Your goal is to IMPROVE the original hook and CTA while maintaining their core message and pattern.

Original Hook: "${hook}"
Original CTA: "${cta}"

Generate 10 variations. For each variation:
1. "Hook": Rewrite the original hook to be punchier, but keep the SAME topic/meaning.
2. "CTA": Rewrite the original CTA to be more compelling, but keep the SAME specific action (e.g. if original says "follow", new one must say "follow").
3. "Angle": The psychological trigger used.

Angles to cover:
1. Fear (Loss Aversion)
2. Greed (Direct Benefit)
3. Curiosity (Information Gap)
4. Urgency (Time Sensitivity)
5. Social Proof (Bandwagon)
6. FOMO (Fear of Missing Out)
7. Humor (Entertainment)
8. Authority (Expertise)
9. Scarcity (Limited Resource)
10. Trust (Reliability)

CRITICAL RULES:
- Do NOT generate random text. You MUST optimize the specific input text provided above.
- If the original hook is about "cats", the variations MUST be about "cats".
- If the original CTA is "click link", the variations MUST be about "clicking the link".
- Keep hooks under 12 words.
- Keep CTAs under 6 words.
- Maintain the "viral pattern" of the original (e.g., if it's a question, try to keep it a question or a strong statement).

Output exactly this JSON shape:
{
  "variations": [
    { "hook": "...", "cta": "...", "angle": "Fear" },
    ...
  ]
}`;

        const MAX_RETRIES = 3;
        const RETRY_DELAY = 1000;

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let completion;
        let lastError;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    model: 'llama-3.3-70b-versatile',
                    response_format: { type: 'json_object' }
                });
                break; // Success, exit loop
            } catch (err) {
                console.warn(`Attempt ${i + 1} failed: ${err.message}`);
                lastError = err;
                if (i < MAX_RETRIES - 1) {
                    await delay(RETRY_DELAY * Math.pow(2, i)); // Exponential backoff
                }
            }
        }

        if (!completion) {
            throw lastError || new Error('Failed to connect to AI service after retries');
        }

        const content = completion.choices[0]?.message?.content;

        if (!content) {
            throw new Error('No content received from Groq');
        }

        const parsedContent = JSON.parse(content);

        return NextResponse.json(parsedContent);

    } catch (error) {
        console.error('Generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate variations', details: error.message },
            { status: 500 }
        );
    }
}

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

        const prompt = `You are a marketing content generator. Generate exactly 10 variations of short-form video text, each using a DIFFERENT psychological trigger.

Original Hook: "${hook}"
Original CTA: "${cta}"

Create one variation for each of these angles (in order):
1. Fear - What they'll lose if they don't act
2. Greed - The gains/benefits they'll receive  
3. Curiosity - Intrigue and mystery
4. Urgency - Time-sensitive language
5. Social Proof - "Others are doing this"
6. FOMO - Fear of missing out
7. Humor - Funny or lighthearted approach
8. Authority - Expert or credible tone
9. Scarcity - Limited availability
10. Trust - Building credibility and safety

Important:
- Keep hooks SHORT (under 10 words)
- Keep CTAs ACTIONABLE (under 8 words)
- Make each variation DISTINCTLY different from the original
- Match the energy and style of short-form viral content

Output exactly this JSON shape:
{
  "variations": [
    { "hook": "...", "cta": "...", "angle": "Fear" },
    { "hook": "...", "cta": "...", "angle": "Greed" },
    { "hook": "...", "cta": "...", "angle": "Curiosity" },
    { "hook": "...", "cta": "...", "angle": "Urgency" },
    { "hook": "...", "cta": "...", "angle": "Social Proof" },
    { "hook": "...", "cta": "...", "angle": "FOMO" },
    { "hook": "...", "cta": "...", "angle": "Humor" },
    { "hook": "...", "cta": "...", "angle": "Authority" },
    { "hook": "...", "cta": "...", "angle": "Scarcity" },
    { "hook": "...", "cta": "...", "angle": "Trust" }
  ]
}`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });

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

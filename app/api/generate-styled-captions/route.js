import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const STYLE_PROMPTS = {
    professional: 'Use a clean, authoritative, and credible tone. Be direct and confident.',
    funny: 'Use humor, wit, and playful language. Make it entertaining and memorable.',
    urgent: 'Create urgency and FOMO. Use power words and time-sensitive language.',
    friendly: 'Be casual, warm, and relatable. Like talking to a friend.',
    luxury: 'Use premium, exclusive language. Emphasize quality and sophistication.',
};

export async function POST(request) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.error('Debug: GROQ_API_KEY is undefined or empty');
            return NextResponse.json(
                { error: 'Missing GROQ_API_KEY environment variable. Checks logs.' },
                { status: 500 }
            );
        }

        console.log('Debug: GROQ_API_KEY found, length:', process.env.GROQ_API_KEY.length);

        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        const { pattern, textItems, style, topic } = await request.json();

        if (!topic) {
            return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
        }

        // Extract the structure from competitor's video
        const hookItem = textItems?.find(item => item.category === 'Hook');
        const ctaItem = textItems?.find(item => item.category === 'CTA');
        const bodyItems = textItems?.filter(item => item.category === 'Body') || [];

        const competitorHook = pattern?.hookText || hookItem?.text || '';
        const competitorCta = pattern?.ctaText || ctaItem?.text || '';
        const competitorBody = bodyItems.map(b => b.text).join(' | ') || '';

        // Build timing structure info
        const timingInfo = textItems?.map(item => ({
            category: item.category,
            duration: item.endTime - item.startTime,
            position: item.bbox ? `x:${item.bbox.x}, y:${item.bbox.y}` : 'center'
        })) || [];

        let styleGuide = STYLE_PROMPTS[style];
        if (!styleGuide) {
            // If not a preset, treat as custom style description
            styleGuide = `Use this specific style/tone: "${style}". Make it distinct and engaging.`;
        }

        const prompt = `You are an expert viral video copywriter. Analyze this competitor's caption structure and create 3 NEW variations for a different topic.

## Competitor's Caption Structure:
- Hook: "${competitorHook}" (appears ${hookItem?.startTime?.toFixed(1) || 0}s - ${hookItem?.endTime?.toFixed(1) || 1}s)
- Body: "${competitorBody}" 
- CTA: "${competitorCta}" (appears ${ctaItem?.startTime?.toFixed(1) || 0}s - ${ctaItem?.endTime?.toFixed(1) || 1}s)

## Caption Timing Pattern:
${JSON.stringify(timingInfo, null, 2)}

## Your Task:
Create 3 COMPLETELY NEW caption sets for this topic: "${topic}"

## Style Guide:
${styleGuide}

## Rules:
1. MATCH the structure exactly (same number of caption elements)
2. MATCH the approximate word count of each element
3. Keep hooks PUNCHY (under 10 words)
4. Keep CTAs ACTION-ORIENTED (under 8 words)
5. Make each variation DISTINCT from the others
6. Tailor content to the user's topic: "${topic}"

## Output exactly this JSON:
{
  "variations": [
    {
      "hook": "Your hook text here",
      "body": "Your body text here (or empty string if no body)",
      "cta": "Your CTA text here"
    },
    {
      "hook": "Second variation hook",
      "body": "Second variation body",
      "cta": "Second variation CTA"
    },
    {
      "hook": "Third variation hook",
      "body": "Third variation body",
      "cta": "Third variation CTA"
    }
  ]
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' },
            temperature: 0.8, // More creative
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        const result = JSON.parse(content);

        // Ensure we have exactly 3 variations
        if (!result.variations || result.variations.length < 3) {
            throw new Error('AI did not generate 3 variations');
        }

        // Map the timing/position from original textItems to variations
        const enrichedVariations = result.variations.slice(0, 3).map(variation => {
            return {
                ...variation,
                // Include original timing data for rendering
                hookTiming: hookItem ? { startTime: hookItem.startTime, endTime: hookItem.endTime, bbox: hookItem.bbox } : null,
                ctaTiming: ctaItem ? { startTime: ctaItem.startTime, endTime: ctaItem.endTime, bbox: ctaItem.bbox } : null,
                bodyTimings: bodyItems.map(b => ({ startTime: b.startTime, endTime: b.endTime, bbox: b.bbox })),
            };
        });

        return NextResponse.json({
            success: true,
            variations: enrichedVariations,
            originalPattern: {
                hook: competitorHook,
                body: competitorBody,
                cta: competitorCta,
            }
        });

    } catch (error) {
        console.error('Styled caption generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate captions', details: error.message },
            { status: 500 }
        );
    }
}

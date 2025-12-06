import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

/**
 * Analyzes OCR-extracted text and uses AI to categorize each item
 * as Hook, Body, or CTA based on timing, position, and content
 */
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request) {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.error('Missing GROQ_API_KEY in analyze-pattern');
            // Return success false but don't error out completely, allowing fallback to basic logic
            return NextResponse.json({
                success: false,
                error: 'Missing GROQ_API_KEY'
            }, { status: 200 });
        }

        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        const { textItems } = await request.json();

        if (!textItems || !textItems.length) {
            return NextResponse.json(
                { error: 'No text items provided' },
                { status: 400 }
            );
        }

        // Prepare text data for AI analysis
        const textSummary = textItems.map((item, i) => ({
            index: i,
            text: item.text,
            startTime: item.startTime,
            endTime: item.endTime,
            position: item.bbox ? `x:${item.bbox.x}, y:${item.bbox.y}` : 'unknown'
        }));

        const prompt = `You are analyzing text extracted from a viral short-form video. Your task is to categorize each text element.

Here are the extracted text items with their timing and position:
${JSON.stringify(textSummary, null, 2)}

Categorize each text item as one of:
- "Hook": Opening text that grabs attention (usually appears first, often at top of screen)
- "Body": Supporting or descriptive text (middle content)
- "CTA": Call-to-action (usually appears last, urges action like "Follow", "Shop", "Link in bio")

Rules:
1. Text appearing in the first 1-2 seconds is likely a Hook
2. Text appearing in the last 1-2 seconds is likely a CTA
3. Text with action words like "follow", "shop", "click", "link" is likely CTA
4. Questions or surprising statements are likely Hooks
5. If unsure, categorize as Body

Return a JSON object with this exact structure:
{
  "pattern": {
    "hookText": "the main hook text identified",
    "ctaText": "the main CTA text identified", 
    "bodyTexts": ["array of body text items"]
  },
  "categorizedItems": [
    { "index": 0, "category": "Hook|Body|CTA", "confidence": 0.0-1.0 },
    ...
  ]
}`;

        let completion;
        let lastError;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                completion = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
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
            throw new Error('No response from AI');
        }

        const analysis = JSON.parse(content);

        // Merge AI categories back into original items
        const categorizedTextItems = textItems.map((item, index) => {
            const aiCategory = analysis.categorizedItems?.find(c => c.index === index);
            return {
                ...item,
                category: aiCategory?.category || 'Body',
                aiConfidence: aiCategory?.confidence || 0.5
            };
        });

        return NextResponse.json({
            success: true,
            pattern: analysis.pattern,
            textItems: categorizedTextItems
        });

    } catch (error) {
        console.error('Pattern analysis error:', error);
        return NextResponse.json(
            { error: 'Analysis failed', details: error.message },
            { status: 500 }
        );
    }
}

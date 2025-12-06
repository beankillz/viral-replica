/**
 * Generates variations of hooks and CTAs using the API
 * 
 * @param {string} hook - The original hook text
 * @param {string} cta - The original CTA text
 * @returns {Promise<Array<{hook: string, cta: string}>>} Array of variations
 */
export async function generateVariations(hook, cta) {
    try {
        const response = await fetch('/api/generate-variations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hook, cta }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate variations');
        }

        const data = await response.json();
        return data.variations || [];
    } catch (error) {
        console.error('Error generating variations:', error);
        throw error;
    }
}

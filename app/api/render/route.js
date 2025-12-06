import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';
import ffmpeg from '@/lib/ffmpeg';
import archiver from 'archiver';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';

// Helper to escape text for FFmpeg drawtext
const escapeText = (text) => {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "'\\''")
        .replace(/%/g, '\\%');
};

export async function POST(request) {
    try {
        const { variations, baseTextMap } = await request.json();

        if (!variations || !variations.length) {
            return NextResponse.json({ error: 'No variations provided' }, { status: 400 });
        }

        // Define paths
        const userVideoPath = path.join(process.cwd(), 'temp', 'user-video', 'user.mp4');
        const outputDir = path.join(process.cwd(), 'temp', 'outputs', randomUUID());

        // Ensure paths exist
        if (!await fs.pathExists(userVideoPath)) {
            return NextResponse.json({ error: 'User video not found. Please upload one first.' }, { status: 404 });
        }
        await fs.ensureDir(outputDir);

        console.log(`Starting render for ${variations.length} variations...`);

        // Create concurrency limit
        const limit = pLimit(2);

        // Process each variation
        const renderPromises = variations.map((variation, index) =>
            limit(async () => {
                const outputPath = path.join(outputDir, `variation-${index + 1}.mp4`);
                console.log(`Starting render ${index + 1}/${variations.length}...`);

                const filters = [];
                // FIX: Use local font file (works on Windows & Linux)
                // Normalize path for FFmpeg filter (replace backslashes with forward slashes, escape colons)
                const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf');
                const fontFile = fontPath.replace(/\\/g, '/').replace(/:/g, '\\\\:');

                // Use timing from the variation if available, otherwise from baseTextMap

                // Add Hook text overlay
                if (variation.hook) {
                    const hookTiming = variation.hookTiming || baseTextMap?.find(i => i.category === 'Hook');
                    const startTime = hookTiming?.startTime ?? 0;
                    const endTime = hookTiming?.endTime ?? 2;
                    const x = hookTiming?.bbox?.x ?? 50;
                    const y = hookTiming?.bbox?.y ?? 100;

                    filters.push(
                        `drawtext=text='${escapeText(variation.hook)}':fontfile='${fontFile}':fontcolor=white:fontsize=52:x=${x}:y=${y}:box=1:boxcolor=black@0.6:boxborderw=8:enable='between(t,${startTime},${endTime})'`
                    );
                }

                // Add Body text overlay (if exists)
                if (variation.body && variation.body.trim()) {
                    const bodyTimings = variation.bodyTimings || baseTextMap?.filter(i => i.category === 'Body') || [];
                    const bodyTiming = bodyTimings[0];
                    const startTime = bodyTiming?.startTime ?? 2;
                    const endTime = bodyTiming?.endTime ?? 5;
                    const x = bodyTiming?.bbox?.x ?? 50;
                    const y = bodyTiming?.bbox?.y ?? 200;

                    filters.push(
                        `drawtext=text='${escapeText(variation.body)}':fontfile='${fontFile}':fontcolor=white:fontsize=42:x=${x}:y=${y}:box=1:boxcolor=black@0.6:boxborderw=6:enable='between(t,${startTime},${endTime})'`
                    );
                }

                // Add CTA text overlay
                if (variation.cta) {
                    const ctaTiming = variation.ctaTiming || baseTextMap?.find(i => i.category === 'CTA');
                    const startTime = ctaTiming?.startTime ?? 5;
                    const endTime = ctaTiming?.endTime ?? 10;
                    const x = ctaTiming?.bbox?.x ?? 50;
                    const y = ctaTiming?.bbox?.y ?? 300;

                    filters.push(
                        `drawtext=text='${escapeText(variation.cta)}':fontfile='${fontFile}':fontcolor=white:fontsize=48:x=${x}:y=${y}:box=1:boxcolor=black@0.6:boxborderw=8:enable='between(t,${startTime},${endTime})'`
                    );
                }

                // If no filters, skip this variation
                if (filters.length === 0) {
                    console.log(`⚠️ No text overlays for variation ${index + 1}, copying original`);
                    await fs.copy(userVideoPath, outputPath);
                    return outputPath;
                }

                const filterComplex = filters.join(',');
                console.log(`Filter for variation ${index + 1}:`, filterComplex);

                return new Promise((resolve, reject) => {
                    ffmpeg(userVideoPath)
                        .outputOptions('-vf', filterComplex)
                        .output(outputPath)
                        .on('start', (cmd) => {
                            console.log('FFmpeg command:', cmd);
                            fs.appendFileSync('render-debug.log', `\n[${new Date().toISOString()}] Command: ${cmd}\n`);
                        })
                        .on('end', () => {
                            console.log(`✅ Completed render ${index + 1}/${variations.length}`);
                            resolve(outputPath);
                        })
                        .on('error', (err, stdout, stderr) => {
                            console.error(`❌ Error rendering variation ${index + 1}:`, err);
                            console.error('FFmpeg stderr:', stderr);
                            fs.appendFileSync('render-debug.log', `\n[${new Date().toISOString()}] Error: ${err.message}\nStderr: ${stderr}\n`);
                            reject(err);
                        })
                        .run();
                });
            })
        );

        // Wait for all renders to complete
        await Promise.all(renderPromises);
        console.log(`All ${variations.length} variations rendered successfully!`);

        // Create ZIP archive
        const zipPath = path.join(outputDir, 'viral-videos.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);

            // Add all MP4 files to zip
            archive.directory(outputDir, false, (entry) => {
                return entry.name.endsWith('.mp4') ? entry : false;
            });

            archive.finalize();
        });

        // Read the zip file to send as response
        const zipBuffer = await fs.readFile(zipPath);

        // CLEANUP: Delete temp files to save space
        try {
            console.log('Cleaning up temporary files...');
            // 1. Delete the specific output directory (contains the MP4s and ZIP)
            await fs.remove(outputDir);

            // 2. Clear the frames directory (removes all extracted screenshots)
            const framesDir = path.join(process.cwd(), 'temp', 'frames');
            await fs.emptyDir(framesDir);

            console.log('Cleanup complete: Deleted output dir and emptied frames folder.');
        } catch (cleanupError) {
            console.error('Warning: Cleanup failed:', cleanupError);
            // Don't fail the request just because cleanup failed
        }

        // Return the zip file
        return new NextResponse(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="viral-videos.zip"',
            },
        });

    } catch (error) {
        console.error('Render error:', error);
        return NextResponse.json(
            { error: 'Rendering failed', details: error.message },
            { status: 500 }
        );
    }
}

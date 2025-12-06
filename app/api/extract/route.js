import { NextResponse } from 'next/server';
import ffmpeg from '@/lib/ffmpeg';
import path from 'path';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

export async function POST(request) {
    try {
        const { videoPath } = await request.json();
        console.log('Extract API received videoPath:', videoPath);

        if (!videoPath) {
            return NextResponse.json(
                { error: 'No video path provided' },
                { status: 400 }
            );
        }

        // Validate video path exists
        if (!await fs.pathExists(videoPath)) {
            return NextResponse.json(
                { error: 'Video file not found' },
                { status: 404 }
            );
        }

        const uniqueId = randomUUID();
        const outputDir = path.join(process.cwd(), 'temp', 'frames', uniqueId);

        await fs.ensureDir(outputDir);

        // FFmpeg extraction with better error handling
        try {
            console.log('About to run FFmpeg on:', videoPath);
            console.log('Output directory:', outputDir);

            await new Promise((resolve, reject) => {
                const command = ffmpeg(videoPath)
                    // Extract 2 frames per second (every 0.5s) to capture fuller words
                    .outputOptions('-vf', 'fps=2')
                    .output(path.join(outputDir, 'frame-%d.png'))
                    .on('start', (commandLine) => {
                        console.log('FFmpeg command:', commandLine);
                    })
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err);
                        reject(new Error(`FFmpeg failed: ${err.message}`));
                    });

                command.run();
            });
        } catch (ffmpegError) {
            return NextResponse.json(
                { error: 'Frame extraction failed', details: ffmpegError.message },
                { status: 500 }
            );
        }

        // Get list of generated files
        const files = await fs.readdir(outputDir);
        const framePaths = files
            .filter(file => file.endsWith('.png'))
            .map(file => path.join(outputDir, file))
            // Sort numerically by frame number
            .sort((a, b) => {
                const getNum = (p) => parseInt(p.match(/frame-(\d+)\.png/)?.[1] || '0');
                return getNum(a) - getNum(b);
            });

        const textItems = [];
        console.log(`Processing ${framePaths.length} frames for OCR...`);

        // Use Tesseract CLI instead of tesseract.js to avoid worker issues in Next.js
        // Use full path since PATH may not be updated yet
        const tesseractPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
        let tesseractAvailable = false;
        try {
            if (await fs.pathExists(tesseractPath)) {
                execSync(`"${tesseractPath}" --version`, { stdio: 'pipe' });
                tesseractAvailable = true;
                console.log('Using Tesseract CLI for OCR');
            }
        } catch {
            console.log('Tesseract CLI not found, will try tesseract.js...');
        }

        if (tesseractAvailable) {
            // Use Tesseract CLI
            // At 2fps, each frame is 0.5 seconds
            const FPS = 2;
            for (const framePath of framePaths) {
                const frameNum = parseInt(framePath.match(/frame-(\d+)\.png/)?.[1] || '1');
                const startTime = (frameNum - 1) / FPS;
                const endTime = frameNum / FPS;

                console.log(`OCR on frame ${frameNum} (${startTime.toFixed(2)}s): ${framePath}`);

                try {
                    // Run tesseract CLI with TSV output
                    const result = execSync(`"${tesseractPath}" "${framePath}" stdout -l eng tsv`, {
                        encoding: 'utf8',
                        stdio: ['pipe', 'pipe', 'pipe']
                    });

                    // Parse TSV output
                    // Format: level page_num block_num par_num line_num word_num left top width height conf text
                    const rows = result.trim().split('\n');

                    // Skip header
                    if (rows.length > 1) {
                        // Group words into lines based on line_num
                        const lines = {};

                        rows.slice(1).forEach(row => {
                            const cols = row.split('\t');
                            if (cols.length < 12) return;

                            const level = parseInt(cols[0]);
                            const lineNum = parseInt(cols[4]);
                            const left = parseInt(cols[6]);
                            const top = parseInt(cols[7]);
                            const width = parseInt(cols[8]);
                            const height = parseInt(cols[9]);
                            const conf = parseFloat(cols[10]);
                            const text = cols[11];

                            // Level 5 is word. Skip single chars to avoid noise.
                            if (level === 5 && text.trim().length > 1) {
                                if (!lines[lineNum]) {
                                    lines[lineNum] = {
                                        text: [],
                                        bbox: { x: left, y: top, w: width, h: height },
                                        conf: 0,
                                        count: 0
                                    };
                                } else {
                                    // Update bbox to encompass new word
                                    const l = lines[lineNum];
                                    l.bbox.w = Math.max(l.bbox.x + l.bbox.w, left + width) - Math.min(l.bbox.x, left);
                                    l.bbox.h = Math.max(l.bbox.y + l.bbox.h, top + height) - Math.min(l.bbox.y, top);
                                    l.bbox.x = Math.min(l.bbox.x, left);
                                    l.bbox.y = Math.min(l.bbox.y, top);
                                }
                                lines[lineNum].text.push(text);
                                lines[lineNum].conf += conf;
                                lines[lineNum].count++;
                            }
                        });

                        // Convert grouped lines to textItems
                        Object.values(lines).forEach(line => {
                            textItems.push({
                                id: randomUUID(),
                                text: line.text.join(' '),
                                startTime,
                                endTime,
                                confidence: line.count > 0 ? line.conf / line.count : 0,
                                bbox: line.bbox
                            });
                        });
                    }
                } catch (ocrError) {
                    console.error(`OCR error on frame ${frameNum}:`, ocrError.message);
                }
            }
        } else {
            // Fallback: Use tesseract.js with dynamic import to avoid bundler issues
            try {
                const Tesseract = await import('tesseract.js');

                // Use recognize directly (simpler API)
                const FPS = 2;
                for (const framePath of framePaths) {
                    const frameNum = parseInt(framePath.match(/frame-(\d+)\.png/)?.[1] || '1');
                    const startTime = (frameNum - 1) / FPS;
                    const endTime = frameNum / FPS;

                    console.log(`OCR on frame ${frameNum} (${startTime.toFixed(2)}s): ${framePath}`);

                    try {
                        // FIX FOR RENDER: Explicitly set worker path to avoid /ROOT/ prefix issue
                        const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');

                        const { data } = await Tesseract.recognize(framePath, 'eng', {
                            workerPath: workerPath
                        });

                        console.log(`Frame ${frameNum} raw text:`, data.text);

                        // Robust parsing: traverse blocks -> paragraphs -> lines
                        // Tesseract.js structure can vary, but blocks/paragraphs/lines is standard
                        let foundItems = false;
                        if (data.blocks && data.blocks.length > 0) {
                            data.blocks.forEach(block => {
                                if (block.paragraphs) {
                                    block.paragraphs.forEach(paragraph => {
                                        if (paragraph.lines) {
                                            paragraph.lines.forEach(line => {
                                                if (line.text.trim().length > 0) {
                                                    textItems.push({
                                                        id: randomUUID(),
                                                        text: line.text.trim(),
                                                        startTime,
                                                        endTime,
                                                        confidence: line.confidence,
                                                        bbox: {
                                                            x: line.bbox.x0,
                                                            y: line.bbox.y0,
                                                            w: line.bbox.x1 - line.bbox.x0,
                                                            h: line.bbox.y1 - line.bbox.y0
                                                        }
                                                    });
                                                    foundItems = true;
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }

                        // Fallback to top-level lines if blocks traversal failed (legacy support)
                        if (!foundItems && data.lines && data.lines.length > 0) {
                            data.lines.forEach(line => {
                                if (line.text.trim().length > 0) {
                                    textItems.push({
                                        id: randomUUID(),
                                        text: line.text.trim(),
                                        startTime,
                                        endTime,
                                        confidence: line.confidence,
                                        bbox: {
                                            x: line.bbox.x0,
                                            y: line.bbox.y0,
                                            w: line.bbox.x1 - line.bbox.x0,
                                            h: line.bbox.y1 - line.bbox.y0
                                        }
                                    });
                                }
                            });
                        }
                    } catch (ocrError) {
                        console.error(`OCR error on frame ${frameNum}:`, ocrError.message);
                    }
                }
            } catch (importError) {
                console.error('Failed to load tesseract.js:', importError);
                return NextResponse.json({
                    message: 'Frames extracted but OCR not available. Install Tesseract CLI: winget install UB-Mannheim.TesseractOCR',
                    uniqueId,
                    frames: framePaths,
                    textItems: [],
                    count: framePaths.length
                });
            }
        }

        console.log(`Total raw text items found: ${textItems.length}`);

        // Deduplicate: Merge consecutive frames with the same text
        // This gives us accurate start/end times for each caption
        const deduplicatedItems = [];
        const textTracker = new Map(); // text -> { item, lastEndTime }

        textItems.sort((a, b) => a.startTime - b.startTime);

        for (const item of textItems) {
            const normalizedText = item.text.trim().toLowerCase();

            if (textTracker.has(normalizedText)) {
                const tracked = textTracker.get(normalizedText);
                // If this frame is within 0.3 seconds of the last occurrence, extend it
                if (item.startTime - tracked.lastEndTime <= 0.3) {
                    tracked.item.endTime = item.endTime;
                    tracked.lastEndTime = item.endTime;
                } else {
                    // Gap too large, this is a new occurrence
                    deduplicatedItems.push(tracked.item);
                    textTracker.set(normalizedText, {
                        item: { ...item, id: randomUUID() },
                        lastEndTime: item.endTime
                    });
                }
            } else {
                textTracker.set(normalizedText, {
                    item: { ...item, id: randomUUID() },
                    lastEndTime: item.endTime
                });
            }
        }

        // Add remaining tracked items
        for (const tracked of textTracker.values()) {
            deduplicatedItems.push(tracked.item);
        }

        // Sort by start time
        deduplicatedItems.sort((a, b) => a.startTime - b.startTime);

        console.log(`After deduplication: ${deduplicatedItems.length} unique captions`);

        // Auto-analyze pattern with AI if we have text items
        let pattern = null;
        let categorizedItems = deduplicatedItems;

        if (deduplicatedItems.length > 0) {
            try {
                console.log('Analyzing pattern with AI...');
                const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analyze-pattern`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ textItems: deduplicatedItems })
                });

                if (analysisResponse.ok) {
                    const analysisData = await analysisResponse.json();
                    pattern = analysisData.pattern;
                    categorizedItems = analysisData.textItems || textItems;
                    console.log('AI Pattern analysis complete:', pattern);
                }
            } catch (analysisError) {
                console.error('AI analysis failed, continuing with uncategorized items:', analysisError.message);
            }
        }

        return NextResponse.json({
            message: 'Frames and text extracted successfully',
            uniqueId,
            frames: framePaths,
            textItems: categorizedItems,
            pattern,
            count: framePaths.length
        });

    } catch (error) {
        console.error('Extraction error:', error);
        return NextResponse.json(
            { error: 'Extraction failed', details: error.message },
            { status: 500 }
        );
    }
}

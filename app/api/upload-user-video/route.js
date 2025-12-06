import { NextResponse } from 'next/server';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import fs from 'fs';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Save to temp directory within the project
        const tempDir = path.join(process.cwd(), 'temp', 'user-video');

        // Ensure directory exists
        if (!fs.existsSync(tempDir)) {
            await mkdir(tempDir, { recursive: true });
        }

        const filepath = path.join(tempDir, 'user.mp4');
        await writeFile(filepath, buffer);

        // Also save to public folder for serving
        const publicDir = path.join(process.cwd(), 'public', 'user-video');
        if (!fs.existsSync(publicDir)) {
            await mkdir(publicDir, { recursive: true });
        }

        const publicPath = path.join(publicDir, 'user.mp4');
        await writeFile(publicPath, buffer);

        return NextResponse.json({
            success: true,
            message: 'User video uploaded successfully',
            filePath: filepath,
            relativeUrl: '/user-video/user.mp4'
        });

    } catch (error) {
        console.error('Upload user video error:', error);
        return NextResponse.json(
            { error: 'Upload failed', details: error.message },
            { status: 500 }
        );
    }
}

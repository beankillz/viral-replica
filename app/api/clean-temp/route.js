
import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

export async function POST() {
    try {
        const framesDir = path.join(process.cwd(), 'temp', 'frames');
        const outputDir = path.join(process.cwd(), 'public', 'output');

        let deletedFrames = false;
        let deletedOutput = false;

        if (await fs.pathExists(framesDir)) {
            await fs.emptyDir(framesDir);
            deletedFrames = true;
        }

        if (await fs.pathExists(outputDir)) {
            // In a real app we might want to be selective, but user asked to "delete all"
            await fs.emptyDir(outputDir);
            deletedOutput = true;
        }

        console.log('System cleanup performed.');

        return NextResponse.json({
            success: true,
            message: 'System cache cleared successfully.',
            details: {
                framesCleared: deletedFrames,
                outputCleared: deletedOutput
            }
        });
    } catch (error) {
        console.error('Cleanup failed:', error);
        return NextResponse.json(
            { error: 'Cleanup failed', details: error.message },
            { status: 500 }
        );
    }
}

'use client';

import { useRef, useEffect } from 'react';

export default function VideoPlayer({ src, onTimeUpdate }) {
    const videoRef = useRef(null);

    const handleTimeUpdate = () => {
        if (videoRef.current && onTimeUpdate) {
            onTimeUpdate(videoRef.current.currentTime);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <video
                ref={videoRef}
                src={src}
                controls
                className="w-full rounded-lg shadow-lg"
                onTimeUpdate={handleTimeUpdate}
            />
        </div>
    );
}

'use client';

import { useState, useRef } from 'react';

/**
 * VideoOverlayPlayer - A combined video player with text overlay
 * 
 * @param {string} videoFileUrl - URL of the video to display
 * @param {Array} extractedTextData - Array of text items: {id, text, start, end, x, y, category?}
 * @param {Function} onTextUpdate - Callback when text is edited: (id, updates) => void
 */
export default function VideoOverlayPlayer({
    videoFileUrl,
    extractedTextData = [],
    onTextUpdate
}) {
    const videoRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    // Handle video time update
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // Handle video metadata loaded
    const handleLoadedMetadata = (e) => {
        setVideoDimensions({
            width: e.target.videoWidth,
            height: e.target.videoHeight
        });
    };

    // Filter visible items based on current time
    // Supports both {start, end} and {startTime, endTime} formats
    const visibleItems = extractedTextData.filter(item => {
        const start = item.start ?? item.startTime ?? 0;
        const end = item.end ?? item.endTime ?? Infinity;
        return currentTime >= start && currentTime <= end;
    });

    // Handle click to edit (single click)
    const handleClick = (item) => {
        setEditingId(item.id);
        setEditText(item.text);
    };

    // Handle text change
    const handleTextChange = (e) => {
        setEditText(e.target.value);
    };

    // Handle save on blur or Enter
    const handleSave = (item) => {
        if (editingId === item.id && onTextUpdate) {
            onTextUpdate(item.id, { text: editText });
        }
        setEditingId(null);
    };

    // Handle key press (Enter to save, Escape to cancel)
    const handleKeyDown = (e, item) => {
        if (e.key === 'Enter') {
            handleSave(item);
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    // Handle category change
    const handleCategoryChange = (item, category) => {
        if (onTextUpdate) {
            onTextUpdate(item.id, { category });
        }
    };

    // Get position style (percentage based)
    const getPositionStyle = (item) => {
        if (!videoDimensions.width || !videoDimensions.height) return { display: 'none' };

        let x, y, w;

        if (item.bbox) {
            x = item.bbox.x;
            y = item.bbox.y;
            w = item.bbox.w;
        } else {
            x = item.x || 0;
            y = item.y || 0;
            w = 0;
        }

        return {
            left: `${(x / videoDimensions.width) * 100}%`,
            top: `${(y / videoDimensions.height) * 100}%`,
            width: w ? `${(w / videoDimensions.width) * 100}%` : 'auto',
            minWidth: '120px', // Minimum width for usability
        };
    };

    // Get category color
    const getCategoryColor = (category) => {
        switch (category) {
            case 'Hook': return 'border-red-500 bg-red-500/20';
            case 'Body': return 'border-blue-500 bg-blue-500/20';
            case 'CTA': return 'border-green-500 bg-green-500/20';
            default: return 'border-yellow-400 bg-black/50';
        }
    };

    return (
        <div
            className="relative w-full bg-black rounded-xl overflow-hidden"
            style={{
                aspectRatio: videoDimensions.width && videoDimensions.height
                    ? `${videoDimensions.width} / ${videoDimensions.height}`
                    : '16 / 9'
            }}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                src={videoFileUrl}
                controls
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
            />

            {/* Text Overlay Layer */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                {visibleItems.map((item) => {
                    const style = getPositionStyle(item);
                    const colorClass = getCategoryColor(item.category);

                    return (
                        <div
                            key={item.id}
                            style={{
                                position: 'absolute',
                                ...style
                            }}
                            className={`
                                pointer-events-auto border-2 ${colorClass}
                                text-white p-2 rounded-lg shadow-lg
                                flex flex-col gap-1 backdrop-blur-sm
                                transition-all duration-200
                            `}
                        >
                            {/* Text Content - Click to Edit */}
                            {editingId === item.id ? (
                                <input
                                    type="text"
                                    value={editText}
                                    onChange={handleTextChange}
                                    onBlur={() => handleSave(item)}
                                    onKeyDown={(e) => handleKeyDown(e, item)}
                                    autoFocus
                                    className="bg-white text-black px-2 py-1 text-sm rounded w-full outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <div
                                    onClick={() => handleClick(item)}
                                    className="text-sm font-bold cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded transition-colors break-words"
                                    title="Click to edit"
                                >
                                    {item.text}
                                </div>
                            )}

                            {/* Category Dropdown */}
                            <select
                                value={item.category || ''}
                                onChange={(e) => handleCategoryChange(item, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className={`
                                    text-xs p-1 rounded border cursor-pointer
                                    ${item.category === 'Hook' ? 'bg-red-600 border-red-400' :
                                        item.category === 'Body' ? 'bg-blue-600 border-blue-400' :
                                            item.category === 'CTA' ? 'bg-green-600 border-green-400' :
                                                'bg-gray-800 border-gray-600'}
                                    text-white
                                `}
                            >
                                <option value="">Select Type</option>
                                <option value="Hook">🪝 Hook</option>
                                <option value="Body">📝 Body</option>
                                <option value="CTA">🎯 CTA</option>
                            </select>
                        </div>
                    );
                })}
            </div>

            {/* Current Time Badge */}
            <div className="absolute bottom-16 left-4 px-3 py-1 bg-black/70 rounded-lg text-white text-sm font-mono backdrop-blur-sm pointer-events-none">
                ⏱️ {currentTime.toFixed(1)}s
            </div>
        </div>
    );
}

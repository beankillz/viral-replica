'use client';

import { useState, useEffect } from 'react';

export default function TextOverlay({ currentTime, textItems, onUpdateItem }) {
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');

    const visibleItems = textItems.filter(
        item => currentTime >= item.startTime && currentTime <= item.endTime
    );

    const handleDoubleClick = (item) => {
        setEditingId(item.id);
        setEditText(item.text);
    };

    const handleTextChange = (e) => {
        setEditText(e.target.value);
    };

    const handleBlur = (item) => {
        if (editingId === item.id) {
            onUpdateItem(item.id, { text: editText });
            setEditingId(null);
        }
    };

    const handleCategoryChange = (item, category) => {
        onUpdateItem(item.id, { category });
    };

    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
            {visibleItems.map((item) => (
                <div
                    key={item.id}
                    style={{
                        position: 'absolute',
                        left: `${item.bbox.x}px`,
                        top: `${item.bbox.y}px`,
                        width: `${item.bbox.w}px`,
                        height: `${item.bbox.h}px`,
                    }}
                    className="pointer-events-auto border-2 border-yellow-400 bg-black/50 text-white p-1 flex flex-col gap-1"
                >
                    {editingId === item.id ? (
                        <input
                            type="text"
                            value={editText}
                            onChange={handleTextChange}
                            onBlur={() => handleBlur(item)}
                            autoFocus
                            className="bg-white text-black px-1 text-sm w-full"
                        />
                    ) : (
                        <div
                            onDoubleClick={() => handleDoubleClick(item)}
                            className="text-sm font-bold cursor-text truncate"
                            title="Double click to edit"
                        >
                            {item.text}
                        </div>
                    )}

                    <select
                        value={item.category || ''}
                        onChange={(e) => handleCategoryChange(item, e.target.value)}
                        className="bg-gray-800 text-white text-xs p-1 rounded border border-gray-600"
                    >
                        <option value="">Select Type</option>
                        <option value="Hook">Hook</option>
                        <option value="Body">Body</option>
                        <option value="CTA">CTA</option>
                    </select>
                </div>
            ))}
        </div>
    );
}

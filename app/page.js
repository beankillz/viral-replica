'use client';

import { useState } from 'react';

const STYLES = [
  { id: 'professional', label: '💼 Professional', desc: 'Clean, authoritative tone' },
  { id: 'funny', label: '😂 Funny', desc: 'Humorous, playful tone' },
  { id: 'urgent', label: '🔥 Urgent', desc: 'High-energy, FOMO-driven' },
  { id: 'friendly', label: '😊 Friendly', desc: 'Casual, relatable tone' },
  { id: 'luxury', label: '✨ Luxury', desc: 'Premium, exclusive feel' },
  { id: 'custom', label: '✏️ Custom', desc: 'Describe your own style' },
];

export default function Home() {
  // State
  const [videoPath, setVideoPath] = useState(null);
  const [userVideoPath, setUserVideoPath] = useState(null);
  const [textItems, setTextItems] = useState([]);
  const [pattern, setPattern] = useState(null);
  const [variations, setVariations] = useState([]);

  // User Inputs
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [userTopic, setUserTopic] = useState('');
  const [customStylePrompt, setCustomStylePrompt] = useState('');

  // Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // Step Tracker
  const [currentStep, setCurrentStep] = useState(1);

  // Upload Competitor Video
  const handleCompetitorUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVideoPath(data.relativeUrl);
      setCurrentStep(2);

      // Extract Text + AI Analysis
      setIsExtracting(true);
      const extRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: data.filePath }),
      });
      const extData = await extRes.json();

      setTextItems(extData.textItems || []);
      setPattern(extData.pattern || null);
      setCurrentStep(3);

    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  // Upload User Video
  const handleUserUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-user-video', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUserVideoPath(data.relativeUrl);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Generate 3 Variations Based on Style
  const handleGenerate = async () => {
    if (!userTopic.trim()) {
      alert('Please enter your video topic/niche');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-styled-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern,
          textItems,
          style: selectedStyle === 'custom' ? customStylePrompt : selectedStyle,
          topic: userTopic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVariations(data.variations || []);
      setCurrentStep(4);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Render All 3 Variations
  const handleRender = async () => {
    if (!userVideoPath) return alert('Please upload your video first.');
    if (variations.length === 0) return alert('Generate variations first.');

    setIsRendering(true);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variations,
          baseTextMap: textItems,
        }),
      });

      if (!res.ok) throw new Error('Rendering failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viral-replica-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  // Get category styling
  const getCategoryStyle = (category) => {
    switch (category) {
      case 'Hook': return 'bg-red-500/20 border-red-500 text-red-300';
      case 'CTA': return 'bg-green-500/20 border-green-500 text-green-300';
      case 'Body': return 'bg-blue-500/20 border-blue-500 text-blue-300';
      default: return 'bg-gray-500/20 border-gray-500 text-gray-300';
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="text-center py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Viral Replica
          </h1>
          <p className="text-gray-400 mt-2">Clone viral video patterns with AI</p>
        </header>

        {/* Progress Steps */}
        <div className="flex justify-center gap-2 md:gap-4 mb-8 flex-wrap">
          {['Upload', 'Analyze', 'Style', 'Render'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${currentStep > i + 1 ? 'bg-green-500' : currentStep === i + 1 ? 'bg-blue-500' : 'bg-gray-700'}`}>
                {currentStep > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${currentStep >= i + 1 ? 'text-white' : 'text-gray-500'}`}>{step}</span>
              {i < 3 && <div className={`w-8 h-0.5 ${currentStep > i + 1 ? 'bg-green-500' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left Column */}
          <div className="space-y-6">

            {/* Competitor Video Upload */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs">1</span>
                Competitor Video
              </h2>
              {!videoPath ? (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-700 rounded-lg hover:border-purple-500 cursor-pointer transition-all bg-gray-900/30">
                  <input type="file" accept="video/*" onChange={handleCompetitorUpload} className="hidden" />
                  <div className="text-4xl mb-2">📹</div>
                  <span className="text-sm text-gray-400">
                    {isUploading ? '⏳ Uploading...' : isExtracting ? '🔍 Analyzing Captions...' : 'Upload competitor video'}
                  </span>
                </label>
              ) : (
                <video src={videoPath} controls className="w-full rounded-lg" />
              )}
            </div>

            {/* Your Video Upload */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs">2</span>
                Your Video
              </h2>
              {!userVideoPath ? (
                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-700 rounded-lg hover:border-blue-500 cursor-pointer transition-all bg-gray-900/30">
                  <input type="file" accept="video/*" onChange={handleUserUpload} className="hidden" />
                  <div className="text-4xl mb-2">🎬</div>
                  <span className="text-sm text-gray-400">Upload your video</span>
                </label>
              ) : (
                <video src={userVideoPath} controls className="w-full rounded-lg" />
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">

            {/* Extracted Pattern */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs">📊</span>
                Detected Caption Structure
              </h2>

              {textItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>Upload a competitor video to analyze captions</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {textItems.map((item, i) => (
                    <div key={item.id || i} className={`p-3 rounded-lg border ${getCategoryStyle(item.category)}`}>
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm">{item.text}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-black/30 ml-2">
                          {item.category || '?'}
                        </span>
                      </div>
                      <div className="text-xs mt-1 opacity-70">
                        ⏱️ {item.startTime?.toFixed(1)}s - {item.endTime?.toFixed(1)}s
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pattern Summary */}
              {pattern && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/30">
                  <h3 className="text-sm font-bold text-purple-300 mb-2">🎯 Pattern Identified</h3>
                  <div className="space-y-1 text-sm">
                    {pattern.hookText && <div><span className="text-red-400 font-bold">Hook:</span> {pattern.hookText}</div>}
                    {pattern.ctaText && <div><span className="text-green-400 font-bold">CTA:</span> {pattern.ctaText}</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Style Selection & Topic - Only show after extraction */}
            {textItems.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-xs">🎨</span>
                  Customize Your Captions
                </h2>

                {/* Topic Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    What&apos;s your video about?
                  </label>
                  <input
                    type="text"
                    value={userTopic}
                    onChange={(e) => setUserTopic(e.target.value)}
                    placeholder="e.g., fitness tips, cooking hacks, tech reviews..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Style Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Choose your style
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${selectedStyle === style.id
                          ? 'bg-blue-600/30 border-blue-500 ring-2 ring-blue-500'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'
                          }`}
                      >
                        <div className="font-medium text-sm">{style.label}</div>
                        <div className="text-xs text-gray-400">{style.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Custom Style Input */}
                  {selectedStyle === 'custom' && (
                    <div className="mt-2 animate-fadeIn">
                      <input
                        type="text"
                        value={customStylePrompt}
                        onChange={(e) => setCustomStylePrompt(e.target.value)}
                        placeholder="Describe the style (e.g., 'Sarcastic tech bro', 'Poetic and soft')..."
                        className="w-full px-4 py-2 bg-gray-800 border border-purple-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !userTopic.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                >
                  {isGenerating ? '⏳ AI is creating your captions...' : '✨ Generate 3 Caption Variations'}
                </button>
              </div>
            )}

            {/* Generated Variations */}
            {variations.length > 0 && (
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs">✓</span>
                  Your Caption Variations
                </h2>
                <p className="text-sm text-gray-400 mb-4">3 variations ready to be overlayed on your video</p>

                <div className="space-y-3">
                  {variations.map((v, i) => (
                    <div key={i} className="p-4 rounded-lg bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700">
                      <div className="text-xs text-gray-500 mb-2">Variation #{i + 1}</div>
                      {v.hook && <div className="text-sm mb-1"><span className="text-red-400 font-bold">Hook:</span> {v.hook}</div>}
                      {v.body && <div className="text-sm mb-1"><span className="text-blue-400 font-bold">Body:</span> {v.body}</div>}
                      {v.cta && <div className="text-sm"><span className="text-green-400 font-bold">CTA:</span> {v.cta}</div>}
                    </div>
                  ))}
                </div>

                {/* Render Button */}
                <button
                  onClick={handleRender}
                  disabled={isRendering || !userVideoPath}
                  className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-4 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRendering
                    ? '⏳ Rendering 3 videos...'
                    : !userVideoPath
                      ? '⬆️ Upload Your Video First'
                      : '🎬 Create & Download 3 Videos'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main >
  );
}

import React, { useState, useEffect } from 'react';
import { Sparkles, Sliders, Palette, Zap, CheckCircle, RefreshCw, Layers } from 'lucide-react';
import { BgMode, ColorTheme } from '../UI/MotionalBackground';

export const BackgroundStudioView: React.FC = () => {
  const [mode, setMode] = useState<BgMode>(() => {
    return (localStorage.getItem('digi_bg_mode') as BgMode) || 'particles';
  });
  const [speed, setSpeed] = useState<number>(() => {
    return parseFloat(localStorage.getItem('digi_bg_speed') || '1.0');
  });
  const [theme, setTheme] = useState<ColorTheme>(() => {
    return (localStorage.getItem('digi_bg_theme') as ColorTheme) || 'cyber';
  });
  const [density, setDensity] = useState<number>(() => {
    return parseInt(localStorage.getItem('digi_bg_density') || '60', 10);
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const applyAndDispatch = (newMode: BgMode, newSpeed: number, newTheme: ColorTheme, newDensity: number) => {
    localStorage.setItem('digi_bg_mode', newMode);
    localStorage.setItem('digi_bg_speed', String(newSpeed));
    localStorage.setItem('digi_bg_theme', newTheme);
    localStorage.setItem('digi_bg_density', String(newDensity));

    const event = new CustomEvent('digi_bg_change', {
      detail: { mode: newMode, speed: newSpeed, theme: newTheme, density: newDensity }
    });
    window.dispatchEvent(event);
  };

  const handleModeChange = (newMode: BgMode) => {
    setMode(newMode);
    applyAndDispatch(newMode, speed, theme, density);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    applyAndDispatch(mode, newSpeed, theme, density);
  };

  const handleThemeChange = (newTheme: ColorTheme) => {
    setTheme(newTheme);
    applyAndDispatch(mode, speed, newTheme, density);
  };

  const handleDensityChange = (newDensity: number) => {
    setDensity(newDensity);
    applyAndDispatch(mode, speed, theme, newDensity);
  };

  const handleSaveDefaults = () => {
    applyAndDispatch(mode, speed, theme, density);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const modesConfig: { id: BgMode; title: string; desc: string; icon: string }[] = [
    {
      id: 'particles',
      title: 'Neural Particle Mesh',
      desc: 'Interactive 3D connecting nodes that react dynamically to cursor movements and mouse trail.',
      icon: '✨'
    },
    {
      id: 'aurora',
      title: 'Aurora Liquid Orbs',
      desc: 'Smooth floating ambient liquid glow spheres that blend across deep Obsidian dark space.',
      icon: '🌌'
    },
    {
      id: 'cyber',
      title: 'Perspective Cyber Grid',
      desc: 'High-tech matrix perspective grid lines with speed pulse animations.',
      icon: '🌐'
    },
    {
      id: 'cosmic',
      title: 'Cosmic Nebula Starfield',
      desc: 'Drifting starry particles creating a serene space atmosphere.',
      icon: '⭐'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl text-white shadow-md">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Motional Background Studio</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live customize interactive ambient canvas effects across public & admin views</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 animate-bounce">
              <CheckCircle className="w-3.5 h-3.5" /> Preset Saved Globally
            </span>
          )}
          <button
            onClick={handleSaveDefaults}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg hover:shadow-cyan-500/25 transition-all"
          >
            <Zap className="w-4 h-4" /> Save Preset Defaults
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mode Selector Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-500" /> Select Motional Background Engine
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modesConfig.map((item) => (
              <div
                key={item.id}
                onClick={() => handleModeChange(item.id)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                  mode === item.id
                    ? 'bg-gradient-to-br from-purple-900/20 via-slate-900 to-indigo-900/30 border-cyan-500 shadow-xl shadow-cyan-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {mode === item.id && (
                  <div className="absolute top-3 right-3 text-cyan-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                )}
                <div className="text-3xl mb-2">{item.icon}</div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Fine Tuning Sliders & Color Themes */}
        <div className="space-y-6 lg:col-span-1">
          {/* Color Scheme Picker */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-500" /> Color Accent Palette
            </h3>

            <div className="space-y-3">
              {[
                { id: 'cyber', name: 'Electric Cyber', gradients: 'from-indigo-500 via-purple-500 to-cyan-400' },
                { id: 'emerald', name: 'Emerald Gold', gradients: 'from-emerald-500 via-teal-400 to-amber-400' },
                { id: 'sunset', name: 'Neon Pulse', gradients: 'from-rose-500 via-fuchsia-500 to-orange-400' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleThemeChange(c.id as ColorTheme)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    theme === c.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{c.name}</span>
                  <div className={`w-12 h-3.5 rounded-full bg-gradient-to-r ${c.gradients}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Tuning */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-500" /> Parameter Adjuster
            </h3>

            {/* Speed Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Motion Speed</span>
                <span className="font-mono text-cyan-500">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={speed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Density Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Particle Density</span>
                <span className="font-mono text-purple-500">{density} nodes</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                step="5"
                value={density}
                onChange={(e) => handleDensityChange(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackgroundStudioView;

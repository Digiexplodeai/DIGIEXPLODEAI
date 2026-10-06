import React from 'react';

// 1. Bar Chart Component
interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

export const CustomBarChart: React.FC<{ data: BarChartData[]; title?: string }> = ({ data, title }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
      {title && <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">{title}</h3>}
      <div className="flex items-end gap-3 h-48 pt-4">
        {data.map((item, idx) => {
          const percent = (item.value / maxValue) * 100;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
              <div className="relative w-full flex justify-center">
                <div 
                  className="absolute bottom-full mb-1 bg-slate-900 dark:bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-mono z-10"
                >
                  {item.value} posts
                </div>
              </div>
              <div 
                style={{ height: `${percent}%` }}
                className={`w-full rounded-t-lg transition-all duration-500 ${item.color || 'bg-gradient-to-t from-purple-600 to-cyan-500'} group-hover:brightness-110 shadow`}
              ></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate w-full text-center">
                {item.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Donut / Progress Circle Component
export const CustomProgressCircle: React.FC<{ 
  percentage: number; 
  size?: number; 
  strokeWidth?: number; 
  title?: string;
  subtitle?: string;
}> = ({ percentage = 0, size = 120, strokeWidth = 10, title, subtitle }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
      {title && <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{title}</h3>}
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-purple-600 dark:stroke-cyan-400 transition-all duration-1000 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{Math.round(percentage)}%</span>
          {subtitle && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{subtitle}</span>}
        </div>
      </div>
    </div>
  );
};

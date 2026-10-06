import { useState, useEffect, useRef } from 'react';

interface CountUpOptions {
  duration?: number; // duration in ms (default: 1600ms)
  startOnMount?: boolean;
}

export function useCountUp(
  targetString: string,
  startTrigger: boolean = true,
  options: CountUpOptions = {}
): string {
  const { duration = 1600 } = options;
  const [displayValue, setDisplayValue] = useState<string>(targetString);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!startTrigger || hasAnimated.current) return;

    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(targetString);
      hasAnimated.current = true;
      return;
    }

    // Parse the target string into prefix, numeric value, decimals, and suffix
    // Matches formats like: "₹182", "4.8x", "+312%", "-42%", "150+", "10M+", "3,210"
    const regex = /^([^0-9.-]*)([+-]?[0-9,.]+)([^0-9.]*)$/;
    const match = targetString.trim().match(regex);

    if (!match) {
      setDisplayValue(targetString);
      return;
    }

    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const targetNum = parseFloat(numStr);

    if (isNaN(targetNum)) {
      setDisplayValue(targetString);
      return;
    }

    const hasComma = match[2].includes(',');
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const isNegative = targetNum < 0;

    let startTime: number | null = null;
    let animationFrameId: number;

    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const updateCount = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const currentVal = targetNum * easedProgress;

      let formattedNumber: string;
      if (decimals > 0) {
        formattedNumber = currentVal.toFixed(decimals);
      } else {
        const rounded = Math.round(currentVal);
        formattedNumber = hasComma ? rounded.toLocaleString() : rounded.toString();
      }

      setDisplayValue(`${prefix}${formattedNumber}${suffix}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setDisplayValue(targetString);
        hasAnimated.current = true;
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [startTrigger, targetString, duration]);

  return displayValue;
}

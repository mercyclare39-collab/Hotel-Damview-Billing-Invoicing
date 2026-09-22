import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Check, Sparkles, FileText } from 'lucide-react';

interface AutoScalingA4ContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  defaultScaleMode?: 'auto' | 'custom';
  minScale?: number;
  maxScale?: number;
  documentNumber?: string;
}

export const AutoScalingA4Container: React.FC<AutoScalingA4ContainerProps> = ({
  children,
  title = 'Live A4 Document Preview',
  subtitle = 'Auto-scaled to current screen viewport (210mm × 297mm)',
  actions,
  className = '',
  defaultScaleMode = 'auto',
  minScale = 0.35,
  maxScale = 1.35,
  documentNumber,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);

  const [autoScale, setAutoScale] = useState<number>(1);
  const [userScaleOverride, setUserScaleOverride] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState<number>(1123);
  const [isAutoFit, setIsAutoFit] = useState<boolean>(defaultScaleMode === 'auto');

  // Base A4 reference dimensions in CSS pixels (96 DPI standard)
  const A4_BASE_WIDTH = 794; // 210mm

  // Measure container width and compute auto-scale
  const updateScale = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    // Account for inner padding (32px = 16px left + 16px right)
    const availableWidth = Math.max(280, containerWidth - 32);
    const calculatedScale = Math.min(1, Math.max(minScale, availableWidth / A4_BASE_WIDTH));
    setAutoScale(calculatedScale);
  };

  // Measure content element height
  const updateHeight = () => {
    if (!contentWrapperRef.current) return;
    const measuredHeight = contentWrapperRef.current.scrollHeight || contentWrapperRef.current.offsetHeight || 1123;
    if (measuredHeight > 0) {
      setContentHeight(measuredHeight);
    }
  };

  useLayoutEffect(() => {
    updateScale();
    updateHeight();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
      updateHeight();
    });

    resizeObserver.observe(container);

    if (contentWrapperRef.current) {
      resizeObserver.observe(contentWrapperRef.current);
    }

    window.addEventListener('resize', updateScale);

    // Mutation observer for dynamic line items height changes
    const mutationObserver = new MutationObserver(() => {
      updateHeight();
    });

    if (contentWrapperRef.current) {
      mutationObserver.observe(contentWrapperRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const activeScale = isAutoFit || userScaleOverride === null ? autoScale : userScaleOverride;
  const scaledHeight = Math.ceil(contentHeight * activeScale);

  const handleZoomIn = () => {
    setIsAutoFit(false);
    setUserScaleOverride((prev) => {
      const current = prev !== null ? prev : autoScale;
      return Math.min(maxScale, Number((current + 0.05).toFixed(2)));
    });
  };

  const handleZoomOut = () => {
    setIsAutoFit(false);
    setUserScaleOverride((prev) => {
      const current = prev !== null ? prev : autoScale;
      return Math.max(minScale, Number((current - 0.05).toFixed(2)));
    });
  };

  const handleResetToAuto = () => {
    setIsAutoFit(true);
    setUserScaleOverride(null);
    updateScale();
  };

  const handleSetActualSize = () => {
    setIsAutoFit(false);
    setUserScaleOverride(1.0);
  };

  return (
    <div
      ref={containerRef}
      className={`w-full bg-stone-100/90 border border-stone-300 rounded-lg overflow-hidden shadow-xs ${className}`}
    >
      {/* Dynamic Header & Zoom Toolbar */}
      <div className="bg-stone-900 text-stone-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">{title}</h3>
              {documentNumber && (
                <span className="text-[10px] font-mono bg-stone-800 text-amber-400 px-2 py-0.5 rounded border border-stone-700">
                  {documentNumber}
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400">{subtitle}</p>
          </div>
        </div>

        {/* Zoom & Viewport Scale Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {actions && <div className="flex items-center gap-1.5 mr-2">{actions}</div>}

          <div className="flex items-center bg-stone-800 border border-stone-700 rounded-md p-0.5 text-xs text-stone-300">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={activeScale <= minScale}
              title="Zoom Out"
              className="p-1.5 hover:text-white hover:bg-stone-700 rounded disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="px-2 font-mono text-[11px] font-bold text-amber-300 min-w-[50px] text-center select-none">
              {Math.round(activeScale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={activeScale >= maxScale}
              title="Zoom In"
              className="p-1.5 hover:text-white hover:bg-stone-700 rounded disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleResetToAuto}
            title="Auto-Fit to Viewport Width"
            className={`px-2.5 py-1.5 text-xs rounded font-medium flex items-center gap-1 border transition-colors ${
              isAutoFit
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>Auto-Fit</span>
          </button>

          <button
            type="button"
            onClick={handleSetActualSize}
            title="Standard 100% Size"
            className={`px-2 py-1.5 text-xs rounded font-medium border transition-colors ${
              activeScale === 1.0 && !isAutoFit
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
            }`}
          >
            100%
          </button>
        </div>
      </div>

      {/* Auto-Scaled Canvas Viewport */}
      <div
        className="w-full flex justify-center p-3 sm:p-4 md:p-6 overflow-hidden relative bg-stone-200/70"
        style={{ minHeight: `${Math.max(300, scaledHeight + 32)}px` }}
      >
        <div
          style={{
            width: `${A4_BASE_WIDTH}px`,
            height: `${scaledHeight}px`,
            position: 'relative',
          }}
          className="transition-all duration-150 ease-out"
        >
          <div
            ref={contentWrapperRef}
            style={{
              width: `${A4_BASE_WIDTH}px`,
              transform: `scale(${activeScale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            className="flex flex-col items-center shadow-lg"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

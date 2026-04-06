import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  } as MediaQueryList);
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}

const canvasGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function getContext(type: string, ...args: unknown[]) {
  if (type === '2d') {
    return {
      canvas: this,
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillRect: () => {},
      clearRect: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => null,
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray() }),
      putImageData: () => {},
      measureText: () => ({ width: 0 }),
      setTransform: () => {},
      fillText: () => {},
      strokeText: () => {},
    } as unknown as CanvasRenderingContext2D;
  }

  if (type === 'webgl' || type === 'webgl2') {
    return {
      canvas: this,
      getExtension: () => null,
      getParameter: () => null,
      createShader: () => null,
      shaderSource: () => {},
      compileShader: () => {},
      createProgram: () => null,
      attachShader: () => {},
      linkProgram: () => {},
      useProgram: () => {},
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getShaderInfoLog: () => '',
      getProgramInfoLog: () => '',
      viewport: () => {},
      clearColor: () => {},
      clear: () => {},
      enable: () => {},
      disable: () => {},
      blendFunc: () => {},
      drawArrays: () => {},
      drawElements: () => {},
      createBuffer: () => null,
      bindBuffer: () => {},
      bufferData: () => {},
      vertexAttribPointer: () => {},
      enableVertexAttribArray: () => {},
      activeTexture: () => {},
      bindTexture: () => {},
      texImage2D: () => {},
      texParameteri: () => {},
      deleteProgram: () => {},
      deleteShader: () => {},
      deleteBuffer: () => {}
    } as WebGLRenderingContext;
  }

  return canvasGetContext.call(this, type, ...args);
};

vi.stubGlobal('scrollTo', () => {});

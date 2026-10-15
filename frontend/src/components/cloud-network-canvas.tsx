import { useEffect, useRef } from "react";

type NetworkNode = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  phase: number;
  cloud: boolean;
};

type Ripple = { x: number; y: number; age: number };

const nodeSpacing = 24000;
const maxNodes = 70;

export function CloudNetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const context = canvas.getContext("2d")!;
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -1000, y: -1000 };
    const ripples: Ripple[] = [];
    let nodes: NetworkNode[] = [];
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let deviceScale = 1;

    function resize() {
      deviceScale = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * deviceScale;
      canvas.height = height * deviceScale;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      const count = Math.min(maxNodes, Math.max(22, Math.round((width * height) / nodeSpacing)));
      nodes = Array.from({ length: count }, (_, index) => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        return { x, y, homeX: x, homeY: y, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2, cloud: index % 9 === 0 };
      });
      render(0, true);
    }

    function render(time: number, staticFrame = false) {
      context.clearRect(0, 0, width, height);
      const blobs = [
        [width * 0.12, height * 0.12, 310, "rgba(234,179,8,.055)"],
        [width * 0.86, height * 0.28, 360, "rgba(56,189,248,.045)"],
        [width * 0.62, height * 0.92, 420, "rgba(234,179,8,.04)"],
      ] as const;
      for (const [x, y, radius, color] of blobs) {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }

      if (!staticFrame) {
        nodes.forEach((node) => {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < 150) {
            const force = (1 - distance / 150) * 0.34;
            node.vx += (dx / distance) * force;
            node.vy += (dy / distance) * force;
          }
          node.vx += (node.homeX - node.x) * 0.0025;
          node.vy += (node.homeY - node.y) * 0.0025;
          node.vx *= 0.92;
          node.vy *= 0.92;
          node.x += node.vx;
          node.y += node.vy + Math.sin(time * 0.00035 + node.phase) * 0.08;
          for (const ripple of ripples) {
            const rippleDistance = Math.hypot(node.x - ripple.x, node.y - ripple.y) || 1;
            const ring = ripple.age * 220;
            if (Math.abs(rippleDistance - ring) < 35) {
              node.vx += ((node.x - ripple.x) / rippleDistance) * 0.45;
              node.vy += ((node.y - ripple.y) / rippleDistance) * 0.45;
            }
          }
        });
      }

      const links: Array<[NetworkNode, NetworkNode]> = [];
      nodes.forEach((node, index) => {
        nodes.slice(index + 1).forEach((other) => {
          const distance = Math.hypot(node.x - other.x, node.y - other.y);
          if (distance < 150) links.push([node, other]);
        });
      });
      context.lineWidth = 1;
      links.forEach(([from, to], index) => {
        const nearPointer = Math.min(Math.hypot(from.x - pointer.x, from.y - pointer.y), Math.hypot(to.x - pointer.x, to.y - pointer.y)) < 130;
        context.strokeStyle = nearPointer ? "rgba(234,179,8,.3)" : "rgba(180,180,190,.09)";
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
        if (!staticFrame && index % 4 === 0) {
          const progress = ((time * 0.00008 + index * 0.13) % 1);
          const packetX = from.x + (to.x - from.x) * progress;
          const packetY = from.y + (to.y - from.y) * progress;
          context.strokeStyle = "rgba(234,179,8,.7)";
          context.beginPath();
          context.moveTo(packetX, packetY);
          context.lineTo(packetX - (to.x - from.x) * 0.06, packetY - (to.y - from.y) * 0.06);
          context.stroke();
        }
      });

      nodes.forEach((node) => {
        if (node.cloud) {
          context.fillStyle = "rgba(234,179,8,.75)";
          context.font = "13px sans-serif";
          context.fillText("☁", node.x - 7, node.y + 5);
        } else {
          context.fillStyle = "rgba(180,180,190,.55)";
          context.shadowBlur = 8;
          context.shadowColor = "rgba(234,179,8,.35)";
          context.beginPath();
          context.arc(node.x, node.y, 2, 0, Math.PI * 2);
          context.fill();
          context.shadowBlur = 0;
        }
      });

      if (pointer.x > -500) {
        const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 180);
        glow.addColorStop(0, "rgba(234,179,8,.1)");
        glow.addColorStop(1, "rgba(234,179,8,0)");
        context.fillStyle = glow;
        context.fillRect(pointer.x - 180, pointer.y - 180, 360, 360);
      }
      ripples.forEach((ripple) => {
        const radius = ripple.age * 220;
        context.strokeStyle = `rgba(234,179,8,${Math.max(0, 0.35 - ripple.age * 0.12)})`;
        context.beginPath();
        context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        context.stroke();
      });
    }

    function tick(time: number) {
      ripples.forEach((ripple) => { ripple.age += 0.016; });
      while (ripples.length && ripples[0].age > 3) ripples.shift();
      render(time);
      animationFrame = window.requestAnimationFrame(tick);
    }

    function move(event: PointerEvent) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    function click(event: MouseEvent) {
      if (!reducedMotion) ripples.push({ x: event.clientX, y: event.clientY, age: 0 });
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    window.addEventListener("click", click);
    if (!reducedMotion) animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", click);
    };
  }, []);

  return <canvas ref={canvasRef} className="cloud-network-canvas" aria-hidden="true" />;
}
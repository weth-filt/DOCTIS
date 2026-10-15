import React, { useEffect, useRef, useState } from "react";
import { FaHeartbeat, FaShieldAlt, FaMagic } from "react-icons/fa";

/**
 * DOCTIS 3D Visual Experience
 * Mathematical 3D isometric rendering with satin lighting, dual orbital rings,
 * mouse tilt perspective, floating cycle (7s), and fallback for reduced-motion.
 */
export default function Auth3DVisual() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animFrameRef = useRef(null);

  useEffect(() => {
    // Check reduced motion preference
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setUseFallback(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setUseFallback(true);
      return;
    }

    // Set dimensions with device pixel ratio for crisp rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 300;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let startTime = performance.now();
    let isVisible = true;

    // IntersectionObserver to pause animation when not visible
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    if (containerRef.current) observer.observe(containerRef.current);

    // Mouse movement handler for interactive tilt
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      mouseRef.current.targetX = Math.max(-1, Math.min(1, x)) * 0.35; // max ~20deg
      mouseRef.current.targetY = Math.max(-1, Math.min(1, y)) * 0.35;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    // 3D Geometric Nodes for Satin Health Prism/Heart
    // 3D coordinates (x, y, z)
    const heartNodes = [
      { x: 0, y: -45, z: 0 },       // 0: Top cleft
      { x: -38, y: -65, z: 20 },    // 1: Left top lobe front
      { x: -38, y: -65, z: -20 },   // 2: Left top lobe back
      { x: 38, y: -65, z: 20 },     // 3: Right top lobe front
      { x: 38, y: -65, z: -20 },    // 4: Right top lobe back
      { x: -55, y: -20, z: 25 },    // 5: Left flank front
      { x: -55, y: -20, z: -25 },   // 6: Left flank back
      { x: 55, y: -20, z: 25 },     // 7: Right flank front
      { x: 55, y: -20, z: -25 },    // 8: Right flank back
      { x: 0, y: 65, z: 0 },        // 9: Bottom tip
      { x: 0, y: -10, z: 42 },      // 10: Center crest front
      { x: 0, y: -10, z: -42 },     // 11: Center crest back
    ];

    // Polygonal facets (indices into heartNodes)
    const facets = [
      // Front faces
      [0, 1, 10], [1, 5, 10], [5, 9, 10],
      [0, 10, 3], [3, 10, 7], [7, 10, 9],
      // Back faces
      [0, 11, 2], [2, 11, 6], [6, 11, 9],
      [0, 4, 11], [4, 8, 11], [8, 9, 11],
      // Bridging outer facets
      [1, 2, 0], [3, 0, 4],
      [1, 6, 2], [1, 5, 6],
      [3, 4, 8], [3, 8, 7],
      [5, 6, 9], [7, 9, 8],
    ];

    // Colors: Satin teal tones with subtle ivory and coral accents
    const palette = {
      baseTeal: [8, 127, 140],      // #087F8C
      lightTeal: [53, 196, 216],    // #35C4D8
      ivory: [240, 248, 250],       // #F0F8FA
      coral: [238, 128, 108],       // #EE806C
    };

    // Render loop
    const render = (time) => {
      if (!isVisible) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, size, size);

      const elapsed = (time - startTime) / 1000;
      // Smooth interpolation for mouse tilt
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // 6-8s continuous smooth rotation
      const rotY = elapsed * (Math.PI * 2 / 7.5) + mouseRef.current.x;
      const rotX = Math.sin(elapsed * 0.9) * 0.12 - mouseRef.current.y;
      const floatY = Math.sin(elapsed * 1.2) * 9; // 9px gentle vertical float

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const centerX = size / 2;
      const centerY = size / 2 + floatY;

      // Project 3D nodes
      const projectedNodes = heartNodes.map((node) => {
        // Y-axis rotation
        let x1 = node.x * cosY + node.z * sinY;
        let y1 = node.y;
        let z1 = -node.x * sinY + node.z * cosY;

        // X-axis rotation
        let x2 = x1;
        let y2 = y1 * cosX - z1 * sinX;
        let z2 = y1 * sinX + z1 * cosX;

        // Isometric perspective projection
        const fov = 420;
        const scale = fov / (fov + z2);
        return {
          px: centerX + x2 * scale,
          py: centerY + y2 * scale,
          pz: z2,
          scale,
        };
      });

      // Ambient radial glow behind heart
      const glowGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 120);
      glowGrad.addColorStop(0, "rgba(53, 196, 216, 0.32)");
      glowGrad.addColorStop(0.6, "rgba(8, 127, 140, 0.12)");
      glowGrad.addColorStop(1, "rgba(8, 127, 140, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
      ctx.fill();

      // Draw Back Orbital Ring
      drawOrbitalRing(ctx, centerX, centerY, elapsed, -1);

      // Sort facets by average Z depth (Painter's algorithm)
      const sortedFacets = facets.map((faceIndices) => {
        const p0 = projectedNodes[faceIndices[0]];
        const p1 = projectedNodes[faceIndices[1]];
        const p2 = projectedNodes[faceIndices[2]];
        const avgZ = (p0.pz + p1.pz + p2.pz) / 3;

        // Compute 2D surface normal for backface culling & lighting
        const vx1 = p1.px - p0.px;
        const vy1 = p1.py - p0.py;
        const vx2 = p2.px - p0.px;
        const vy2 = p2.py - p0.py;
        const cross = vx1 * vy2 - vy1 * vx2;

        return {
          indices: faceIndices,
          avgZ,
          cross,
          p0, p1, p2
        };
      }).filter((f) => f.cross < 0); // Back-face culling for solid prism

      sortedFacets.sort((a, b) => a.avgZ - b.avgZ);

      // Light vector: from top-left front
      const lightX = -0.55;
      const lightY = -0.65;
      const lightZ = 0.52;

      // Render 3D facets with satin lighting
      sortedFacets.forEach((facet) => {
        const i0 = facet.indices[0];
        const i1 = facet.indices[1];
        const i2 = facet.indices[2];

        // 3D surface normal
        const n0 = heartNodes[i0];
        const n1 = heartNodes[i1];
        const n2 = heartNodes[i2];

        const ax = n1.x - n0.x, ay = n1.y - n0.y, az = n1.z - n0.z;
        const bx = n2.x - n0.x, by = n2.y - n0.y, bz = n2.z - n0.z;

        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;

        // Rotate normal to world space
        let rx1 = nx * cosY + nz * sinY;
        let ry1 = ny;
        let rz1 = -nx * sinY + nz * cosY;

        let rx2 = rx1;
        let ry2 = ry1 * cosX - rz1 * sinX;
        let rz2 = ry1 * sinX + rz1 * cosX;

        // Diffuse Lambertian intensity
        const dot = Math.max(0, rx2 * lightX + ry2 * lightY + rz2 * lightZ);
        // Specular highlight for satin sheen
        const spec = Math.pow(Math.max(0, rz2 * 0.8 + dot * 0.2), 6) * 0.45;

        // Color blending (Teal base, Ivory highlight, Coral accent on top edges)
        const isAccent = (i0 === 10 || i1 === 10 || i2 === 10) && (dot > 0.4);
        let r, g, b;
        if (isAccent) {
          // Coral satin shimmer
          r = Math.min(255, Math.floor(palette.coral[0] * 0.8 + dot * 80 + spec * 140));
          g = Math.min(255, Math.floor(palette.coral[1] * 0.8 + dot * 60 + spec * 140));
          b = Math.min(255, Math.floor(palette.coral[2] * 0.8 + dot * 60 + spec * 140));
        } else {
          // Primary Teal satin
          const baseR = palette.baseTeal[0] + (palette.lightTeal[0] - palette.baseTeal[0]) * dot;
          const baseG = palette.baseTeal[1] + (palette.lightTeal[1] - palette.baseTeal[1]) * dot;
          const baseB = palette.baseTeal[2] + (palette.lightTeal[2] - palette.baseTeal[2]) * dot;

          r = Math.min(255, Math.floor(baseR + spec * 190));
          g = Math.min(255, Math.floor(baseG + spec * 190));
          b = Math.min(255, Math.floor(baseB + spec * 190));
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + spec * 0.4})`;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(facet.p0.px, facet.p0.py);
        ctx.lineTo(facet.p1.px, facet.p1.py);
        ctx.lineTo(facet.p2.px, facet.p2.py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      // Draw Front Orbital Ring with glowing bead
      drawOrbitalRing(ctx, centerX, centerY, elapsed, 1);

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (observer) observer.disconnect();
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  // Helper for drawing 3D orbital rings around the prism
  const drawOrbitalRing = (ctx, cx, cy, time, depthSign) => {
    ctx.save();
    const ringRadiusX = 115;
    const ringRadiusY = 38;
    const tiltAngle = -0.45; // angle of inclination

    ctx.translate(cx, cy);
    ctx.rotate(tiltAngle);

    // Only draw arc corresponding to front or back based on depthSign
    const startAngle = depthSign > 0 ? 0 : Math.PI;
    const endAngle = depthSign > 0 ? Math.PI : Math.PI * 2;

    ctx.beginPath();
    ctx.ellipse(0, 0, ringRadiusX, ringRadiusY, 0, startAngle, endAngle);
    ctx.lineWidth = depthSign > 0 ? 2.5 : 1.5;
    ctx.strokeStyle = depthSign > 0 ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.2)";
    ctx.stroke();

    // Satellite glowing bead orbiting along the ring
    const beadPhase = (time * 0.9) % (Math.PI * 2);
    const beadInCurrentHalf = depthSign > 0
      ? beadPhase >= 0 && beadPhase <= Math.PI
      : beadPhase > Math.PI && beadPhase <= Math.PI * 2;

    if (beadInCurrentHalf) {
      const bx = Math.cos(beadPhase) * ringRadiusX;
      const by = Math.sin(beadPhase) * ringRadiusY;

      // Bead glow
      const beadGlow = ctx.createRadialGradient(bx, by, 1, bx, by, 12);
      beadGlow.addColorStop(0, "rgba(238, 128, 108, 0.95)"); // coral highlight bead
      beadGlow.addColorStop(0.5, "rgba(238, 128, 108, 0.4)");
      beadGlow.addColorStop(1, "rgba(238, 128, 108, 0)");
      ctx.fillStyle = beadGlow;
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fill();

      // Bead core
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  return (
    <div className="auth-3d-visual-container" ref={containerRef}>
      <div className="doctis-3d-stage">
        {!useFallback ? (
          <canvas
            ref={canvasRef}
            className="doctis-3d-canvas"
            aria-label="Minh họa 3D khối y tế DOCTIS tương tác"
          />
        ) : (
          <div className="doctis-3d-fallback" aria-hidden="true">
            <FaHeartbeat />
          </div>
        )}
      </div>

      <div className="auth-brand-highlights">
        <h2 className="auth-brand-headline">
          Chăm sóc sức khỏe thông minh & đồng hành chuẩn y khoa
        </h2>
        <p className="auth-brand-desc">
          Theo dõi các chỉ số sinh hiệu thời gian thực, cá nhân hóa kế hoạch chăm sóc và kết nối trực tiếp với bác sĩ chuyên khoa.
        </p>
        <div className="auth-trust-pills">
          <div className="auth-trust-pill">
            <FaShieldAlt /> Bảo mật chuẩn y tế
          </div>
          <div className="auth-trust-pill">
            <FaHeartbeat /> Theo dõi chỉ số 24/7
          </div>
          <div className="auth-trust-pill">
            <FaMagic /> Hỗ trợ phân tích AI
          </div>
        </div>
      </div>
    </div>
  );
}

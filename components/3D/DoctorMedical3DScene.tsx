import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface DoctorMedical3DSceneProps {
  className?: string;
  interactive?: boolean;
}

export const DoctorMedical3DScene: React.FC<DoctorMedical3DSceneProps> = ({
  className = '',
  interactive = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL support safely
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setIsSupported(false);
        return;
      }
    } catch {
      setIsSupported(false);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isDark = document.documentElement.classList.contains('dark');

    // ── Three.js Scene, Camera, Renderer ──
    const scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 16);

    const isMobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance'
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.2 : 0.95;
    container.appendChild(renderer.domElement);

    // ── Theme Palette Definition ──
    const getPalette = (dark: boolean) => ({
      nodePrimary: new THREE.Color(dark ? '#00A8FF' : '#126BFF'),
      nodeSecondary: new THREE.Color(dark ? '#7047FF' : '#3B82FF'),
      nodeAccent: new THREE.Color(dark ? '#10B981' : '#059669'),
      lineColor: new THREE.Color(dark ? '#00A8FF' : '#126BFF'),
      crystalColor: new THREE.Color(dark ? '#7047FF' : '#2563EB'),
      crystalEmissive: new THREE.Color(dark ? '#00A8FF' : '#38BDF8'),
      ambientColor: new THREE.Color(dark ? '#0B132B' : '#EDF4FF'),
      light1Color: new THREE.Color(dark ? '#00A8FF' : '#126BFF'),
      light2Color: new THREE.Color(dark ? '#7047FF' : '#818CF8'),
      ambientIntensity: dark ? 0.7 : 1.2,
      pointLightIntensity: dark ? 3.2 : 2.0,
      lineOpacity: dark ? 0.22 : 0.12,
      particleOpacity: dark ? 0.85 : 0.55
    });

    let palette = getPalette(isDark);

    // ── Lights ──
    const ambientLight = new THREE.AmbientLight(palette.ambientColor, palette.ambientIntensity);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(palette.light1Color, palette.pointLightIntensity, 40);
    pointLight1.position.set(6, 6, 8);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(palette.light2Color, palette.pointLightIntensity * 0.8, 35);
    pointLight2.position.set(-8, -6, 6);
    scene.add(pointLight2);

    // ── Root Animation Group ──
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // ── 1. Floating Interactive 3D Medical Constellation / Neural Nodes ──
    const particleCount = isMobile ? 70 : 160;
    const positions = new Float32Array(particleCount * 3);
    const particleVelocities: { x: number; y: number; z: number }[] = [];
    const colors = new Float32Array(particleCount * 3);

    const radius = isMobile ? 9 : 14;

    for (let i = 0; i < particleCount; i++) {
      // Distribute in a spherical/ellipsoid volume
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;

      const r = radius * (0.4 + Math.random() * 0.6);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = (r * Math.sin(phi) * Math.sin(theta)) * 0.75;
      const z = (r * Math.cos(phi)) * 0.5;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      particleVelocities.push({
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.012,
        z: (Math.random() - 0.5) * 0.008
      });

      // Colors: alternate between primary sapphire, cyan and purple
      const c = Math.random() > 0.6 ? palette.nodePrimary : (Math.random() > 0.5 ? palette.nodeSecondary : palette.nodeAccent);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circular soft glow texture for particles
    const createParticleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(200, 235, 255, 0.85)');
        gradient.addColorStop(0.6, 'rgba(50, 160, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      const texture = new THREE.CanvasTexture(canvas);
      return texture;
    };

    const particleMaterial = new THREE.PointsMaterial({
      size: isMobile ? 0.35 : 0.48,
      vertexColors: true,
      map: createParticleTexture(),
      transparent: true,
      opacity: palette.particleOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    rootGroup.add(particleSystem);

    // ── 2. Dynamic 3D Neural Connection Lines ──
    const maxConnections = isMobile ? 120 : 320;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: palette.lineColor,
      transparent: true,
      opacity: palette.lineOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    rootGroup.add(linesMesh);

    // ── 3. Central 3D Floating Precision Icosahedron (Healthcare AI Nucleus) ──
    const coreGeometry = new THREE.IcosahedronGeometry(isMobile ? 2.0 : 2.8, 1);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: palette.crystalColor,
      emissive: palette.crystalEmissive,
      emissiveIntensity: isDark ? 0.35 : 0.15,
      roughness: 0.15,
      metalness: 0.3,
      transmission: 0.75,
      opacity: isDark ? 0.65 : 0.45,
      transparent: true,
      wireframe: false
    });
    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMesh.position.set(isMobile ? 0 : 3.8, isMobile ? 0 : -0.5, -1);
    rootGroup.add(coreMesh);

    // Outer wireframe shell for technological precision
    const wireframeGeometry = new THREE.IcosahedronGeometry(isMobile ? 2.4 : 3.3, 1);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: palette.nodePrimary,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.35 : 0.18
    });
    const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframeMesh.position.copy(coreMesh.position);
    rootGroup.add(wireframeMesh);

    // ── 4. Floating Volumetric Medical Rings ──
    const ringGeometry = new THREE.TorusGeometry(isMobile ? 3.0 : 4.2, 0.04, 16, 80);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: palette.nodeSecondary,
      transparent: true,
      opacity: isDark ? 0.35 : 0.15
    });
    const ringMesh1 = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh1.position.copy(coreMesh.position);
    ringMesh1.rotation.x = Math.PI * 0.35;
    ringMesh1.rotation.y = Math.PI * 0.15;
    rootGroup.add(ringMesh1);

    const ringMesh2 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
    ringMesh2.position.copy(coreMesh.position);
    ringMesh2.scale.set(1.2, 1.2, 1.2);
    ringMesh2.rotation.x = -Math.PI * 0.25;
    ringMesh2.rotation.y = Math.PI * 0.45;
    rootGroup.add(ringMesh2);

    // ── Mouse & Touch Parallax Interaction ──
    const targetMouse = { x: 0, y: 0 };
    const currentMouse = { x: 0, y: 0 };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      targetMouse.x = (clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });

    // ── Resize Handler ──
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // ── Theme Mutation Observer for Instant Dark / Light Reactivity ──
    const updateThemeStyles = () => {
      const nowDark = document.documentElement.classList.contains('dark');
      if (nowDark === isDark) return;
      isDark = nowDark;
      palette = getPalette(isDark);

      ambientLight.color.copy(palette.ambientColor);
      ambientLight.intensity = palette.ambientIntensity;

      pointLight1.color.copy(palette.light1Color);
      pointLight1.intensity = palette.pointLightIntensity;

      pointLight2.color.copy(palette.light2Color);
      pointLight2.intensity = palette.pointLightIntensity * 0.8;

      lineMaterial.color.copy(palette.lineColor);
      lineMaterial.opacity = palette.lineOpacity;

      particleMaterial.opacity = palette.particleOpacity;

      coreMaterial.color.copy(palette.crystalColor);
      coreMaterial.emissive.copy(palette.crystalEmissive);
      coreMaterial.emissiveIntensity = isDark ? 0.35 : 0.15;
      coreMaterial.opacity = isDark ? 0.65 : 0.45;

      wireframeMaterial.color.copy(palette.nodePrimary);
      wireframeMaterial.opacity = isDark ? 0.35 : 0.18;

      ringMaterial.color.copy(palette.nodeSecondary);
      ringMaterial.opacity = isDark ? 0.35 : 0.15;

      renderer.toneMappingExposure = isDark ? 1.2 : 0.95;
    };

    const themeObserver = new MutationObserver(updateThemeStyles);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // ── Animation Loop ──
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (document.hidden) return; // Save GPU when backgrounded

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse easing
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      // Group smooth rotation & subtle float
      const speedFactor = prefersReducedMotion ? 0.2 : 1.0;

      rootGroup.rotation.y = elapsedTime * 0.04 * speedFactor + currentMouse.x * 0.35;
      rootGroup.rotation.x = Math.sin(elapsedTime * 0.03 * speedFactor) * 0.1 - currentMouse.y * 0.25;

      // Rotate central nucleus
      coreMesh.rotation.x += 0.006 * speedFactor;
      coreMesh.rotation.y += 0.009 * speedFactor;
      wireframeMesh.rotation.x -= 0.004 * speedFactor;
      wireframeMesh.rotation.y -= 0.007 * speedFactor;

      ringMesh1.rotation.z += 0.008 * speedFactor;
      ringMesh2.rotation.z -= 0.006 * speedFactor;

      // Move point light 1 slightly toward mouse cursor for dynamic 3D specular sheen
      pointLight1.position.x = 6 + currentMouse.x * 4;
      pointLight1.position.y = 6 + currentMouse.y * 4;

      // Update particles & compute live connection lines
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      let lineVertexIndex = 0;
      const connectionDist = isMobile ? 3.2 : 3.8;

      for (let i = 0; i < particleCount; i++) {
        // Apply slight float drift
        posArray[i * 3] += particleVelocities[i].x * speedFactor;
        posArray[i * 3 + 1] += particleVelocities[i].y * speedFactor;
        posArray[i * 3 + 2] += particleVelocities[i].z * speedFactor;

        // Bounce within spherical boundary
        const currentDist = Math.sqrt(
          posArray[i * 3] * posArray[i * 3] +
          posArray[i * 3 + 1] * posArray[i * 3 + 1] +
          posArray[i * 3 + 2] * posArray[i * 3 + 2]
        );

        if (currentDist > radius) {
          particleVelocities[i].x *= -1;
          particleVelocities[i].y *= -1;
          particleVelocities[i].z *= -1;
        }

        // Connect nearby nodes with dynamic lines
        for (let j = i + 1; j < particleCount; j++) {
          const dx = posArray[i * 3] - posArray[j * 3];
          const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
          const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist && lineVertexIndex < maxConnections * 6) {
            linePositions[lineVertexIndex++] = posArray[i * 3];
            linePositions[lineVertexIndex++] = posArray[i * 3 + 1];
            linePositions[lineVertexIndex++] = posArray[i * 3 + 2];

            linePositions[lineVertexIndex++] = posArray[j * 3];
            linePositions[lineVertexIndex++] = posArray[j * 3 + 1];
            linePositions[lineVertexIndex++] = posArray[j * 3 + 2];
          }
        }
      }

      posAttr.needsUpdate = true;

      // Clear remaining line slots
      while (lineVertexIndex < maxConnections * 6) {
        linePositions[lineVertexIndex++] = 0;
      }
      (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      themeObserver.disconnect();

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      particleGeometry.dispose();
      particleMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      wireframeGeometry.dispose();
      wireframeMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
    };
  }, [interactive]);

  if (!isSupported) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
};

export default DoctorMedical3DScene;

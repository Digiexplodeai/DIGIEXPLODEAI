import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface HeroPerformanceSceneProps {
  className?: string;
}

export const HeroPerformanceScene: React.FC<HeroPerformanceSceneProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect WebGL support
    try {
      const canvasTest = document.createElement('canvas');
      const gl = canvasTest.getContext('webgl') || canvasTest.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Determine initial theme
    let isDark = document.documentElement.classList.contains('dark');

    // ── Three.js Scene Setup ──
    const scene = new THREE.Scene();
    
    // Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    // Renderer
    const isMobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── Theme Color Palette Definitions ──
    const themeColors = {
      dark: {
        primary: new THREE.Color('#6C4CFF'),     // Electric Violet
        secondary: new THREE.Color('#8A5CFF'),   // Ultraviolet
        tertiary: new THREE.Color('#2563FF'),    // Cobalt Blue
        accentCoral: new THREE.Color('#FF5A5F'), // Hot Coral
        accentLime: new THREE.Color('#B8F36B'),  // Acid Lime
        ambient: new THREE.Color('#080A12'),     // Deep Ink
        specular: new THREE.Color('#FFFFFF'),
        fog: new THREE.Color('#080A12'),
        pointLightIntensity: 3.6,
        ambientIntensity: 0.9,
      },
      light: {
        primary: new THREE.Color('#8A5CFF'),     // Ultraviolet
        secondary: new THREE.Color('#C4B5FD'),   // Soft Lavender
        tertiary: new THREE.Color('#3B82FF'),    // Electric Blue
        accentCoral: new THREE.Color('#FF7A45'), // Warm Orange / Soft Coral
        accentLime: new THREE.Color('#B8F36B'),  // Acid Lime
        ambient: new THREE.Color('#FAF9F6'),     // Warm Ivory
        specular: new THREE.Color('#6C4CFF'),
        fog: new THREE.Color('#FAF9F6'),
        pointLightIntensity: 2.8,
        ambientIntensity: 1.4,
      }
    };

    let currentTheme = isDark ? themeColors.dark : themeColors.light;

    // ── Lighting Setup ──
    const ambientLight = new THREE.AmbientLight(
      currentTheme.ambient,
      currentTheme.ambientIntensity
    );
    scene.add(ambientLight);

    // Key Point Light (Electric Violet - positioned right/top)
    const keyLight = new THREE.PointLight(currentTheme.primary, currentTheme.pointLightIntensity, 35);
    keyLight.position.set(8, 6, 8);
    scene.add(keyLight);

    // Fill Light (Cyan / Blue - positioned bottom left)
    const fillLight = new THREE.PointLight(currentTheme.tertiary, currentTheme.pointLightIntensity * 0.75, 30);
    fillLight.position.set(-6, -5, 6);
    scene.add(fillLight);

    // Rim Accent Light (Coral Orange - creates rim highlights)
    const rimLight = new THREE.PointLight(currentTheme.accentCoral, currentTheme.pointLightIntensity * 0.6, 25);
    rimLight.position.set(4, -6, -4);
    scene.add(rimLight);

    // ── 3D Geometry: The Living Performance Sculpture ──
    const mainGroup = new THREE.Group();
    // Offset toward the right zone where the dashboard sits
    mainGroup.position.set(isMobile ? 0 : 3.2, isMobile ? 0.5 : -0.2, 0);
    scene.add(mainGroup);

    // 1. Primary Flowing Parametric Ribbon
    const curvePoints: THREE.Vector3[] = [];
    const numPoints = 80;
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * Math.PI * 2;
      const x = Math.sin(t) * 4.2 + Math.sin(t * 2) * 1.2;
      const y = Math.cos(t) * 3.0 + Math.sin(t * 3) * 0.8;
      const z = Math.sin(t * 3) * 2.2 + Math.cos(t * 2) * 0.6;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const spline = new THREE.CatmullRomCurve3(curvePoints, true);
    
    // Tube geometry for main ribbon
    const tubeSegments = isMobile ? 64 : 120;
    const radialSegments = isMobile ? 8 : 16;
    const tubeGeo = new THREE.TubeGeometry(spline, tubeSegments, 0.28, radialSegments, true);
    
    // Save initial vertex positions for organic fluid deformation
    const posAttr = tubeGeo.attributes.position;
    const basePositions = posAttr.array.slice();

    // Material with custom soft sheen
    const ribbonMaterial = new THREE.MeshPhysicalMaterial({
      color: currentTheme.primary,
      emissive: currentTheme.primary,
      emissiveIntensity: isDark ? 0.25 : 0.08,
      roughness: 0.2,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.35, // Translucent glass effect
      opacity: 0.88,
      transparent: true,
      wireframe: false,
    });
    const mainRibbonMesh = new THREE.Mesh(tubeGeo, ribbonMaterial);
    mainGroup.add(mainRibbonMesh);

    // 2. Secondary Concentric Luminous Ring
    const innerPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * Math.PI * 2;
      const x = Math.cos(t) * 3.2 + Math.cos(t * 3) * 0.6;
      const y = Math.sin(t) * 2.5 + Math.sin(t * 2) * 0.5;
      const z = Math.cos(t * 2) * 1.6;
      innerPoints.push(new THREE.Vector3(x, y, z));
    }
    const innerSpline = new THREE.CatmullRomCurve3(innerPoints, true);
    const innerTubeGeo = new THREE.TubeGeometry(innerSpline, isMobile ? 48 : 80, 0.12, 8, true);
    const innerMaterial = new THREE.MeshPhysicalMaterial({
      color: currentTheme.accentCoral,
      emissive: currentTheme.accentCoral,
      emissiveIntensity: isDark ? 0.4 : 0.15,
      roughness: 0.3,
      metalness: 0.2,
      transmission: 0.5,
      opacity: 0.75,
      transparent: true,
    });
    const innerRibbonMesh = new THREE.Mesh(innerTubeGeo, innerMaterial);
    mainGroup.add(innerRibbonMesh);

    // 3. Floating Data Nodes (Strategic Marketing Touchpoints)
    const nodeCount = isMobile ? 6 : 10;
    const nodeGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const nodes: { mesh: THREE.Mesh; tOffset: number; speed: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const isLimeNode = i % 3 === 0;
      const nodeMat = new THREE.MeshStandardMaterial({
        color: isLimeNode ? currentTheme.accentLime : currentTheme.primary,
        emissive: isLimeNode ? currentTheme.accentLime : currentTheme.primary,
        emissiveIntensity: isDark ? 0.8 : 0.4,
        roughness: 0.1,
        metalness: 0.4,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      mainGroup.add(nodeMesh);

      nodes.push({
        mesh: nodeMesh,
        tOffset: i / nodeCount,
        speed: 0.04 + (i % 3) * 0.015,
      });
    }

    // 4. Subtle Ambient Intelligence Micro-Particles
    const particleCount = isMobile ? 40 : 80;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 16;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      particleScales[i] = Math.random() * 0.8 + 0.2;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Particle texture point material
    const particleMaterial = new THREE.PointsMaterial({
      color: currentTheme.secondary,
      size: 0.15,
      transparent: true,
      opacity: isDark ? 0.6 : 0.4,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMaterial);
    mainGroup.add(particleSystem);

    // ── Interaction & Motion State ──
    const targetRotation = { x: 0, y: 0 };
    const currentRotation = { x: 0, y: 0 };
    let scrollProgress = 0;
    let isVisibleOnScreen = true;
    let isTabActive = true;
    let animationFrameId: number;
    let clock = new THREE.Clock();

    // Mouse Parallax (Low strength, smooth damping)
    const handlePointerMove = (e: MouseEvent) => {
      if (isMobile) return;
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetRotation.y = normX * 0.25;
      targetRotation.x = -normY * 0.18;
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });

    // Scroll Integration (Camera drift and smooth dissolve)
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = container.clientHeight || 800;
      scrollProgress = Math.min(Math.max(scrollY / heroHeight, 0), 1.2);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Intersection Observer to pause rendering when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleOnScreen = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Visibility change handler (tab switch)
    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Dynamic Theme Synchronization ──
    const updateThemeColors = () => {
      const nextDark = document.documentElement.classList.contains('dark');
      if (nextDark === isDark) return;
      isDark = nextDark;
      const targetColors = isDark ? themeColors.dark : themeColors.light;

      // Smooth color transitions
      ambientLight.color.copy(targetColors.ambient);
      ambientLight.intensity = targetColors.ambientIntensity;
      
      keyLight.color.copy(targetColors.primary);
      keyLight.intensity = targetColors.pointLightIntensity;
      
      fillLight.color.copy(targetColors.tertiary);
      fillLight.intensity = targetColors.pointLightIntensity * 0.75;
      
      rimLight.color.copy(targetColors.accentCoral);
      rimLight.intensity = targetColors.pointLightIntensity * 0.6;

      ribbonMaterial.color.copy(targetColors.primary);
      ribbonMaterial.emissive.copy(targetColors.primary);
      ribbonMaterial.emissiveIntensity = isDark ? 0.25 : 0.08;

      innerMaterial.color.copy(targetColors.accentCoral);
      innerMaterial.emissive.copy(targetColors.accentCoral);
      innerMaterial.emissiveIntensity = isDark ? 0.4 : 0.15;

      particleMaterial.color.copy(targetColors.secondary);
      particleMaterial.opacity = isDark ? 0.6 : 0.4;

      nodes.forEach((n, idx) => {
        const isLime = idx % 3 === 0;
        const mat = n.mesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(isLime ? targetColors.accentLime : targetColors.primary);
        mat.emissive.copy(isLime ? targetColors.accentLime : targetColors.primary);
        mat.emissiveIntensity = isDark ? 0.8 : 0.4;
      });
    };

    // Watch for theme class changes on <html>
    const themeObserver = new MutationObserver(updateThemeColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // ── Resize Handler ──
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      
      const newIsMobile = newWidth < 768;
      mainGroup.position.set(newIsMobile ? 0 : 3.2, newIsMobile ? 0.5 : -0.2, 0);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Mark loaded
    setIsLoaded(true);

    // ── Animation Loop ──
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Only render if visible and tab is active
      if (!isVisibleOnScreen || !isTabActive) return;

      const elapsedTime = clock.getElapsedTime();
      const delta = Math.min(clock.getDelta(), 0.05);

      // Organic slow movement (freezes if reduced motion)
      const motionSpeed = prefersReducedMotion ? 0 : 0.4;

      // 1. Smooth Pointer Parallax Interpolation
      currentRotation.x += (targetRotation.x - currentRotation.x) * 0.04;
      currentRotation.y += (targetRotation.y - currentRotation.y) * 0.04;

      mainGroup.rotation.y = elapsedTime * 0.12 * motionSpeed + currentRotation.y;
      mainGroup.rotation.x = Math.sin(elapsedTime * 0.08 * motionSpeed) * 0.1 + currentRotation.x;
      mainGroup.rotation.z = Math.cos(elapsedTime * 0.06 * motionSpeed) * 0.08;

      // 2. Scroll-driven camera displacement & dissolve
      camera.position.y = -scrollProgress * 2.5;
      camera.position.z = 18 + scrollProgress * 4.0;
      mainGroup.position.y = (isMobile ? 0.5 : -0.2) + scrollProgress * 1.5;
      
      // Fade out opacity as user scrolls past hero
      const scrollOpacity = Math.max(1 - scrollProgress * 1.1, 0.15);
      ribbonMaterial.opacity = (isDark ? 0.88 : 0.75) * scrollOpacity;
      innerMaterial.opacity = 0.75 * scrollOpacity;
      particleMaterial.opacity = (isDark ? 0.6 : 0.4) * scrollOpacity;

      // 3. Fluid Mesh Vertex Wave Deformation
      if (!prefersReducedMotion) {
        const positions = tubeGeo.attributes.position.array as Float32Array;
        const vertexCount = positions.length / 3;
        const waveTime = elapsedTime * 1.2;

        for (let i = 0; i < vertexCount; i++) {
          const ix = i * 3;
          const bx = basePositions[ix];
          const by = basePositions[ix + 1];
          const bz = basePositions[ix + 2];

          const wave = Math.sin(bx * 0.8 + waveTime) * 0.06 + Math.cos(by * 0.8 + waveTime * 0.8) * 0.06;
          positions[ix] = bx + wave;
          positions[ix + 1] = by + wave;
          positions[ix + 2] = bz + wave;
        }
        tubeGeo.attributes.position.needsUpdate = true;
      }

      // 4. Update Data Node positions along the spline path
      nodes.forEach((node) => {
        const currentT = (elapsedTime * node.speed * motionSpeed + node.tOffset) % 1.0;
        const pos = spline.getPointAt(currentT);
        node.mesh.position.copy(pos);
      });

      // 5. Gentle Particle Swarm Drift
      particleSystem.rotation.y = -elapsedTime * 0.03 * motionSpeed;
      particleSystem.rotation.x = Math.sin(elapsedTime * 0.02 * motionSpeed) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup on Unmount ──
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      themeObserver.disconnect();
      observer.disconnect();

      // Dispose geometries & materials
      tubeGeo.dispose();
      innerTubeGeo.dispose();
      nodeGeo.dispose();
      particleGeo.dispose();
      ribbonMaterial.dispose();
      innerMaterial.dispose();
      particleMaterial.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-700 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* High Quality Graceful Fallback if WebGL fails */}
      {!webglSupported && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 70% 40%, rgba(85, 70, 245, 0.18) 0%, rgba(255, 120, 79, 0.08) 40%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
};

export default HeroPerformanceScene;

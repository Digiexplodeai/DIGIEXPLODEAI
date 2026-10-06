import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const ContactEchoScene: React.FC<{ className?: string }> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL & Reduced Motion
    try {
      const canvasTest = document.createElement('canvas');
      if (!canvasTest.getContext('webgl')) return;
    } catch {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isDark = document.documentElement.classList.contains('dark');

    const scene = new THREE.Scene();
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.appendChild(renderer.domElement);

    // Torus knot lightweight echoing sculpture
    const geometry = new THREE.TorusKnotGeometry(2.4, 0.35, 80, 16, 2, 3);
    const material = new THREE.MeshPhysicalMaterial({
      color: isDark ? new THREE.Color('#6C4CFF') : new THREE.Color('#8A5CFF'),
      emissive: isDark ? new THREE.Color('#FF5A5F') : new THREE.Color('#B8F36B'),
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.3,
      transmission: 0.4,
      opacity: 0.65,
      transparent: true,
    });
    const knotMesh = new THREE.Mesh(geometry, material);
    scene.add(knotMesh);

    // Lights
    const light1 = new THREE.PointLight(0x6C4CFF, 3, 20);
    light1.position.set(4, 4, 4);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xFF5A5F, 2, 20);
    light2.position.set(-4, -4, 2);
    scene.add(light2);

    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.8);
    scene.add(ambientLight);

    let isVisible = true;
    let animationId: number;
    let clock = new THREE.Clock();

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(container);

    const themeObserver = new MutationObserver(() => {
      const nextDark = document.documentElement.classList.contains('dark');
      material.color.set(nextDark ? '#6C4CFF' : '#8A5CFF');
      material.emissive.set(nextDark ? '#FF5A5F' : '#B8F36B');
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    setIsLoaded(true);

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();
      const speed = prefersReducedMotion ? 0 : 0.3;

      knotMesh.rotation.x = elapsed * 0.15 * speed;
      knotMesh.rotation.y = elapsed * 0.2 * speed;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      themeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      aria-hidden="true"
    />
  );
};

export default ContactEchoScene;

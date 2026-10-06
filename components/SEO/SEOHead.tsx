import React, { useEffect } from 'react';

export interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  jsonLd?: object;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'DigiexplodeAI — Digital Dreams, Explosive Results | Website & Mobile App Agency',
  description = 'DigiexplodeAI is a premier digital agency building high-performance web applications, mobile apps, AI automation solutions, and explosive social media campaigns.',
  keywords = 'DigiexplodeAI, Web Development Agency, AI Solutions, Custom Web Apps, React Vite Agency, Mobile App Development, UI UX Design, Digital Marketing',
  canonicalUrl = 'https://digiexplode.ai',
  ogImage = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  jsonLd,
}) => {
  useEffect(() => {
    // 1. Update Title
    document.title = title;

    // Helper to update meta tag by name or property
    const updateMetaTag = (selector: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        if (selector.startsWith('meta[name=')) {
          const nameMatch = selector.match(/name="([^"]+)"/);
          if (nameMatch) element.setAttribute('name', nameMatch[1]);
        } else if (selector.startsWith('meta[property=')) {
          const propMatch = selector.match(/property="([^"]+)"/);
          if (propMatch) element.setAttribute('property', propMatch[1]);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    updateMetaTag('meta[name="description"]', description);
    updateMetaTag('meta[name="keywords"]', keywords);
    updateMetaTag('meta[name="title"]', title);

    // 3. OpenGraph Meta Tags
    updateMetaTag('meta[property="og:title"]', title);
    updateMetaTag('meta[property="og:description"]', description);
    updateMetaTag('meta[property="og:image"]', ogImage);
    updateMetaTag('meta[property="og:url"]', canonicalUrl);

    // 4. Twitter Card Meta Tags
    updateMetaTag('meta[property="twitter:title"]', title);
    updateMetaTag('meta[property="twitter:description"]', description);
    updateMetaTag('meta[property="twitter:image"]', ogImage);

    // 5. Canonical Link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // 6. JSON-LD Schema Script Injection
    if (jsonLd) {
      const scriptId = 'json-ld-schema-page';
      let existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, keywords, canonicalUrl, ogImage, jsonLd]);

  return null;
};

export default SEOHead;

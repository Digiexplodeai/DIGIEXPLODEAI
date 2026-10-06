import React from 'react';
import ContactForm from '../components/Sections/ContactForm';
import SEOHead from '../components/SEO/SEOHead';

const Contact: React.FC = () => {
  return (
    <div style={{ paddingTop: '72px' }}>
      <SEOHead
        title="Contact DigiexplodeAI — Book Free Tech & Growth Strategy Call"
        description="Get in touch with DigiexplodeAI web and mobile app experts. Request a custom quote, consultation, or instant project estimate."
        keywords="Contact DigiexplodeAI, Hire Web Developers, Mobile App Quote, Consultation"
        canonicalUrl="https://digiexplode.ai/contact"
      />
      <ContactForm />
    </div>
  );
};

export default Contact;


import React from 'react';
import { MessageCircle } from 'lucide-react';
import { siteConfig } from '../../config/site';

const WhatsAppCTA: React.FC = () => {
  return (
    <a
      href={siteConfig.whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle className="w-7 h-7" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 whitespace-nowrap font-semibold text-sm">
        Explode Your Business
      </span>
    </a>
  );
};

export default WhatsAppCTA;

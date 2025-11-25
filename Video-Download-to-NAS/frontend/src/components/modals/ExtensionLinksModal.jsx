import { X, Chrome, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ExtensionLinksModal({ isOpen, onClose }) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const links = [
    {
      name: 'Chrome Web Store',
      icon: Chrome,
      url: 'https://chromewebstore.google.com/detail/video-download-to-nas/fchehlladkkanoekpjffcfffpfbdaalj?hl=ko',
      color: 'from-green-500 to-green-600',
      description: 'Chrome, Edge, Brave, Opera'
    },
    {
      name: 'Microsoft Edge Add-ons',
      icon: Globe,
      url: 'https://microsoftedge.microsoft.com/addons/detail/video-download-to-nas/idefjkbcbhgokgenjingeleopmficace?hl=ko',
      color: 'from-blue-500 to-blue-600',
      description: 'Microsoft Edge'
    },
    {
      name: 'GitHub',
      icon: Globe,
      url: 'https://github.com/sruinz/Video-Download-to-NAS',
      color: 'from-gray-600 to-gray-700',
      description: 'Source Code & Manual Install'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-yt-light rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-yt-red to-red-700 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('extension.title')}
          </h2>
          <p className="text-white/90 text-sm">
            {t('extension.subtitle')}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className={`bg-gradient-to-r ${link.color} p-4 rounded-lg hover:shadow-lg transition-all transform hover:scale-[1.02]`}>
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-lg">
                    <link.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-1">
                      {link.name}
                    </h3>
                    <p className="text-white/80 text-sm">
                      {link.description}
                    </p>
                  </div>
                  <div className="text-white/60 group-hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-yt-dark p-4 text-center">
          <p className="text-gray-400 text-sm">
            {t('extension.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}

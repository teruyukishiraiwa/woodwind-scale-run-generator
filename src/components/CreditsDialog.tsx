import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import profileUrl from '../assets/credits/profile_teruyuki_shiraiwa.jpg';
import signatureUrl from '../assets/credits/signature_tshiraiwa.png';
import { t, type Language } from '../i18n';

const CREATOR_NAME = 'Teruyuki Shiraiwa';
const CREATOR_WEBSITE = 'https://teruyukishiraiwa.art/';

interface CreditsDialogProps {
  language: Language;
  open: boolean;
  onClose: () => void;
}

export function CreditsDialog({ language, open, onClose }: CreditsDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="credits-overlay" role="presentation" onClick={onClose}>
      <section
        className="credits-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credits-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="credits-glow" aria-hidden="true" />
        <div className="credits-header">
          <div>
            <p className="credits-eyebrow">{t(language, 'creditsEyebrow')}</p>
            <h2 id="credits-title">{t(language, 'credits')}</h2>
            <p className="credits-description">{t(language, 'creditsDescription')}</p>
          </div>
          <button className="credits-close" type="button" onClick={onClose} aria-label={t(language, 'closeCredits')}>
            <X size={17} />
          </button>
        </div>

        <div className="credits-body">
          <div className="credits-copy">
            <p className="credits-role">{t(language, 'createdBy')}</p>
            <p className="credits-name">{CREATOR_NAME}</p>
            <a className="credits-link" href={CREATOR_WEBSITE} target="_blank" rel="noreferrer">
              <ExternalLink size={13} aria-hidden="true" />
              {t(language, 'officialWebsite')}
            </a>
            <img className="credits-signature" src={signatureUrl} alt={`Signature of ${CREATOR_NAME}`} />
          </div>
          <img className="credits-profile" src={profileUrl} alt={`Profile portrait of ${CREATOR_NAME}`} />
        </div>
      </section>
    </div>
  );
}

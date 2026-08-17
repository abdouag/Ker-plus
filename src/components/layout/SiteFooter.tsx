import Link from 'next/link';
import { getCompanyContact } from '@/lib/settings';
import { formatPhone, toWhatsAppDigits } from '@/lib/phone';

export async function SiteFooter() {
  const company = await getCompanyContact();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-sand-200 bg-white">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold text-forest-600">
            Kerplus<span className="text-ember-400">.sn</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Estimation indicative du coût de construction au Sénégal et rapports techniques
            détaillés préparés par notre équipe.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold text-forest-700">Informations</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/politique-de-confidentialite" className="hover:text-forest-600">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/conditions-generales" className="hover:text-forest-600">
                Conditions générales
              </Link>
            </li>
            <li>
              <Link href="/conditions-rapport" className="hover:text-forest-600">
                Conditions du rapport Kerplus
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" className="hover:text-forest-600">
                Mentions légales
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-forest-700">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {company.email ? (
              <li>
                <a href={`mailto:${company.email}`} className="hover:text-forest-600">
                  {company.email}
                </a>
              </li>
            ) : null}
            {company.phone ? (
              <li>
                <a href={`tel:${company.phone}`} className="hover:text-forest-600">
                  {formatPhone(company.phone)}
                </a>
              </li>
            ) : null}
            {company.whatsapp ? (
              <li>
                <a
                  href={`https://wa.me/${toWhatsAppDigits(company.whatsapp)}`}
                  className="hover:text-forest-600"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </li>
            ) : null}
            {company.address ? <li className="whitespace-pre-line">{company.address}</li> : null}
          </ul>
        </div>
      </div>

      <div className="border-t border-sand-200 px-4 py-4 text-center text-xs text-ink-muted sm:px-6">
        © {year} {company.name}. Les estimations affichées sont indicatives et ne constituent ni un
        devis contractuel ni une étude technique.
      </div>
    </footer>
  );
}

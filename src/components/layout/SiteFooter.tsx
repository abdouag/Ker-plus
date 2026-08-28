import Link from 'next/link';
import { getCompanyContact } from '@/lib/settings';
import { formatPhone, toWhatsAppDigits } from '@/lib/phone';

export async function SiteFooter() {
  const company = await getCompanyContact();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-forest-700 text-forest-100">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-white">
            Kerplus<span className="text-ember-400">.sn</span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-forest-100/80">
            Estimation indicative du coût de construction au Sénégal et rapports techniques
            détaillés préparés par notre équipe.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Le service</h2>
          <ul className="mt-3 space-y-2 text-sm text-forest-100/90">
            <li>
              <Link href="/#estimateur" className="transition-colors hover:text-ember-200">
                Estimateur de coût
              </Link>
            </li>
            <li>
              <Link href="/services" className="transition-colors hover:text-ember-200">
                Nos services
              </Link>
            </li>
            <li>
              <Link href="/#methode" className="transition-colors hover:text-ember-200">
                Comment ça marche
              </Link>
            </li>
            <li>
              <Link href="/#realisations" className="transition-colors hover:text-ember-200">
                Nos réalisations
              </Link>
            </li>
            <li>
              <Link href="/#rapport" className="transition-colors hover:text-ember-200">
                Rapport détaillé
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Informations</h2>
          <ul className="mt-3 space-y-2 text-sm text-forest-100/90">
            <li>
              <Link href="/politique-de-confidentialite" className="transition-colors hover:text-ember-200">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/conditions-generales" className="transition-colors hover:text-ember-200">
                Conditions générales
              </Link>
            </li>
            <li>
              <Link href="/conditions-rapport" className="transition-colors hover:text-ember-200">
                Conditions du rapport Kerplus
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" className="transition-colors hover:text-ember-200">
                Mentions légales
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm text-forest-100/90">
            {company.email ? (
              <li>
                <a href={`mailto:${company.email}`} className="transition-colors hover:text-ember-200">
                  {company.email}
                </a>
              </li>
            ) : null}
            {company.phone ? (
              <li>
                <a href={`tel:${company.phone}`} className="transition-colors hover:text-ember-200">
                  {formatPhone(company.phone)}
                </a>
              </li>
            ) : null}
            {company.whatsapp ? (
              <li>
                <a
                  href={`https://wa.me/${toWhatsAppDigits(company.whatsapp)}`}
                  className="transition-colors hover:text-ember-200"
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

      <div className="border-t border-forest-600 px-4 py-4 text-center text-xs text-forest-100/70 sm:px-6">
        © {year} {company.name}. Les estimations affichées sont indicatives et ne constituent ni un
        devis contractuel ni une étude technique.
      </div>
    </footer>
  );
}

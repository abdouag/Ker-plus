import type { Metadata } from 'next';
import { LegalPage, ToComplete } from '@/components/layout/LegalPage';
import { getCompanyContact } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site Kerplus.sn et de l’Estimateur Kerplus.',
  alternates: { canonical: '/mentions-legales' },
};

export const dynamic = 'force-dynamic';

export default async function MentionsLegalesPage() {
  const company = await getCompanyContact();

  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur du site</h2>
      <p>Le site {company.name} et l’application « Estimateur Kerplus » sont édités par Kerplus.</p>
      <ToComplete>
        Informations légales à compléter dans l’administration (Paramètres → Coordonnées Kerplus) :
        forme juridique, capital social, numéro RCCM, NINEA, siège social, directeur de la
        publication et hébergeur.
      </ToComplete>
      <p className="whitespace-pre-line">{company.legalInfo}</p>

      <h2>Contact</h2>
      <ul>
        {company.email ? <li>Email : {company.email}</li> : null}
        {company.phone ? <li>Téléphone : {company.phone}</li> : null}
        {company.address ? <li>Adresse : {company.address}</li> : null}
      </ul>
      {!company.email && !company.phone && !company.address ? (
        <ToComplete>Coordonnées de contact à renseigner dans l’administration.</ToComplete>
      ) : null}

      <h2>Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus du site (textes, méthodologie d’estimation, rapports, éléments
        graphiques) est protégé. Toute reproduction ou réutilisation, totale ou partielle, sans
        autorisation écrite préalable est interdite.
      </p>

      <h2>Nature des informations publiées</h2>
      <p>
        Les estimations produites par l’Estimateur Kerplus sont indicatives. Elles ne constituent ni
        un devis contractuel, ni une étude technique, ni un engagement de prix. Le rapport technique
        détaillé est un document d’aide à la décision, qui doit être validé par un professionnel
        avant toute décision d’investissement ou de lancement de chantier.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Kerplus met tout en œuvre pour maintenir des données de coûts à jour, mais ne peut garantir
        l’exactitude des montants au regard des conditions réelles d’un chantier. La responsabilité
        de Kerplus ne saurait être engagée en cas d’écart entre une estimation indicative et le coût
        effectif d’une opération.
      </p>

      <h2>Hébergement</h2>
      <ToComplete>Coordonnées de l’hébergeur à compléter par Kerplus.</ToComplete>
    </LegalPage>
  );
}

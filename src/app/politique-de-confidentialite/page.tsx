import type { Metadata } from 'next';
import { LegalPage, ToComplete } from '@/components/layout/LegalPage';
import { getCompanyContact } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Traitement des données personnelles collectées par l’Estimateur Kerplus : finalités, durées de conservation et droits des personnes.',
  alternates: { canonical: '/politique-de-confidentialite' },
};

export const dynamic = 'force-dynamic';

export default async function PolitiqueConfidentialitePage() {
  const company = await getCompanyContact();

  return (
    <LegalPage title="Politique de confidentialité">
      <p>
        Cette politique décrit les données personnelles collectées par l’Estimateur Kerplus, les
        raisons de leur collecte et les droits dont vous disposez.
      </p>

      <h2>Responsable de traitement</h2>
      <p>{company.name}.</p>
      <ToComplete>
        Identité complète du responsable de traitement et coordonnées du référent à compléter dans
        l’administration.
      </ToComplete>

      <h2>Données collectées</h2>
      <ul>
        <li>
          <strong>Simulation</strong> : type de projet, surface, ville, niveau de finition, montants
          calculés, date, source de visite (paramètres UTM).
        </li>
        <li>
          <strong>Commande</strong> : prénom, nom, téléphone, numéro WhatsApp, adresse email, ville
          du projet, date de démarrage souhaitée et commentaire libre.
        </li>
        <li>
          <strong>Paiement</strong> : montant, statut, référence de transaction communiquée. Aucune
          donnée bancaire n’est collectée ni stockée par Kerplus.
        </li>
        <li>
          <strong>Données techniques</strong> : une empreinte non réversible de l’adresse IP est
          conservée à des fins de sécurité et de limitation des abus. L’adresse IP en clair n’est
          jamais enregistrée.
        </li>
      </ul>

      <h2>Finalités</h2>
      <ul>
        <li>produire l’estimation demandée et l’enregistrer ;</li>
        <li>traiter la commande de rapport et assurer sa livraison ;</li>
        <li>organiser l’appel conseil ;</li>
        <li>assurer la sécurité du service et prévenir les abus ;</li>
        <li>établir des statistiques d’usage agrégées.</li>
      </ul>

      <h2>Base légale</h2>
      <p>
        Le traitement repose sur votre consentement, recueilli explicitement lors de l’envoi du
        formulaire, ainsi que sur l’exécution du contrat lorsqu’une commande est passée.
      </p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>Simulations sans coordonnées : 24 mois.</li>
        <li>Prospects et commandes : durée de la relation commerciale, puis 5 ans.</li>
        <li>Journaux d’audit et de sécurité : 12 mois.</li>
      </ul>

      <h2>Destinataires</h2>
      <p>
        Les données sont accessibles à l’équipe Kerplus habilitée. Elles peuvent être transmises aux
        prestataires techniques strictement nécessaires (hébergement, envoi d’emails, encaissement),
        sans réutilisation à d’autres fins.
      </p>

      <h2>Mesures d’audience</h2>
      <p>
        Aucun traceur non essentiel n’est déposé sans votre accord préalable. Vous pouvez refuser
        les mesures d’audience via le bandeau de consentement, sans conséquence sur l’utilisation de
        l’estimateur.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation et
        d’opposition, ainsi que du droit de retirer votre consentement à tout moment. Pour exercer
        ces droits, contactez-nous
        {company.email ? ` à l’adresse ${company.email}` : ''}.
      </p>
      <p>
        Au Sénégal, vous pouvez également saisir la Commission de protection des données
        personnelles (CDP).
      </p>
    </LegalPage>
  );
}

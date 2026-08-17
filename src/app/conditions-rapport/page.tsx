import type { Metadata } from 'next';
import { LegalPage } from '@/components/layout/LegalPage';
import { formatXOF } from '@/lib/format';
import {
  getPremiumReportPrice,
  getReportDeliveryHours,
  getSettingInt,
  getSettingList,
  SETTING_KEYS,
} from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Conditions du rapport Kerplus',
  description: 'Contenu, limites et modalités de livraison du rapport technique détaillé Kerplus.',
  alternates: { canonical: '/conditions-rapport' },
};

export const dynamic = 'force-dynamic';

export default async function ConditionsRapportPage() {
  const [price, deliveryHours, callDuration, exclusions] = await Promise.all([
    getPremiumReportPrice(),
    getReportDeliveryHours(),
    getSettingInt(SETTING_KEYS.CALL_DURATION_MINUTES, 20),
    getSettingList(SETTING_KEYS.EXCLUSIONS),
  ]);

  return (
    <LegalPage title="Conditions du rapport Kerplus">
      <p>
        Le rapport technique détaillé Kerplus est un document d’aide à la décision, facturé{' '}
        {formatXOF(price)} et livré au format PDF sous {deliveryHours} heures après confirmation
        effective du paiement.
      </p>

      <h2>Contenu du rapport</h2>
      <ul>
        <li>identité du client et informations du projet ;</li>
        <li>hypothèses de calcul retenues ;</li>
        <li>estimation globale et fourchette prévisionnelle ;</li>
        <li>
          répartition budgétaire par poste : fondations, gros œuvre, toiture ou étanchéité,
          menuiserie, électricité, plomberie, revêtements, peinture, main-d’œuvre ;
        </li>
        <li>délais estimatifs ;</li>
        <li>recommandations techniques ;</li>
        <li>exclusions et avertissement légal ;</li>
        <li>date de préparation et identité de la personne ayant validé le rapport.</li>
      </ul>

      <h2>Préparation et validation</h2>
      <p>
        Chaque rapport est préparé puis validé par l’équipe Kerplus. Aucun rapport n’est généré
        automatiquement à partir de pourcentages génériques : les montants sont saisis, contrôlés et
        validés avant émission du document.
      </p>

      <h2>Appel conseil</h2>
      <p>
        Un appel de {callDuration} minutes est organisé après la livraison du rapport afin d’en
        commenter les conclusions et de répondre à vos questions.
      </p>

      <h2>Ce que le rapport ne couvre pas</h2>
      <ul>
        {exclusions.map((exclusion) => (
          <li key={exclusion}>{exclusion}</li>
        ))}
      </ul>

      <h2>Portée du document</h2>
      <p>
        Le rapport ne remplace ni une étude de sol, ni une étude de structure, ni des plans
        d’exécution, ni un devis d’entreprise. Il doit être validé par un professionnel avant toute
        décision d’investissement ou de lancement de chantier.
      </p>

      <h2>Lien de téléchargement</h2>
      <p>
        Le rapport est transmis par un lien personnel, non prévisible et à durée limitée. Ce lien ne
        doit pas être partagé. En cas d’expiration, Kerplus peut en émettre un nouveau sur simple
        demande.
      </p>
    </LegalPage>
  );
}

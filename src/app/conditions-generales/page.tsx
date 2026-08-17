import type { Metadata } from 'next';
import { LegalPage, ToComplete } from '@/components/layout/LegalPage';
import { formatXOF } from '@/lib/format';
import { getPremiumReportPrice, getReportDeliveryHours } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Conditions générales',
  description:
    'Conditions générales d’utilisation et de vente de l’Estimateur Kerplus et du rapport technique détaillé.',
  alternates: { canonical: '/conditions-generales' },
};

export const dynamic = 'force-dynamic';

export default async function ConditionsGeneralesPage() {
  const [price, deliveryHours] = await Promise.all([
    getPremiumReportPrice(),
    getReportDeliveryHours(),
  ]);

  return (
    <LegalPage title="Conditions générales">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l’utilisation de l’Estimateur Kerplus, service en ligne
        d’estimation indicative du coût de construction au Sénégal, ainsi que la vente du rapport
        technique détaillé.
      </p>

      <h2>2. Service d’estimation gratuit</h2>
      <p>
        L’estimation est fournie gratuitement et à titre strictement indicatif. Elle ne constitue ni
        un devis contractuel, ni une étude technique, ni un engagement de prix de la part de Kerplus
        ou d’une entreprise tierce. Le prix du terrain n’est jamais inclus.
      </p>

      <h2>3. Rapport technique détaillé</h2>
      <p>
        Le rapport technique détaillé est vendu au prix de {formatXOF(price)}. Il est préparé et
        validé par l’équipe Kerplus à partir des informations communiquées par le client, puis livré
        au format PDF sous {deliveryHours} heures à compter de la confirmation effective du
        paiement. Un appel conseil est ensuite organisé.
      </p>

      <h2>4. Commande et paiement</h2>
      <p>
        La commande est enregistrée dès validation du formulaire. Le paiement s’effectue via le
        moyen de paiement proposé. La commande n’est considérée comme payée qu’après vérification
        effective du règlement par Kerplus : aucune confirmation automatique n’intervient à la suite
        d’une simple redirection.
      </p>

      <h2>5. Obligations du client</h2>
      <p>
        Le client s’engage à fournir des informations exactes. Des données erronées (surface, ville,
        type de projet) faussent l’estimation comme le rapport, sans que la responsabilité de
        Kerplus puisse être engagée.
      </p>

      <h2>6. Limites de responsabilité</h2>
      <p>
        Le coût réel d’un chantier dépend de facteurs que l’estimation ne peut intégrer : nature du
        terrain, étude de sol, plans définitifs, structure, prix des matériaux, contraintes d’accès,
        équipements retenus, honoraires, raccordements, taxes et autorisations. Aucune décision
        d’investissement ne doit être prise sur la seule base d’une estimation indicative.
      </p>

      <h2>7. Droit de rétractation et remboursement</h2>
      <p>
        Le rapport constituant un contenu personnalisé préparé à la demande, sa préparation démarre
        dès confirmation du paiement.
      </p>
      <ToComplete>
        Modalités précises de rétractation, d’annulation et de remboursement à compléter par
        Kerplus.
      </ToComplete>

      <h2>8. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la politique de confidentialité, accessible depuis
        le pied de page.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit sénégalais. À défaut d’accord amiable, tout
        litige relève des juridictions compétentes de Dakar.
      </p>
    </LegalPage>
  );
}

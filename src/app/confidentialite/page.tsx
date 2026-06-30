import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Politique de confidentialité — NeoTravel",
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout
      title="Politique de confidentialité"
      intro="NeoTravel est un prototype de projet étudiant. Cette politique décrit, à titre indicatif, la manière dont les données seraient collectées et traitées dans le cadre du fonctionnement de la plateforme."
    >
      <LegalSection title="Données collectées">
        <p>Dans le cadre d’une demande de devis ou d’un échange avec le chatbot, NeoTravel peut collecter :</p>
        <ul>
          <li>le nom du prospect</li>
          <li>l’adresse email</li>
          <li>le numéro de téléphone</li>
          <li>la ville de départ</li>
          <li>la destination</li>
          <li>la date du trajet</li>
          <li>le nombre de passagers</li>
          <li>le message envoyé via le chatbot</li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalités du traitement">
        <p>Ces données sont collectées afin de :</p>
        <ul>
          <li>traiter et qualifier la demande de devis ;</li>
          <li>calculer une estimation tarifaire indicative ;</li>
          <li>permettre à un conseiller de recontacter le prospect ;</li>
          <li>assurer le suivi commercial de la demande.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Base légale">
        <p>
          Le traitement de ces données repose sur l’exécution de mesures précontractuelles prises
          à la demande du prospect (préparation d’un devis) ainsi que, le cas échéant, sur le
          consentement de l’utilisateur lors de l’utilisation du chatbot.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation">
        <p>
          Les données sont conservées le temps nécessaire au traitement de la demande de devis et
          au suivi commercial associé, puis archivées ou supprimées dans des délais raisonnables
          conformément aux bonnes pratiques RGPD.
        </p>
      </LegalSection>

      <LegalSection title="Destinataires des données">
        <p>
          Les données collectées sont destinées à l’équipe NeoTravel et, le cas échéant, aux
          partenaires transporteurs nécessaires à la réalisation de la prestation demandée. Elles
          ne sont pas vendues à des tiers.
        </p>
      </LegalSection>

      <LegalSection title="Utilisation du chatbot IA">
        <p>
          Le chatbot NeoTravel utilise les informations saisies par l’utilisateur (message,
          trajet, nombre de passagers) pour qualifier la demande et produire une estimation
          tarifaire indicative. Les échanges avec le chatbot peuvent être conservés dans
          l’historique de la demande afin d’assurer le suivi de la conversation.
        </p>
      </LegalSection>

      <LegalSection title="Utilisation de n8n / Airtable">
        <p>
          Si elles sont activées, les demandes peuvent être transmises à des outils internes
          d’automatisation et de gestion (n8n, Airtable) utilisés par l’équipe NeoTravel pour le
          suivi commercial des demandes. Ces outils ne sont utilisés qu’à des fins de gestion
          interne du projet.
        </p>
      </LegalSection>

      <LegalSection title="Droits des utilisateurs">
        <p>Conformément au RGPD, tout utilisateur peut demander :</p>
        <ul>
          <li>l’accès à ses données personnelles ;</li>
          <li>la rectification de ses données ;</li>
          <li>la suppression de ses données ;</li>
          <li>l’opposition au traitement de ses données ;</li>
          <li>la limitation du traitement de ses données.</li>
        </ul>
        <p>Ces demandes peuvent être adressées au contact RGPD ci-dessous.</p>
      </LegalSection>

      <LegalSection title="Sécurité des données">
        <p>
          Des mesures raisonnables sont mises en œuvre afin de protéger les données collectées
          contre les accès non autorisés, la perte ou l’altération, dans la mesure permise par le
          cadre d’un projet étudiant / prototype.
        </p>
      </LegalSection>

      <LegalSection title="Contact RGPD">
        <p>
          Pour toute question relative à vos données personnelles ou pour exercer vos droits, vous
          pouvez nous contacter à l’adresse : <strong>à compléter par l’équipe</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

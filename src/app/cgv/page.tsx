import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "CGV — NeoTravel",
};

export default function CgvPage() {
  return (
    <LegalLayout
      title="Conditions générales de vente"
      intro="NeoTravel est un prototype de projet étudiant, présenté à des fins de démonstration. Les présentes conditions générales de vente décrivent, à titre indicatif, le fonctionnement envisagé du service."
    >
      <LegalSection title="Objet">
        <p>
          Les présentes conditions générales de vente (CGV) ont pour objet de définir les
          modalités selon lesquelles NeoTravel met en relation des prospects avec des transporteurs
          partenaires pour des prestations de transport de groupe.
        </p>
      </LegalSection>

      <LegalSection title="Description du service">
        <p>
          NeoTravel propose une plateforme de demande de devis pour le transport de groupe
          (autocar, minibus, navette), assistée par un agent conversationnel (chatbot IA) qui
          collecte les informations du trajet et fournit une première estimation tarifaire.
        </p>
      </LegalSection>

      <LegalSection title="Demande de devis">
        <p>
          Toute demande de devis effectuée via le chatbot ou le formulaire du site donne lieu à
          l’enregistrement de la demande, puis à un calcul d’estimation tarifaire basé sur la
          distance, le nombre de passagers et le type de véhicule souhaité.
        </p>
      </LegalSection>

      <LegalSection title="Caractère indicatif des prix">
        <p>
          <strong>Les tarifs affichés sur le site et par le chatbot sont indicatifs.</strong> Ils
          sont calculés automatiquement à partir d’une distance estimée et d’une formule de
          tarification simplifiée. Ils ne constituent pas une offre contractuelle définitive.
        </p>
      </LegalSection>

      <LegalSection title="Validation d’une prestation">
        <p>
          Le devis final doit obligatoirement être confirmé par un conseiller NeoTravel ou par le
          partenaire transporteur, après vérification de la distance réelle, des disponibilités et
          des conditions spécifiques du trajet. Aucune prestation n’est considérée comme réservée
          tant que cette confirmation n’a pas été donnée.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          NeoTravel étant un prototype étudiant, l’équipe ne saurait être tenue responsable des
          écarts entre l’estimation indicative et le tarif final, ni de l’exécution effective des
          prestations de transport, qui relève des transporteurs partenaires.
        </p>
      </LegalSection>

      <LegalSection title="Annulation">
        <p>
          Tant qu’une demande de devis n’a pas été transformée en prestation confirmée par un
          conseiller, elle peut être annulée à tout moment, sans frais, sur simple demande du
          prospect.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Les données transmises lors d’une demande de devis sont traitées conformément à notre{" "}
          <a href="/confidentialite">politique de confidentialité</a>.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Les présentes CGV sont rédigées dans le cadre d’un projet étudiant et sont, à titre
          indicatif, soumises au droit français. Tout litige relèverait, le cas échéant, des
          juridictions compétentes.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

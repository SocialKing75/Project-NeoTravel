import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Mentions légales — NeoTravel",
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout
      title="Mentions légales"
      intro="NeoTravel est un projet étudiant / prototype présenté dans le cadre d’une démonstration. Les informations ci-dessous sont génériques et destinées à être complétées par l’équipe avant toute mise en production réelle."
    >
      <LegalSection title="Éditeur du site">
        <p>
          Le site NeoTravel est édité dans le cadre d’un projet étudiant / prototype, à titre non
          commercial et à des fins de démonstration.
        </p>
        <ul>
          <li>Nom du projet : NeoTravel</li>
          <li>Statut : projet étudiant / prototype (non destiné à la production en l’état)</li>
          <li>Contact : à compléter par l’équipe</li>
        </ul>
      </LegalSection>

      <LegalSection title="Responsable de publication">
        <p>
          Le responsable de publication est l’équipe projet NeoTravel. Les coordonnées précises du
          responsable de publication seront communiquées à compléter par l’équipe.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>Le site est hébergé par :</p>
        <ul>
          <li>Hébergeur : Vercel Inc.</li>
          <li>Adresse : 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
          <li>Site web : vercel.com</li>
        </ul>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L’ensemble des éléments du site NeoTravel (textes, visuels, logo, charte graphique, code
          source) est protégé au titre de la propriété intellectuelle. Toute reproduction ou
          réutilisation sans autorisation est interdite, sauf dans le cadre pédagogique du projet.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          NeoTravel étant un prototype réalisé dans un contexte étudiant, les informations,
          estimations de tarifs et fonctionnalités présentées sur le site sont fournies à titre
          indicatif et sans garantie. L’équipe ne pourra être tenue responsable des éventuelles
          erreurs, omissions ou indisponibilités du service.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Pour toute question relative au site ou à ces mentions légales, vous pouvez nous
          contacter à l’adresse : <strong>à compléter par l’équipe</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

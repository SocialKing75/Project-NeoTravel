import type { Metadata } from "next";
import LegalLayout, { LegalSection } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Cookies — NeoTravel",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Politique relative aux cookies"
      intro="NeoTravel est un prototype de projet étudiant. Cette page décrit, à titre indicatif, l’usage des cookies envisagé sur le site et la manière dont votre choix est géré."
    >
      <LegalSection title="Définition des cookies">
        <p>
          Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette,
          smartphone) lors de la consultation d’un site. Il permet de mémoriser des informations
          relatives à votre navigation.
        </p>
      </LegalSection>

      <LegalSection title="Cookies nécessaires">
        <p>
          Ces cookies sont indispensables au bon fonctionnement du site (navigation, mémorisation
          de votre choix de consentement aux cookies, sécurité). Ils ne nécessitent pas de
          consentement et ne peuvent pas être désactivés.
        </p>
      </LegalSection>

      <LegalSection title="Cookies de mesure d’audience">
        <p>
          Si elles sont activées par l’équipe, des solutions de mesure d’audience peuvent être
          utilisées afin de comprendre la fréquentation du site et d’améliorer l’expérience
          utilisateur. Ces cookies ne sont déposés qu’avec votre consentement et restent optionnels.
        </p>
      </LegalSection>

      <LegalSection title="Gestion du consentement">
        <p>
          Lors de votre première visite, une bannière vous permet d’accepter, de refuser ou de
          personnaliser l’utilisation des cookies non nécessaires. Vous pouvez modifier ce choix à
          tout moment en effaçant les données de navigation de votre navigateur pour ce site, ce
          qui réaffichera la bannière de consentement.
        </p>
      </LegalSection>

      <LegalSection title="Durée de conservation du choix">
        <p>
          Votre choix concernant les cookies est conservé localement dans votre navigateur
          (stockage local) afin de ne pas vous solliciter à chaque visite. En l’absence de mise à
          jour, ce choix reste valable jusqu’à ce que vous l’effaciez ou le modifiiez.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

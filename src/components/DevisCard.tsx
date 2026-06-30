import styles from "./DevisCard.module.css";

/** Une ligne du détail de tarification (libellé + montant signé). */
export type DevisLine = {
  label: string;
  /** Montant en euros. Positif → "+X €", négatif → "-X €". */
  amount: number;
};

/** Données nécessaires au rendu d'un devis NeoTravel. */
export type DevisData = {
  invoiceNumber: string;
  /** Date d'émission affichée, ex. "15 juillet 2026". */
  invoiceDate: string;
  /** Durée de validité en jours (15 par défaut). */
  validityDays?: number;
  /** SIRET affiché dans le bandeau. */
  siret?: string;

  departureCity: string;
  arrivalCity: string;

  clientName: string;
  clientEmail: string;

  passengers: number;
  /** Date du trajet, ex. "15 juillet 2026". */
  tripDate: string;
  /** Tags additionnels affichés après route / passagers / date. */
  extraTags?: string[];

  distanceKm: number;
  pricePerKm: number;
  /** Tarif de base (distance × prix/km), en euros. */
  basePrice: number;

  /** Lignes d'ajustement (saison, urgence, options, marge…), en euros signés. */
  adjustments?: DevisLine[];

  /** Montant HT, en euros. */
  subtotalHt: number;
  /** Taux de TVA appliqué (0.10 par défaut). */
  tvaRate?: number;
  /** Montant de TVA, en euros. */
  taxAmount: number;
  /** Total TTC, en euros. */
  totalTtc: number;
};

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return eur.format(value);
}

function formatSigned(value: number): string {
  const formatted = eur.format(Math.abs(value));
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DevisCard({ devis }: { devis: DevisData }) {
  const validity = devis.validityDays ?? 15;
  const siret = devis.siret ?? "123 456 789 00010 (NEOTRAVEL SA)";
  const tvaPercent = Math.round((devis.tvaRate ?? 0.1) * 100);

  return (
    <div className={styles.devisContainer}>
      <div className={styles.headerBandeau}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.brandName}>NeoTravel</div>
            <div className={styles.categoryTitle}>Devis Transport de Groupe</div>
          </div>
          <div>
            <div className={styles.badgeAuto}>Calculé automatiquement</div>
            <div className={styles.dateBadge}>{devis.invoiceDate}</div>
          </div>
        </div>

        <div className={styles.routeTitle}>
          <span>{devis.departureCity}</span>
          <span className={styles.routeArrow}>→</span>
          <span>{devis.arrivalCity}</span>
        </div>

        <div className={styles.metaInfo}>
          <div>
            N° Devis : <span>{devis.invoiceNumber}</span> · Valable {validity} jours
          </div>
          <div>Siret : {siret}</div>
        </div>
      </div>

      <div className={styles.contentBody}>
        <div className={styles.clientProfile}>
          <div className={styles.clientAvatar}>{initials(devis.clientName)}</div>
          <div className={styles.clientDetails}>
            <strong>{devis.clientName}</strong>
            <span>{devis.clientEmail}</span>
          </div>
        </div>

        <div className={styles.tagsContainer}>
          <div className={styles.tag}>
            {devis.departureCity} → {devis.arrivalCity}
          </div>
          <div className={styles.tag}>{devis.passengers} passagers</div>
          <div className={styles.tag}>{devis.tripDate}</div>
          {devis.extraTags?.map((tag) => (
            <div className={styles.tag} key={tag}>
              {tag}
            </div>
          ))}
        </div>

        <table className={styles.pricingTable}>
          <tbody>
            <tr>
              <td>
                {devis.distanceKm} km × {eur2.format(devis.pricePerKm)}/km
              </td>
              <td className={styles.price}>{formatMoney(devis.basePrice)}</td>
            </tr>
            {devis.adjustments?.map((line) => (
              <tr key={line.label}>
                <td>{line.label}</td>
                <td className={styles.price}>{formatSigned(line.amount)}</td>
              </tr>
            ))}
            <tr className={styles.boldRow}>
              <td>Montant HT</td>
              <td className={styles.price}>{formatMoney(devis.subtotalHt)}</td>
            </tr>
            <tr>
              <td>TVA {tvaPercent} %</td>
              <td className={styles.price}>{formatSigned(devis.taxAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.signatureSection}>
          <div className={styles.signatureBlock}>
            <div className={styles.signatureTitle}>Signature NeoTravel :</div>
            <div className={styles.signatureBox}>
              <div className={styles.signatureDots}>
                ...................................
              </div>
            </div>
          </div>
          <div className={styles.signatureBlock}>
            <div className={styles.signatureTitle}>Signature du Client :</div>
            <div className={styles.signatureBox}>
              <div className={styles.signatureDots}>
                ...................................
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footerTotalBandeau}>
        <div className={styles.totalLabel}>
          Montant Total TTC
          <span className={styles.totalLabelHint}>(TVA {tvaPercent} % incluse)</span>
        </div>
        <div className={styles.totalAmount}>{formatMoney(devis.totalTtc)}</div>
      </div>
    </div>
  );
}

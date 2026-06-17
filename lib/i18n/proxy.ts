/**
 * Externalized FR/EN strings for the public withdrawal form. No copy is
 * hard-coded in the rendering layer.
 */
export type Locale = "fr" | "en";

export interface ProxyDict {
  title: string;
  intro: string;
  step1Title: string;
  nameLabel: string;
  orderLabel: string;
  emailLabel: string;
  continue: string;
  step2Title: string;
  verifiedBanner: string;
  manualBanner: string;
  itemsLabel: string;
  addItem: string;
  itemTitlePlaceholder: string;
  qtyPlaceholder: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  back: string;
  submit: string;
  step3Title: string;
  confirmation: string;
  referenceLabel: string;
  requiredError: string;
  genericError: string;
}

const FR: ProxyDict = {
  title: "Formulaire de rétractation",
  intro:
    "Exercez votre droit de rétractation (directive UE 2023/2673). Aucun compte n'est nécessaire.",
  step1Title: "Vos coordonnées",
  nameLabel: "Nom (facultatif)",
  orderLabel: "Numéro de commande",
  emailLabel: "Email",
  continue: "Continuer",
  step2Title: "Articles concernés",
  verifiedBanner: "Commande vérifiée — sélectionnez les articles à retourner.",
  manualBanner:
    "Commande introuvable. Saisissez manuellement les articles concernés.",
  itemsLabel: "Articles",
  addItem: "Ajouter un article",
  itemTitlePlaceholder: "Désignation de l'article",
  qtyPlaceholder: "Qté",
  reasonLabel: "Motif (facultatif)",
  reasonPlaceholder: "Motif de la rétractation",
  back: "Retour",
  submit: "Envoyer la demande",
  step3Title: "Demande enregistrée",
  confirmation:
    "Votre demande de rétractation a bien été enregistrée. Conservez votre référence.",
  referenceLabel: "Référence",
  requiredError: "Veuillez remplir les champs obligatoires.",
  genericError: "Une erreur est survenue. Veuillez réessayer.",
};

const EN: ProxyDict = {
  title: "Withdrawal form",
  intro:
    "Exercise your right of withdrawal (EU Directive 2023/2673). No account required.",
  step1Title: "Your details",
  nameLabel: "Name (optional)",
  orderLabel: "Order number",
  emailLabel: "Email",
  continue: "Continue",
  step2Title: "Items concerned",
  verifiedBanner: "Order verified — select the items to return.",
  manualBanner: "Order not found. Enter the items concerned manually.",
  itemsLabel: "Items",
  addItem: "Add an item",
  itemTitlePlaceholder: "Item name",
  qtyPlaceholder: "Qty",
  reasonLabel: "Reason (optional)",
  reasonPlaceholder: "Reason for withdrawal",
  back: "Back",
  submit: "Submit request",
  step3Title: "Request recorded",
  confirmation:
    "Your withdrawal request has been recorded. Keep your reference.",
  referenceLabel: "Reference",
  requiredError: "Please fill in the required fields.",
  genericError: "Something went wrong. Please try again.",
};

export function getDict(locale: string | null): { locale: Locale; dict: ProxyDict } {
  return locale?.toLowerCase().startsWith("en")
    ? { locale: "en", dict: EN }
    : { locale: "fr", dict: FR };
}

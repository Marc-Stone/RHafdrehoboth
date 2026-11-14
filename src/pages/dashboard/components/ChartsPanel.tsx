import { MonthlyChart, CommunityChart, GenderChart, AgeChart, type NameValue } from './ChartsSection';

interface ChartsPanelProps {
  monthly: NameValue[];
  byCommunity: NameValue[];
  byGender: NameValue[];
  byAge: NameValue[];
}

/**
 * Panneau de graphiques isolé dans son propre module : la bibliothèque de
 * graphiques (volumineuse) n'est téléchargée qu'après le premier affichage du
 * tableau de bord. Les compteurs et les listes apparaissent donc immédiatement,
 * sans attendre le rendu des courbes.
 */
export default function ChartsPanel({ monthly, byCommunity, byGender, byAge }: ChartsPanelProps) {
  return (
    <>
      <MonthlyChart data={monthly} />
      <CommunityChart data={byCommunity} />
      <GenderChart data={byGender} />
      <AgeChart data={byAge} />
    </>
  );
}
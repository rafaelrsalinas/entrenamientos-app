type Props = { thickness?: number; bleed?: boolean };

/**
 * Banda hazard amarilla/negra a 135° — estampado táctico/bombero.
 * Por defecto sangra al ancho completo del container (margin negativo).
 */
export default function HazardBand({ thickness = 6, bleed = true }: Props) {
  return (
    <div
      className={`hazard${bleed ? '' : ' pad0'}`}
      style={{ height: thickness }}
      aria-hidden
    />
  );
}

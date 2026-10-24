// Frontend/src/components/classify/LocalizationSection.jsx
function Fig({ b64, alt, caption }) {
  if (!b64) return null;
  return (
    <figure>
      <img src={`data:image/png;base64,${b64}`} alt={alt} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function LocalizationSection({ localization }) {
  if (!localization || !localization.heatmap_overlay_base64) return null;

  const spots = localization.spots || [];
  const countText = spots.length === 1 ? '1 spot detected' : `${spots.length} spots detected`;
  const damage =
    typeof localization.total_damage_pct === 'number'
      ? ` · about ${localization.total_damage_pct.toFixed(1)}% of the photo affected`
      : '';

  return (
    <div className="localization-section">
      <h4>Where the problem is ({countText}{damage})</h4>
      <div className="localization-pair three">
        <Fig b64={localization.heatmap_overlay_base64} alt="Heatmap of the affected area" caption="Heatmap" />
        <Fig b64={localization.lesion_mask_base64} alt="Lesion mask" caption="Lesion mask" />
        <Fig b64={localization.annotated_image_base64} alt="Affected spots marked with boxes" caption="Boxes" />
      </div>

      {spots.length > 0 && (
        <table className="spot-table">
          <thead>
            <tr><th>Spot</th><th>Area</th><th>Darkness</th><th>Elongation</th></tr>
          </thead>
          <tbody>
            {spots.slice(0, 6).map((s) => (
              <tr key={s.spot_id}>
                <td>#{s.spot_id}</td>
                <td>{s.area_ratio_pct}%</td>
                <td>{s.necrosis_intensity}</td>
                <td>{s.elongation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
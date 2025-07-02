/**
 * @typedef {Object} KnobProps
 * @property {string} ariaLabel - The aria-label for the knob
 * @property {boolean} selected - Whether the knob is selected or not
 * @property {() => void} onClick - The function to call when the knob is clicked
 */

/**
 * Knob component
 * @param {KnobProps} props - The props for the Knob component
 * @returns {JSX.Element} The rendered Knob component
 */
export const Knob = ({ ariaLabel, selected, onClick }) => {
  return (
    <button
      id=':rgi:'
      className={`track${selected ? ' track_on' : ''}`}
      aria-label={ariaLabel}
      role='switch'
      type='button'
      aria-checked='false'
      onClick={onClick}
    >
      <div className={`knob${selected ? ' knob_on' : ''}`}></div>
    </button>
  );
};
